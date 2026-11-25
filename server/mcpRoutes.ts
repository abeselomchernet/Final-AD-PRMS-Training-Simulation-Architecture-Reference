import express, { type Express, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createInitialSeedState } from '../src/data/seedData.ts';
import {
  createBridgeAuthMiddleware,
  createDefaultBridgeReplayCache,
  type SignedBridgeToolPayload,
  type SignedPreAuthRejectionPayload,
  type VerifiedBridgeRequest,
} from './mcpBridge.ts';
import {
  appendMcpAuditEventTx,
  approveMcpBinding,
  createPendingMcpBinding,
  findMcpBindingBySubjectClient,
  listMcpBindings,
  queryMcpAuditSummary,
  rejectPendingMcpBinding,
  requestMcpBindingScopeUpdate,
  revokeMcpBindingById,
  revokeMcpByClientOrUser,
} from './mcpGovernanceStore.ts';
import { executeMcpProjection, resolveOwnerIdForBinding } from './mcpProjections.ts';
import {
  getMcpToolDecision,
  isMcpToolName,
  sanitizeMcpText,
  type McpToolName,
} from './mcpRbac.ts';
import type { OfficeSqliteStore } from './officeStore.ts';
import { findStaffEntryByActorId, type OfficeSessionClaims } from './security.ts';

interface StaffAuthedRequest extends Request {
  officeSession?: OfficeSessionClaims;
}

const TOOL_ROUTE_MAP: Record<string, McpToolName> = {
  '/system/status': 'get_system_status',
  '/properties/summary': 'get_property_summary',
  '/buildings/list': 'list_buildings',
  '/units/occupancy': 'get_unit_occupancy',
  '/leases/summary': 'get_lease_summary',
  '/collections/summary': 'get_rent_collection_summary',
  '/collections/overdue': 'get_overdue_rent_summary',
  '/audit/summary': 'get_audit_summary',
};

export function registerMcpInternalRoutes(
  app: Express,
  store: OfficeSqliteStore,
  options?: {
    getPrimarySecret?: () => string;
    getPreviousSecret?: () => string;
    allowNonLoopbackForTests?: boolean;
  }
): void {
  const replayCache = createDefaultBridgeReplayCache();
  const bridgeAuth = createBridgeAuthMiddleware({
    getPrimarySecret: options?.getPrimarySecret ?? (() => process.env.MCP_INTERNAL_BRIDGE_SECRET || ''),
    getPreviousSecret:
      options?.getPreviousSecret ?? (() => process.env.MCP_INTERNAL_BRIDGE_SECRET_PREVIOUS || ''),
    replayCache,
    allowNonLoopbackForTests: options?.allowNonLoopbackForTests,
  });

  const preauthAuditRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: 'PREAUTH_AUDIT_RATE_LIMITED',
      message: 'Pre-auth rejection telemetry rate limit exceeded.',
    },
  });

  const router = express.Router();
  router.use(
    express.raw({
      type: 'application/json',
      limit: '64kb',
    })
  );
  router.use(bridgeAuth);

  // Rate-limited HMAC-authenticated sink for JWT pre-auth rejections at services/mcp (§12.3)
  router.post('/audit/preauth-rejection', preauthAuditRateLimiter, (req: VerifiedBridgeRequest, res: Response) => {
    const body = (req.bridgeBody || {}) as Partial<SignedPreAuthRejectionPayload>;
    const transport = body.transport === 'STDIO' ? 'STDIO' : 'STREAMABLE_HTTP';
    const denialReason = sanitizeMcpText(body.denialReason || 'PRE_AUTH_JWT_REJECTED', 64) || 'PRE_AUTH_JWT_REJECTED';
    const httpStatus = Number(body.httpStatus) === 403 ? 403 : 401;
    const requestedPath = sanitizeMcpText(body.requestedPath || '/mcp', 80);

    const audit = appendMcpAuditEventTx(store.getDatabase(), {
      channel: 'MCP',
      transport,
      authMode: 'PRE_AUTH_UNVERIFIED',
      supabaseUid: null,
      oauthClientId: null,
      bindingId: null,
      actorId: null,
      role: null,
      ownerId: null,
      toolName: 'AUTH_GATE',
      decision: 'DENIED',
      httpStatus,
      denialReason,
      params: { requestedPath },
      responseRowCount: 0,
    });

    res.status(200).json({ ok: true, seq: audit.seq, eventId: audit.eventId });
  });

  // All 8 read-only tool routes
  for (const [subPath, toolName] of Object.entries(TOOL_ROUTE_MAP)) {
    router.post(subPath, (req: VerifiedBridgeRequest, res: Response) => {
      const db = store.getDatabase();
      const body = (req.bridgeBody || {}) as Partial<SignedBridgeToolPayload>;
      const params =
        body.params && typeof body.params === 'object' && !Array.isArray(body.params)
          ? (body.params as Record<string, unknown>)
          : {};
      const vi = body.verifiedIdentity;

      if (
        !vi ||
        typeof vi !== 'object' ||
        typeof vi.supabaseUid !== 'string' ||
        !vi.supabaseUid.trim() ||
        typeof vi.clientId !== 'string' ||
        !vi.clientId.trim() ||
        typeof vi.tokenIat !== 'number' ||
        !Number.isFinite(vi.tokenIat) ||
        (vi.authMode !== 'SUPABASE_OAUTH21' &&
          vi.authMode !== 'LOCAL_DEV_TOKEN' &&
          vi.authMode !== 'LOCAL_STDIO')
      ) {
        const audit = appendMcpAuditEventTx(db, {
          channel: 'MCP',
          transport: 'STREAMABLE_HTTP',
          authMode: 'PRE_AUTH_UNVERIFIED',
          toolName,
          decision: 'DENIED',
          httpStatus: 400,
          denialReason: 'MALFORMED_VERIFIED_IDENTITY',
          params,
        });
        res.status(400).json({
          ok: false,
          code: 'MALFORMED_VERIFIED_IDENTITY',
          message: 'Signed verifiedIdentity payload is missing required fields.',
          auditSeq: audit.seq,
        });
        return;
      }

      const transport = vi.authMode === 'LOCAL_STDIO' ? 'STDIO' : 'STREAMABLE_HTTP';
      const supabaseUid = vi.supabaseUid.trim();
      const clientId = vi.clientId.trim();

      const denyWithAudit = (
        status: number,
        code: string,
        message: string,
        extras?: {
          bindingId?: string | null;
          actorId?: string | null;
          role?: string | null;
          ownerId?: string | null;
        }
      ) => {
        const audit = appendMcpAuditEventTx(db, {
          channel: 'MCP',
          transport,
          authMode: vi.authMode,
          supabaseUid,
          oauthClientId: clientId,
          bindingId: extras?.bindingId ?? null,
          actorId: extras?.actorId ?? null,
          role: extras?.role ?? null,
          ownerId: extras?.ownerId ?? null,
          toolName,
          decision: 'DENIED',
          httpStatus: status,
          denialReason: code,
          params,
        });
        res.status(status).json({ ok: false, code, message, auditSeq: audit.seq });
      };

      const binding = findMcpBindingBySubjectClient(db, supabaseUid, clientId);
      if (!binding) {
        denyWithAudit(403, 'UNMAPPED_SUPABASE_UID', 'Authenticated identity has no approved MCP binding.');
        return;
      }

      if (binding.grantStatus !== 'ACTIVE') {
        denyWithAudit(403, `GRANT_${binding.grantStatus}`, `MCP grant is "${binding.grantStatus}".`, {
          bindingId: binding.id,
          actorId: binding.actorId,
          role: binding.role,
        });
        return;
      }

      if (binding.expiresAt && Date.parse(binding.expiresAt) <= Date.now()) {
        denyWithAudit(403, 'GRANT_EXPIRED', 'MCP binding has expired.', {
          bindingId: binding.id,
          actorId: binding.actorId,
          role: binding.role,
        });
        return;
      }

      // ERR-3.1-06: Reject same-second and older tokens (tokenIat <= token_not_before)
      if (vi.tokenIat <= binding.tokenNotBefore) {
        denyWithAudit(
          403,
          'TOKEN_REVOKED_BY_NOT_BEFORE',
          'Access token issued at or before revocation cutoff.',
          {
            bindingId: binding.id,
            actorId: binding.actorId,
            role: binding.role,
          }
        );
        return;
      }

      const staff = findStaffEntryByActorId(binding.actorId);
      if (!staff || staff.role !== binding.role) {
        denyWithAudit(403, 'NON_STAFF_OR_INVALID_ACTOR', 'Bound actor is not an active staff entry.', {
          bindingId: binding.id,
          actorId: binding.actorId,
          role: binding.role,
        });
        return;
      }

      if (!binding.allowedTools.includes(toolName)) {
        denyWithAudit(
          403,
          'TOOL_NOT_GRANTED',
          `Tool "${toolName}" is not explicitly included in this binding's allowed_tools_json.`,
          {
            bindingId: binding.id,
            actorId: binding.actorId,
            role: binding.role,
          }
        );
        return;
      }

      const rbacDecision = getMcpToolDecision(binding.role, toolName);
      if (rbacDecision === 'Deny') {
        denyWithAudit(
          403,
          `RBAC_ROLE_DENIED`,
          `Role "${binding.role}" is prohibited from "${toolName}".`,
          {
            bindingId: binding.id,
            actorId: binding.actorId,
            role: binding.role,
          }
        );
        return;
      }

      const ownerResolution = resolveOwnerIdForBinding(binding, staff.allowedOwners, params.ownerId);
      if (!ownerResolution.ok) {
        denyWithAudit(ownerResolution.status, ownerResolution.code, ownerResolution.message, {
          bindingId: binding.id,
          actorId: binding.actorId,
          role: binding.role,
          ownerId: typeof params.ownerId === 'string' ? params.ownerId : null,
        });
        return;
      }

      // Ensure cold-boot seed state is initialized in non-production before projection reads
      store.ensureSyntheticSeedInitialized(
        () => createInitialSeedState() as unknown as Record<string, unknown>
      );

      const projection = executeMcpProjection(toolName, {
        store,
        binding,
        ownerId: ownerResolution.ownerId,
        decision: rbacDecision,
        params,
      });

      const audit = appendMcpAuditEventTx(db, {
        channel: 'MCP',
        transport,
        authMode: vi.authMode,
        supabaseUid,
        oauthClientId: clientId,
        bindingId: binding.id,
        actorId: binding.actorId,
        role: binding.role,
        ownerId: ownerResolution.ownerId,
        toolName,
        decision: 'ALLOWED',
        httpStatus: 200,
        params,
        responseRowCount: projection.rowCount,
      });

      res.status(200).json({
        ok: true,
        data: projection.data,
        meta: {
          actorId: binding.actorId,
          role: binding.role,
          ownerId: ownerResolution.ownerId,
          rbacDecision,
          isSyntheticFixture: true,
          auditSeq: audit.seq,
        },
      });
    });
  }

  app.use('/api/internal/mcp/v1', router);
}

export function registerMcpAdminRoutes(
  app: Express,
  store: OfficeSqliteStore,
  requireOfficeAuth: (req: StaffAuthedRequest, res: Response, next: () => void) => void
): void {
  const adminRouter = express.Router();
  adminRouter.use(requireOfficeAuth);

  // List active/pending/revoked MCP bindings (System Admin, GM, Owner, Auditor only)
  adminRouter.get('/bindings', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const allowedRoles = new Set([
      'System Administrator',
      'General Manager',
      'Owner / Director',
      'Auditor / Read-only reviewer',
    ]);
    if (claims.sessionType !== 'staff' || !allowedRoles.has(claims.role)) {
      res.status(403).json({ error: true, msg: 'MCP binding governance view is restricted.' });
      return;
    }
    res.json({
      ok: true,
      bindings: listMcpBindings(store.getDatabase()),
    });
  });

  // Step A (Maker): Create PENDING binding candidate
  adminRouter.post('/bindings/requests', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as {
      supabaseUid?: string;
      oauthClientId?: string;
      actorId?: string;
      allowedOwners?: string[];
      defaultOwnerId?: string | null;
      allowedTools?: string[];
      expiresAt?: string | null;
    };

    const result = createPendingMcpBinding(store.getDatabase(), {
      makerActorId: claims.sub,
      makerRole: claims.role,
      supabaseUid: String(body.supabaseUid || ''),
      oauthClientId: String(body.oauthClientId || ''),
      targetActorId: String(body.actorId || ''),
      allowedOwners: Array.isArray(body.allowedOwners) ? body.allowedOwners.map(String) : [],
      defaultOwnerId: body.defaultOwnerId ? String(body.defaultOwnerId) : null,
      allowedTools: Array.isArray(body.allowedTools) ? body.allowedTools.map(String) : [],
      expiresAt: body.expiresAt ? String(body.expiresAt) : null,
    });

    if (!result.ok) {
      res.status(result.status).json({ error: true, code: result.code, msg: result.message, auditSeq: result.auditSeq });
      return;
    }
    res.status(201).json({ ok: true, binding: result.binding, auditSeq: result.auditSeq });
  });

  // Step B (Checker): Approve PENDING -> ACTIVE
  adminRouter.post('/bindings/:id/approve', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const result = approveMcpBinding(store.getDatabase(), {
      bindingId: String(req.params.id),
      checkerActorId: claims.sub,
      checkerRole: claims.role,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: true, code: result.code, msg: result.message, auditSeq: result.auditSeq });
      return;
    }
    res.status(200).json({ ok: true, binding: result.binding, auditSeq: result.auditSeq });
  });

  // Step B (Checker): Reject PENDING draft (deletes draft, keeps audit history)
  adminRouter.post('/bindings/:id/reject', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as { reason?: string };
    const result = rejectPendingMcpBinding(store.getDatabase(), {
      bindingId: String(req.params.id),
      checkerActorId: claims.sub,
      checkerRole: claims.role,
      reason: body.reason ? String(body.reason) : undefined,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: true, code: result.code, msg: result.message, auditSeq: result.auditSeq });
      return;
    }
    res.status(200).json({ ok: true, auditSeq: result.auditSeq });
  });

  // Scope/tool amendment: returns binding to PENDING requiring Checker re-approval
  adminRouter.post('/bindings/:id/update', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as {
      allowedOwners?: string[];
      defaultOwnerId?: string | null;
      allowedTools?: string[];
      expiresAt?: string | null;
    };
    const result = requestMcpBindingScopeUpdate(store.getDatabase(), {
      bindingId: String(req.params.id),
      makerActorId: claims.sub,
      makerRole: claims.role,
      allowedOwners: Array.isArray(body.allowedOwners) ? body.allowedOwners.map(String) : [],
      defaultOwnerId: body.defaultOwnerId ? String(body.defaultOwnerId) : null,
      allowedTools: Array.isArray(body.allowedTools) ? body.allowedTools.map(String) : [],
      expiresAt: body.expiresAt ? String(body.expiresAt) : null,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: true, code: result.code, msg: result.message, auditSeq: result.auditSeq });
      return;
    }
    res.status(200).json({ ok: true, binding: result.binding, auditSeq: result.auditSeq });
  });

  // Immediate Grant-level Revocation
  adminRouter.post('/bindings/:id/revoke', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as { reason?: string };
    const result = revokeMcpBindingById(store.getDatabase(), {
      bindingId: String(req.params.id),
      revokerActorId: claims.sub,
      revokerRole: claims.role,
      reason: body.reason ? String(body.reason) : undefined,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: true, code: result.code, msg: result.message, auditSeq: result.auditSeq });
      return;
    }
    res.status(200).json({ ok: true, binding: result.binding ?? null, auditSeq: result.auditSeq });
  });

  // Client-level or User-level immediate kill switch
  adminRouter.post('/revoke-scope', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as {
      targetType?: 'CLIENT' | 'USER';
      targetValue?: string;
      reason?: string;
    };
    if (
      (body.targetType !== 'CLIENT' && body.targetType !== 'USER') ||
      !body.targetValue ||
      !String(body.targetValue).trim()
    ) {
      res.status(400).json({ error: true, msg: 'Valid targetType (CLIENT|USER) and targetValue are required.' });
      return;
    }
    const result = revokeMcpByClientOrUser(store.getDatabase(), {
      targetType: body.targetType,
      targetValue: String(body.targetValue).trim(),
      revokerActorId: claims.sub,
      revokerRole: claims.role,
      reason: body.reason ? String(body.reason) : undefined,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: true, code: result.code, msg: result.message, auditSeq: result.auditSeq });
      return;
    }
    res.status(200).json({ ok: true, affectedCount: result.affectedCount, auditSeq: result.auditSeq });
  });

  // Server-controlled mcp_audit_events feed for Admin/Auditor console
  adminRouter.get('/audit', (req: StaffAuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (claims.sessionType !== 'staff' || !isMcpToolName('get_audit_summary') || getMcpToolDecision(claims.role, 'get_audit_summary') === 'Deny') {
      res.status(403).json({ error: true, msg: 'Role is prohibited from viewing server MCP audit events.' });
      return;
    }
    const filterOwner =
      claims.allowedOwners.length === 1
        ? claims.allowedOwners[0]
        : typeof req.query.ownerId === 'string' && req.query.ownerId.trim()
          ? req.query.ownerId.trim()
          : null;
    const summary = queryMcpAuditSummary(store.getDatabase(), {
      ownerId: filterOwner,
      channel: typeof req.query.channel === 'string' ? req.query.channel : null,
      decision: typeof req.query.decision === 'string' ? req.query.decision : null,
      limit: Number(req.query.limit || 25),
      offset: Number(req.query.offset || 0),
    });
    res.json({ ok: true, ...summary });
  });

  app.use('/api/office/mcp', adminRouter);
}
