import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  getMcpToolDecision,
  isMcpToolName,
  redactMcpParams,
  sanitizeMcpText,
  SYNTHETIC_OWNER_IDS,
  type McpToolName,
} from './mcpRbac.ts';
import { findStaffEntryByActorId } from './security.ts';

export type McpGrantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type McpAuditChannel = 'MCP' | 'ADMIN_PROVISIONING';
export type McpAuditTransport = 'STREAMABLE_HTTP' | 'STDIO' | 'ADMIN_API';
export type McpAuditAuthMode =
  | 'SUPABASE_OAUTH21'
  | 'LOCAL_DEV_TOKEN'
  | 'LOCAL_STDIO'
  | 'STAFF_SESSION'
  | 'PRE_AUTH_UNVERIFIED';

export interface McpActorBindingRow {
  id: string;
  supabaseUid: string;
  oauthClientId: string;
  actorId: string;
  role: string;
  allowedOwners: string[];
  defaultOwnerId: string | null;
  allowedTools: string[];
  grantStatus: McpGrantStatus;
  createdAt: string;
  createdBy: string;
  provisionedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  tokenNotBefore: number;
}

export interface AppendMcpAuditInput {
  occurredAt?: string;
  channel: McpAuditChannel;
  transport: McpAuditTransport;
  authMode: McpAuditAuthMode;
  supabaseUid?: string | null;
  oauthClientId?: string | null;
  bindingId?: string | null;
  actorId?: string | null;
  role?: string | null;
  ownerId?: string | null;
  toolName: string;
  decision: 'ALLOWED' | 'DENIED';
  httpStatus: number;
  denialReason?: string | null;
  params?: unknown;
  responseRowCount?: number;
}

export interface McpAuditSummaryEvent {
  id: string;
  seq: number;
  timestamp: string;
  channel: McpAuditChannel;
  transport: McpAuditTransport;
  authMode: McpAuditAuthMode;
  actorId: string | null;
  role: string | null;
  ownerId: string | null;
  toolName: string;
  decision: 'ALLOWED' | 'DENIED';
  httpStatus: number;
  denialReason: string | null;
}

const MAKER_ROLES = new Set(['System Administrator']);
const CHECKER_ROLES = new Set(['General Manager', 'Owner / Director']);
const REVOKER_ROLES = new Set(['System Administrator', 'General Manager', 'Owner / Director']);

export function initMcpSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_actor_bindings (
      id TEXT PRIMARY KEY,
      supabase_uid TEXT NOT NULL,
      oauth_client_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      role TEXT NOT NULL,
      allowed_owners_json TEXT NOT NULL,
      default_owner_id TEXT,
      allowed_tools_json TEXT NOT NULL DEFAULT '[]',
      grant_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (grant_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      provisioned_by TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      updated_by TEXT,
      updated_at TEXT,
      expires_at TEXT,
      revoked_at TEXT,
      revoked_by TEXT,
      revocation_reason TEXT,
      token_not_before INTEGER NOT NULL DEFAULT 0,
      CHECK (json_valid(allowed_owners_json) AND json_type(allowed_owners_json) = 'array'),
      CHECK (json_valid(allowed_tools_json) AND json_type(allowed_tools_json) = 'array'),
      CHECK (allowed_tools_json NOT LIKE '%"*"%'),
      CHECK (
        (grant_status = 'PENDING' AND approved_by IS NULL AND approved_at IS NULL)
        OR (
          grant_status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')
          AND approved_by IS NOT NULL
          AND length(trim(approved_by)) > 0
          AND approved_at IS NOT NULL
          AND length(trim(approved_at)) > 0
          AND approved_by <> provisioned_by
          AND approved_by <> actor_id
        )
      ),
      UNIQUE (supabase_uid, oauth_client_id)
    );

    CREATE INDEX IF NOT EXISTS idx_mcp_bindings_uid_status
      ON mcp_actor_bindings (supabase_uid, grant_status);

    CREATE TABLE IF NOT EXISTS mcp_audit_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_schema_version INTEGER NOT NULL DEFAULT 1,
      event_id TEXT NOT NULL UNIQUE,
      occurred_at TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'MCP' CHECK (channel IN ('MCP', 'ADMIN_PROVISIONING')),
      transport TEXT NOT NULL CHECK (transport IN ('STREAMABLE_HTTP', 'STDIO', 'ADMIN_API')),
      auth_mode TEXT NOT NULL CHECK (
        auth_mode IN (
          'SUPABASE_OAUTH21',
          'LOCAL_DEV_TOKEN',
          'LOCAL_STDIO',
          'STAFF_SESSION',
          'PRE_AUTH_UNVERIFIED'
        )
      ),
      supabase_uid TEXT,
      oauth_client_id TEXT,
      binding_id TEXT,
      actor_id TEXT,
      role TEXT,
      owner_id TEXT,
      tool_name TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('ALLOWED', 'DENIED')),
      http_status INTEGER NOT NULL,
      denial_reason TEXT,
      params_redacted_json TEXT NOT NULL,
      response_row_count INTEGER NOT NULL DEFAULT 0,
      prev_hash TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      CHECK (
        (channel = 'MCP' AND transport IN ('STREAMABLE_HTTP', 'STDIO') AND auth_mode IN ('SUPABASE_OAUTH21', 'LOCAL_DEV_TOKEN', 'LOCAL_STDIO', 'PRE_AUTH_UNVERIFIED'))
        OR (channel = 'ADMIN_PROVISIONING' AND transport = 'ADMIN_API' AND auth_mode = 'STAFF_SESSION')
      )
    );

    CREATE TRIGGER IF NOT EXISTS trg_mcp_audit_no_update
    BEFORE UPDATE ON mcp_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'mcp_audit_events is append-only; UPDATE prohibited');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mcp_audit_no_delete
    BEFORE DELETE ON mcp_audit_events
    BEGIN
      SELECT RAISE(ABORT, 'mcp_audit_events is append-only; DELETE prohibited');
    END;
  `);
}

export interface AuditHashV1Input {
  auditSchemaVersion: number;
  seq: number;
  eventId: string;
  occurredAt: string;
  channel: McpAuditChannel;
  transport: McpAuditTransport;
  authMode: McpAuditAuthMode;
  supabaseUid: string | null;
  oauthClientId: string | null;
  bindingId: string | null;
  actorId: string | null;
  role: string | null;
  ownerId: string | null;
  toolName: string;
  decision: 'ALLOWED' | 'DENIED';
  httpStatus: number;
  denialReason: string | null;
  paramsRedactedJson: string;
  responseRowCount: number;
  prevHash: string;
}

export function computeMcpAuditEventHashV1(fields: AuditHashV1Input): string {
  const canonicalPayload = JSON.stringify([
    fields.auditSchemaVersion,
    fields.seq,
    fields.eventId,
    fields.occurredAt,
    fields.channel,
    fields.transport,
    fields.authMode,
    fields.supabaseUid ?? null,
    fields.oauthClientId ?? null,
    fields.bindingId ?? null,
    fields.actorId ?? null,
    fields.role ?? null,
    fields.ownerId ?? null,
    fields.toolName,
    fields.decision,
    fields.httpStatus,
    fields.denialReason ?? null,
    fields.paramsRedactedJson,
    fields.responseRowCount,
    fields.prevHash,
  ]);
  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

export function appendMcpAuditEventTx(
  db: DatabaseSync,
  input: AppendMcpAuditInput,
  useOwnTransaction = true
): { seq: number; eventId: string; prevHash: string; eventHash: string } {
  if (useOwnTransaction) {
    db.exec('BEGIN IMMEDIATE;');
  }
  try {
    const latest = db
      .prepare('SELECT seq, event_hash FROM mcp_audit_events ORDER BY seq DESC LIMIT 1')
      .get() as { seq: number; event_hash: string } | undefined;

    const nextSeq = Number(latest?.seq || 0) + 1;
    const prevHash = latest?.event_hash || 'GENESIS';
    const eventId = `MCP-AUD-${String(nextSeq).padStart(6, '0')}`;
    const occurredAt = input.occurredAt || new Date().toISOString();
    const paramsRedactedJson = redactMcpParams(input.params ?? {});
    const responseRowCount = Math.max(0, Math.round(Number(input.responseRowCount || 0)));

    const hashFields: AuditHashV1Input = {
      auditSchemaVersion: 1,
      seq: nextSeq,
      eventId,
      occurredAt,
      channel: input.channel,
      transport: input.transport,
      authMode: input.authMode,
      supabaseUid: input.supabaseUid ?? null,
      oauthClientId: input.oauthClientId ?? null,
      bindingId: input.bindingId ?? null,
      actorId: input.actorId ?? null,
      role: input.role ?? null,
      ownerId: input.ownerId ?? null,
      toolName: input.toolName,
      decision: input.decision,
      httpStatus: input.httpStatus,
      denialReason: input.denialReason ?? null,
      paramsRedactedJson,
      responseRowCount,
      prevHash,
    };

    const eventHash = computeMcpAuditEventHashV1(hashFields);

    db.prepare(
      `INSERT INTO mcp_audit_events (
        seq, audit_schema_version, event_id, occurred_at, channel, transport, auth_mode,
        supabase_uid, oauth_client_id, binding_id, actor_id, role, owner_id,
        tool_name, decision, http_status, denial_reason, params_redacted_json,
        response_row_count, prev_hash, event_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      hashFields.seq,
      hashFields.auditSchemaVersion,
      hashFields.eventId,
      hashFields.occurredAt,
      hashFields.channel,
      hashFields.transport,
      hashFields.authMode,
      hashFields.supabaseUid,
      hashFields.oauthClientId,
      hashFields.bindingId,
      hashFields.actorId,
      hashFields.role,
      hashFields.ownerId,
      hashFields.toolName,
      hashFields.decision,
      hashFields.httpStatus,
      hashFields.denialReason,
      hashFields.paramsRedactedJson,
      hashFields.responseRowCount,
      hashFields.prevHash,
      eventHash
    );

    if (useOwnTransaction) {
      db.exec('COMMIT;');
    }
    return { seq: nextSeq, eventId, prevHash, eventHash };
  } catch (err) {
    if (useOwnTransaction) {
      db.exec('ROLLBACK;');
    }
    throw err;
  }
}

export function verifyMcpAuditChain(db: DatabaseSync): {
  valid: boolean;
  totalRows: number;
  brokenSeq?: number;
  reason?: string;
} {
  const rows = db
    .prepare('SELECT * FROM mcp_audit_events ORDER BY seq ASC')
    .all() as Array<Record<string, unknown>>;

  let expectedPrevHash = 'GENESIS';
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const seq = Number(r.seq);
    const schemaVer = Number(r.audit_schema_version);
    if (schemaVer !== 1) {
      return { valid: false, totalRows: rows.length, brokenSeq: seq, reason: 'Unsupported audit_schema_version' };
    }
    if (seq !== i + 1) {
      return { valid: false, totalRows: rows.length, brokenSeq: seq, reason: 'Non-contiguous seq detected' };
    }
    if (String(r.prev_hash) !== expectedPrevHash) {
      return { valid: false, totalRows: rows.length, brokenSeq: seq, reason: 'prev_hash link mismatch' };
    }

    const expectedHash = computeMcpAuditEventHashV1({
      auditSchemaVersion: schemaVer,
      seq,
      eventId: String(r.event_id),
      occurredAt: String(r.occurred_at),
      channel: String(r.channel) as McpAuditChannel,
      transport: String(r.transport) as McpAuditTransport,
      authMode: String(r.auth_mode) as McpAuditAuthMode,
      supabaseUid: r.supabase_uid == null ? null : String(r.supabase_uid),
      oauthClientId: r.oauth_client_id == null ? null : String(r.oauth_client_id),
      bindingId: r.binding_id == null ? null : String(r.binding_id),
      actorId: r.actor_id == null ? null : String(r.actor_id),
      role: r.role == null ? null : String(r.role),
      ownerId: r.owner_id == null ? null : String(r.owner_id),
      toolName: String(r.tool_name),
      decision: String(r.decision) as 'ALLOWED' | 'DENIED',
      httpStatus: Number(r.http_status),
      denialReason: r.denial_reason == null ? null : String(r.denial_reason),
      paramsRedactedJson: String(r.params_redacted_json),
      responseRowCount: Number(r.response_row_count),
      prevHash: String(r.prev_hash),
    });

    if (String(r.event_hash) !== expectedHash) {
      return { valid: false, totalRows: rows.length, brokenSeq: seq, reason: 'event_hash verification failed' };
    }
    expectedPrevHash = String(r.event_hash);
  }

  return { valid: true, totalRows: rows.length };
}

function mapBindingRow(row: Record<string, unknown>): McpActorBindingRow {
  let allowedOwners: string[] = [];
  let allowedTools: string[] = [];
  try {
    const parsedOwners = JSON.parse(String(row.allowed_owners_json || '[]'));
    if (Array.isArray(parsedOwners)) allowedOwners = parsedOwners.map(String);
  } catch {
    allowedOwners = [];
  }
  try {
    const parsedTools = JSON.parse(String(row.allowed_tools_json || '[]'));
    if (Array.isArray(parsedTools)) allowedTools = parsedTools.map(String);
  } catch {
    allowedTools = [];
  }

  return {
    id: String(row.id),
    supabaseUid: String(row.supabase_uid),
    oauthClientId: String(row.oauth_client_id),
    actorId: String(row.actor_id),
    role: String(row.role),
    allowedOwners,
    defaultOwnerId: row.default_owner_id == null ? null : String(row.default_owner_id),
    allowedTools,
    grantStatus: String(row.grant_status) as McpGrantStatus,
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
    provisionedBy: String(row.provisioned_by),
    approvedBy: row.approved_by == null ? null : String(row.approved_by),
    approvedAt: row.approved_at == null ? null : String(row.approved_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    expiresAt: row.expires_at == null ? null : String(row.expires_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
    revokedBy: row.revoked_by == null ? null : String(row.revoked_by),
    revocationReason: row.revocation_reason == null ? null : String(row.revocation_reason),
    tokenNotBefore: Number(row.token_not_before || 0),
  };
}

export function findMcpBindingBySubjectClient(
  db: DatabaseSync,
  supabaseUid: string,
  oauthClientId: string
): McpActorBindingRow | null {
  const row = db
    .prepare('SELECT * FROM mcp_actor_bindings WHERE supabase_uid = ? AND oauth_client_id = ?')
    .get(supabaseUid, oauthClientId) as Record<string, unknown> | undefined;
  return row ? mapBindingRow(row) : null;
}

export function findMcpBindingById(db: DatabaseSync, id: string): McpActorBindingRow | null {
  const row = db
    .prepare('SELECT * FROM mcp_actor_bindings WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapBindingRow(row) : null;
}

export function listMcpBindings(db: DatabaseSync): McpActorBindingRow[] {
  const rows = db
    .prepare('SELECT * FROM mcp_actor_bindings ORDER BY created_at DESC, id ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapBindingRow);
}

function validateCandidateBindingInputs(input: {
  targetActorId: string;
  allowedOwners: string[];
  defaultOwnerId: string | null;
  allowedTools: string[];
}): { ok: true; staffRole: string; normalizedOwners: string[]; normalizedTools: McpToolName[] } | { ok: false; code: string; message: string } {
  const staff = findStaffEntryByActorId(input.targetActorId);
  if (!staff) {
    return {
      ok: false,
      code: 'UNKNOWN_OR_NON_STAFF_ACTOR',
      message: `Actor "${input.targetActorId}" is not an active staff entry in canonical STAFF_DIRECTORY.`,
    };
  }

  if (!Array.isArray(input.allowedOwners) || input.allowedOwners.length === 0) {
    return {
      ok: false,
      code: 'EMPTY_OWNER_SCOPE',
      message: 'allowedOwners must contain at least one authorized synthetic owner ID.',
    };
  }

  const normalizedOwners = [...new Set(input.allowedOwners.map((o) => String(o).trim()))];
  for (const ownerId of normalizedOwners) {
    if (!(SYNTHETIC_OWNER_IDS as readonly string[]).includes(ownerId)) {
      return {
        ok: false,
        code: 'INVALID_SYNTHETIC_OWNER',
        message: `Owner ID "${ownerId}" is not a valid Phase 1 synthetic fixture owner.`,
      };
    }
    if (!staff.allowedOwners.includes(ownerId)) {
      return {
        ok: false,
        code: 'OWNER_SCOPE_EXCEEDS_DIRECTORY',
        message: `Role "${staff.role}" (${staff.actorId}) cannot be granted owner scope "${ownerId}".`,
      };
    }
  }

  if (input.defaultOwnerId !== null && !normalizedOwners.includes(input.defaultOwnerId)) {
    return {
      ok: false,
      code: 'DEFAULT_OWNER_OUTSIDE_SCOPE',
      message: `defaultOwnerId "${input.defaultOwnerId}" must be a member of allowedOwners.`,
    };
  }

  if (!Array.isArray(input.allowedTools)) {
    return {
      ok: false,
      code: 'INVALID_ALLOWED_TOOLS',
      message: 'allowedTools must be an explicit array of MCP tool names (default []).',
    };
  }

  const normalizedTools: McpToolName[] = [];
  for (const rawTool of input.allowedTools) {
    const tool = String(rawTool).trim();
    if (tool === '*') {
      return {
        ok: false,
        code: 'WILDCARD_TOOL_FORBIDDEN',
        message: 'Wildcard tool grants ("*") are prohibited.',
      };
    }
    if (!isMcpToolName(tool)) {
      return {
        ok: false,
        code: 'UNKNOWN_MCP_TOOL',
        message: `Unknown MCP tool "${tool}".`,
      };
    }
    if (getMcpToolDecision(staff.role, tool) === 'Deny') {
      return {
        ok: false,
        code: 'TOOL_PROHIBITED_FOR_ROLE',
        message: `Tool "${tool}" is Denied for role "${staff.role}" under canonical RBAC §8.2.`,
      };
    }
    if (!normalizedTools.includes(tool)) {
      normalizedTools.push(tool);
    }
  }

  return {
    ok: true,
    staffRole: staff.role,
    normalizedOwners,
    normalizedTools,
  };
}

export type GovernanceActionResult<T = McpActorBindingRow> =
  | { ok: true; status: number; binding?: T; auditSeq: number }
  | { ok: false; status: number; code: string; message: string; auditSeq: number };

export function createPendingMcpBinding(
  db: DatabaseSync,
  params: {
    makerActorId: string;
    makerRole: string;
    supabaseUid: string;
    oauthClientId: string;
    targetActorId: string;
    allowedOwners: string[];
    defaultOwnerId?: string | null;
    allowedTools?: string[];
    expiresAt?: string | null;
  }
): GovernanceActionResult {
  const supabaseUid = params.supabaseUid.trim();
  const oauthClientId = params.oauthClientId.trim();
  const targetActorId = params.targetActorId.trim();
  const allowedTools = params.allowedTools ?? [];
  const defaultOwnerId = params.defaultOwnerId ? params.defaultOwnerId.trim() : null;

  const failAudit = (status: number, code: string, message: string): GovernanceActionResult => {
    const audit = appendMcpAuditEventTx(db, {
      channel: 'ADMIN_PROVISIONING',
      transport: 'ADMIN_API',
      authMode: 'STAFF_SESSION',
      supabaseUid,
      oauthClientId,
      actorId: params.makerActorId,
      role: params.makerRole,
      toolName: 'PROVISION_REQUEST',
      decision: 'DENIED',
      httpStatus: status,
      denialReason: code,
      params: { targetActorId, allowedOwners: params.allowedOwners, allowedTools },
    });
    return { ok: false, status, code, message, auditSeq: audit.seq };
  };

  if (!MAKER_ROLES.has(params.makerRole)) {
    return failAudit(403, 'MAKER_ROLE_REQUIRED', 'Only System Administrator may initiate MCP binding candidates.');
  }
  if (!supabaseUid || !oauthClientId) {
    return failAudit(400, 'MISSING_SUBJECT_OR_CLIENT', 'supabaseUid and oauthClientId are required.');
  }
  if (params.makerActorId === targetActorId) {
    return failAudit(403, 'SELF_PROVISIONING_FORBIDDEN', 'Maker cannot provision an MCP binding for themselves.');
  }

  const validation = validateCandidateBindingInputs({
    targetActorId,
    allowedOwners: params.allowedOwners,
    defaultOwnerId,
    allowedTools,
  });
  if (!validation.ok) {
    return failAudit(400, validation.code, validation.message);
  }

  const existing = findMcpBindingBySubjectClient(db, supabaseUid, oauthClientId);
  if (existing && existing.grantStatus === 'PENDING') {
    return failAudit(409, 'PENDING_BINDING_EXISTS', 'A PENDING candidate already exists for this Supabase UID and OAuth client.');
  }
  if (existing && existing.grantStatus === 'ACTIVE') {
    return failAudit(409, 'ACTIVE_BINDING_EXISTS', 'An ACTIVE binding already exists for this Supabase UID and OAuth client.');
  }

  const now = new Date().toISOString();
  const bindingId = `BIND-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  db.exec('BEGIN IMMEDIATE;');
  try {
    if (existing) {
      db.prepare('DELETE FROM mcp_actor_bindings WHERE id = ?').run(existing.id);
    }

    db.prepare(
      `INSERT INTO mcp_actor_bindings (
        id, supabase_uid, oauth_client_id, actor_id, role,
        allowed_owners_json, default_owner_id, allowed_tools_json,
        grant_status, created_at, created_by, provisioned_by,
        approved_by, approved_at, updated_by, updated_at, expires_at,
        token_not_before
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`
    ).run(
      bindingId,
      supabaseUid,
      oauthClientId,
      targetActorId,
      validation.staffRole,
      JSON.stringify(validation.normalizedOwners),
      defaultOwnerId,
      JSON.stringify(validation.normalizedTools),
      now,
      params.makerActorId,
      params.makerActorId,
      params.makerActorId,
      now,
      params.expiresAt || null,
      existing ? existing.tokenNotBefore : 0
    );

    const audit = appendMcpAuditEventTx(
      db,
      {
        occurredAt: now,
        channel: 'ADMIN_PROVISIONING',
        transport: 'ADMIN_API',
        authMode: 'STAFF_SESSION',
        supabaseUid,
        oauthClientId,
        bindingId,
        actorId: params.makerActorId,
        role: params.makerRole,
        ownerId: defaultOwnerId,
        toolName: 'PROVISION_REQUEST',
        decision: 'ALLOWED',
        httpStatus: 201,
        params: {
          targetActorId,
          targetRole: validation.staffRole,
          allowedOwners: validation.normalizedOwners,
          allowedTools: validation.normalizedTools,
        },
        responseRowCount: 1,
      },
      false
    );

    db.exec('COMMIT;');
    const created = findMcpBindingById(db, bindingId)!;
    return { ok: true, status: 201, binding: created, auditSeq: audit.seq };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function approveMcpBinding(
  db: DatabaseSync,
  params: {
    bindingId: string;
    checkerActorId: string;
    checkerRole: string;
    checkerSupabaseUid?: string;
  }
): GovernanceActionResult {
  const existing = findMcpBindingById(db, params.bindingId);

  const failAudit = (status: number, code: string, message: string): GovernanceActionResult => {
    const audit = appendMcpAuditEventTx(db, {
      channel: 'ADMIN_PROVISIONING',
      transport: 'ADMIN_API',
      authMode: 'STAFF_SESSION',
      supabaseUid: existing?.supabaseUid ?? null,
      oauthClientId: existing?.oauthClientId ?? null,
      bindingId: params.bindingId,
      actorId: params.checkerActorId,
      role: params.checkerRole,
      toolName: 'PROVISION_APPROVE',
      decision: 'DENIED',
      httpStatus: status,
      denialReason: code,
      params: { bindingId: params.bindingId },
    });
    return { ok: false, status, code, message, auditSeq: audit.seq };
  };

  if (!CHECKER_ROLES.has(params.checkerRole)) {
    return failAudit(403, 'CHECKER_ROLE_REQUIRED', 'Only General Manager or Owner / Director may approve MCP bindings.');
  }
  if (!existing) {
    return failAudit(404, 'BINDING_NOT_FOUND', 'MCP binding candidate not found.');
  }
  if (existing.grantStatus !== 'PENDING') {
    return failAudit(409, 'BINDING_NOT_PENDING', `Binding is "${existing.grantStatus}", expected PENDING.`);
  }
  if (params.checkerActorId === existing.provisionedBy) {
    return failAudit(403, 'MAKER_CHECKER_SOD_VIOLATION', 'Checker cannot approve a binding they provisioned.');
  }
  if (params.checkerActorId === existing.actorId) {
    return failAudit(403, 'SELF_APPROVAL_FORBIDDEN', 'Checker cannot approve their own MCP binding.');
  }
  if (params.checkerSupabaseUid && params.checkerSupabaseUid === existing.supabaseUid) {
    return failAudit(403, 'SELF_UID_APPROVAL_FORBIDDEN', 'Checker Supabase UID matches target binding UID.');
  }

  // Re-validate against STAFF_DIRECTORY & RBAC §8.2 before atomic transition
  const recheck = validateCandidateBindingInputs({
    targetActorId: existing.actorId,
    allowedOwners: existing.allowedOwners,
    defaultOwnerId: existing.defaultOwnerId,
    allowedTools: existing.allowedTools,
  });
  if (!recheck.ok || recheck.staffRole !== existing.role) {
    return failAudit(400, recheck.ok ? 'ROLE_DIRECTORY_MISMATCH' : recheck.code, recheck.ok ? 'Binding role no longer matches STAFF_DIRECTORY.' : recheck.message);
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const info = db
      .prepare(
        `UPDATE mcp_actor_bindings
         SET grant_status = 'ACTIVE',
             approved_by = ?,
             approved_at = ?,
             updated_by = ?,
             updated_at = ?
         WHERE id = ? AND grant_status = 'PENDING'`
      )
      .run(params.checkerActorId, now, params.checkerActorId, now, existing.id);

    if (info.changes !== 1) {
      db.exec('ROLLBACK;');
      return failAudit(409, 'CONCURRENT_STATE_CHANGE', 'Binding is no longer PENDING.');
    }

    const audit = appendMcpAuditEventTx(
      db,
      {
        occurredAt: now,
        channel: 'ADMIN_PROVISIONING',
        transport: 'ADMIN_API',
        authMode: 'STAFF_SESSION',
        supabaseUid: existing.supabaseUid,
        oauthClientId: existing.oauthClientId,
        bindingId: existing.id,
        actorId: params.checkerActorId,
        role: params.checkerRole,
        ownerId: existing.defaultOwnerId,
        toolName: 'PROVISION_APPROVE',
        decision: 'ALLOWED',
        httpStatus: 200,
        params: {
          bindingId: existing.id,
          targetActorId: existing.actorId,
          allowedTools: existing.allowedTools,
        },
        responseRowCount: 1,
      },
      false
    );

    db.exec('COMMIT;');
    const updated = findMcpBindingById(db, existing.id)!;
    return { ok: true, status: 200, binding: updated, auditSeq: audit.seq };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function rejectPendingMcpBinding(
  db: DatabaseSync,
  params: {
    bindingId: string;
    checkerActorId: string;
    checkerRole: string;
    reason?: string;
  }
): GovernanceActionResult {
  const existing = findMcpBindingById(db, params.bindingId);
  const failAudit = (status: number, code: string, message: string): GovernanceActionResult => {
    const audit = appendMcpAuditEventTx(db, {
      channel: 'ADMIN_PROVISIONING',
      transport: 'ADMIN_API',
      authMode: 'STAFF_SESSION',
      supabaseUid: existing?.supabaseUid ?? null,
      oauthClientId: existing?.oauthClientId ?? null,
      bindingId: params.bindingId,
      actorId: params.checkerActorId,
      role: params.checkerRole,
      toolName: 'PROVISION_REJECT',
      decision: 'DENIED',
      httpStatus: status,
      denialReason: code,
      params: { bindingId: params.bindingId },
    });
    return { ok: false, status, code, message, auditSeq: audit.seq };
  };

  if (!CHECKER_ROLES.has(params.checkerRole)) {
    return failAudit(403, 'CHECKER_ROLE_REQUIRED', 'Only General Manager or Owner / Director may reject PENDING bindings.');
  }
  if (!existing) {
    return failAudit(404, 'BINDING_NOT_FOUND', 'MCP binding candidate not found.');
  }
  if (existing.grantStatus !== 'PENDING') {
    return failAudit(409, 'BINDING_NOT_PENDING', 'Only PENDING bindings can be rejected.');
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare("DELETE FROM mcp_actor_bindings WHERE id = ? AND grant_status = 'PENDING'").run(existing.id);
    const audit = appendMcpAuditEventTx(
      db,
      {
        occurredAt: now,
        channel: 'ADMIN_PROVISIONING',
        transport: 'ADMIN_API',
        authMode: 'STAFF_SESSION',
        supabaseUid: existing.supabaseUid,
        oauthClientId: existing.oauthClientId,
        bindingId: existing.id,
        actorId: params.checkerActorId,
        role: params.checkerRole,
        toolName: 'PROVISION_REJECT',
        decision: 'ALLOWED',
        httpStatus: 200,
        params: {
          bindingId: existing.id,
          targetActorId: existing.actorId,
          reasonCategory: sanitizeMcpText(params.reason || 'Checker rejected draft', 80),
        },
        responseRowCount: 1,
      },
      false
    );
    db.exec('COMMIT;');
    return { ok: true, status: 200, auditSeq: audit.seq };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function requestMcpBindingScopeUpdate(
  db: DatabaseSync,
  params: {
    bindingId: string;
    makerActorId: string;
    makerRole: string;
    allowedOwners: string[];
    defaultOwnerId?: string | null;
    allowedTools: string[];
    expiresAt?: string | null;
  }
): GovernanceActionResult {
  const existing = findMcpBindingById(db, params.bindingId);
  const defaultOwnerId = params.defaultOwnerId ? params.defaultOwnerId.trim() : null;

  const failAudit = (status: number, code: string, message: string): GovernanceActionResult => {
    const audit = appendMcpAuditEventTx(db, {
      channel: 'ADMIN_PROVISIONING',
      transport: 'ADMIN_API',
      authMode: 'STAFF_SESSION',
      supabaseUid: existing?.supabaseUid ?? null,
      oauthClientId: existing?.oauthClientId ?? null,
      bindingId: params.bindingId,
      actorId: params.makerActorId,
      role: params.makerRole,
      toolName: 'BINDING_UPDATE',
      decision: 'DENIED',
      httpStatus: status,
      denialReason: code,
      params: { bindingId: params.bindingId, allowedTools: params.allowedTools },
    });
    return { ok: false, status, code, message, auditSeq: audit.seq };
  };

  if (!MAKER_ROLES.has(params.makerRole)) {
    return failAudit(403, 'MAKER_ROLE_REQUIRED', 'Only System Administrator may submit MCP scope/tool updates.');
  }
  if (!existing) {
    return failAudit(404, 'BINDING_NOT_FOUND', 'MCP binding not found.');
  }
  if (params.makerActorId === existing.actorId) {
    return failAudit(403, 'SELF_ESCALATION_FORBIDDEN', 'Actor cannot modify or expand their own MCP binding.');
  }

  const validation = validateCandidateBindingInputs({
    targetActorId: existing.actorId,
    allowedOwners: params.allowedOwners,
    defaultOwnerId,
    allowedTools: params.allowedTools,
  });
  if (!validation.ok) {
    return failAudit(400, validation.code, validation.message);
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(
      `UPDATE mcp_actor_bindings
       SET allowed_owners_json = ?,
           default_owner_id = ?,
           allowed_tools_json = ?,
           expires_at = ?,
           grant_status = 'PENDING',
           provisioned_by = ?,
           approved_by = NULL,
           approved_at = NULL,
           updated_by = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      JSON.stringify(validation.normalizedOwners),
      defaultOwnerId,
      JSON.stringify(validation.normalizedTools),
      params.expiresAt ?? existing.expiresAt,
      params.makerActorId,
      params.makerActorId,
      now,
      existing.id
    );

    const audit = appendMcpAuditEventTx(
      db,
      {
        occurredAt: now,
        channel: 'ADMIN_PROVISIONING',
        transport: 'ADMIN_API',
        authMode: 'STAFF_SESSION',
        supabaseUid: existing.supabaseUid,
        oauthClientId: existing.oauthClientId,
        bindingId: existing.id,
        actorId: params.makerActorId,
        role: params.makerRole,
        ownerId: defaultOwnerId,
        toolName: 'BINDING_UPDATE',
        decision: 'ALLOWED',
        httpStatus: 200,
        params: {
          bindingId: existing.id,
          reRequiresCheckerApproval: true,
          allowedOwners: validation.normalizedOwners,
          allowedTools: validation.normalizedTools,
        },
        responseRowCount: 1,
      },
      false
    );

    db.exec('COMMIT;');
    return { ok: true, status: 200, binding: findMcpBindingById(db, existing.id)!, auditSeq: audit.seq };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function revokeMcpBindingById(
  db: DatabaseSync,
  params: {
    bindingId: string;
    revokerActorId: string;
    revokerRole: string;
    reason?: string;
    nowEpochSec?: number;
  }
): GovernanceActionResult {
  const existing = findMcpBindingById(db, params.bindingId);
  const failAudit = (status: number, code: string, message: string): GovernanceActionResult => {
    const audit = appendMcpAuditEventTx(db, {
      channel: 'ADMIN_PROVISIONING',
      transport: 'ADMIN_API',
      authMode: 'STAFF_SESSION',
      supabaseUid: existing?.supabaseUid ?? null,
      oauthClientId: existing?.oauthClientId ?? null,
      bindingId: params.bindingId,
      actorId: params.revokerActorId,
      role: params.revokerRole,
      toolName: 'BINDING_REVOKE',
      decision: 'DENIED',
      httpStatus: status,
      denialReason: code,
      params: { bindingId: params.bindingId },
    });
    return { ok: false, status, code, message, auditSeq: audit.seq };
  };

  if (!REVOKER_ROLES.has(params.revokerRole)) {
    return failAudit(403, 'REVOKE_ROLE_REQUIRED', 'Role is not authorized to revoke MCP bindings.');
  }
  if (!existing) {
    return failAudit(404, 'BINDING_NOT_FOUND', 'MCP binding not found.');
  }

  const now = new Date().toISOString();
  const epochSec = params.nowEpochSec ?? Math.floor(Date.now() / 1000);
  const safeReason = sanitizeMcpText(params.reason || 'Administrative revocation', 120);

  db.exec('BEGIN IMMEDIATE;');
  try {
    if (existing.grantStatus === 'PENDING') {
      db.prepare('DELETE FROM mcp_actor_bindings WHERE id = ?').run(existing.id);
    } else {
      db.prepare(
        `UPDATE mcp_actor_bindings
         SET grant_status = 'REVOKED',
             revoked_at = ?,
             revoked_by = ?,
             revocation_reason = ?,
             updated_by = ?,
             updated_at = ?,
             token_not_before = MAX(token_not_before, ?)
         WHERE id = ?`
      ).run(now, params.revokerActorId, safeReason, params.revokerActorId, now, epochSec, existing.id);
    }

    const audit = appendMcpAuditEventTx(
      db,
      {
        occurredAt: now,
        channel: 'ADMIN_PROVISIONING',
        transport: 'ADMIN_API',
        authMode: 'STAFF_SESSION',
        supabaseUid: existing.supabaseUid,
        oauthClientId: existing.oauthClientId,
        bindingId: existing.id,
        actorId: params.revokerActorId,
        role: params.revokerRole,
        toolName: 'BINDING_REVOKE',
        decision: 'ALLOWED',
        httpStatus: 200,
        params: { bindingId: existing.id, scope: 'GRANT', epochCutoff: epochSec },
        responseRowCount: 1,
      },
      false
    );

    db.exec('COMMIT;');
    const after = findMcpBindingById(db, existing.id);
    return { ok: true, status: 200, binding: after ?? undefined, auditSeq: audit.seq };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function revokeMcpByClientOrUser(
  db: DatabaseSync,
  params: {
    targetType: 'CLIENT' | 'USER';
    targetValue: string;
    revokerActorId: string;
    revokerRole: string;
    reason?: string;
    nowEpochSec?: number;
  }
): { ok: true; affectedCount: number; auditSeq: number } | { ok: false; status: number; code: string; message: string; auditSeq: number } {
  if (!REVOKER_ROLES.has(params.revokerRole)) {
    const audit = appendMcpAuditEventTx(db, {
      channel: 'ADMIN_PROVISIONING',
      transport: 'ADMIN_API',
      authMode: 'STAFF_SESSION',
      actorId: params.revokerActorId,
      role: params.revokerRole,
      toolName: 'BINDING_REVOKE',
      decision: 'DENIED',
      httpStatus: 403,
      denialReason: 'REVOKE_ROLE_REQUIRED',
      params: { scope: params.targetType },
    });
    return { ok: false, status: 403, code: 'REVOKE_ROLE_REQUIRED', message: 'Role cannot revoke MCP bindings.', auditSeq: audit.seq };
  }

  const now = new Date().toISOString();
  const epochSec = params.nowEpochSec ?? Math.floor(Date.now() / 1000);
  const safeReason = sanitizeMcpText(params.reason || `${params.targetType} level revocation`, 120);
  const whereCol = params.targetType === 'CLIENT' ? 'oauth_client_id' : 'supabase_uid';

  db.exec('BEGIN IMMEDIATE;');
  try {
    const delInfo = db
      .prepare(`DELETE FROM mcp_actor_bindings WHERE ${whereCol} = ? AND grant_status = 'PENDING'`)
      .run(params.targetValue);
    const updInfo = db
      .prepare(
        `UPDATE mcp_actor_bindings
         SET grant_status = 'REVOKED',
             revoked_at = ?,
             revoked_by = ?,
             revocation_reason = ?,
             updated_by = ?,
             updated_at = ?,
             token_not_before = MAX(token_not_before, ?)
         WHERE ${whereCol} = ? AND grant_status <> 'PENDING'`
      )
      .run(now, params.revokerActorId, safeReason, params.revokerActorId, now, epochSec, params.targetValue);

    const affectedCount = Number(delInfo.changes || 0) + Number(updInfo.changes || 0);
    const audit = appendMcpAuditEventTx(
      db,
      {
        occurredAt: now,
        channel: 'ADMIN_PROVISIONING',
        transport: 'ADMIN_API',
        authMode: 'STAFF_SESSION',
        supabaseUid: params.targetType === 'USER' ? params.targetValue : null,
        oauthClientId: params.targetType === 'CLIENT' ? params.targetValue : null,
        actorId: params.revokerActorId,
        role: params.revokerRole,
        toolName: 'BINDING_REVOKE',
        decision: 'ALLOWED',
        httpStatus: 200,
        params: { scope: params.targetType, epochCutoff: epochSec, affectedCount },
        responseRowCount: affectedCount,
      },
      false
    );
    db.exec('COMMIT;');
    return { ok: true, affectedCount, auditSeq: audit.seq };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function queryMcpAuditSummary(
  db: DatabaseSync,
  opts: {
    ownerId?: string | null;
    channel?: string | null;
    decision?: string | null;
    limit?: number;
    offset?: number;
  }
): {
  auditStream: 'MCP_SERVER_ONLY';
  totalCount: number;
  latestSeq: number;
  latestEventHash: string;
  countsByDecision: { ALLOWED: number; DENIED: number };
  recentEvents: McpAuditSummaryEvent[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
} {
  const limit = Math.max(1, Math.min(50, Number(opts.limit ?? 25)));
  const offset = Math.max(0, Number(opts.offset ?? 0));

  const conditions: string[] = [];
  const args: Array<string | number> = [];

  if (opts.ownerId) {
    // Allow owner-specific events plus pre-auth/system events only if no cross-owner leakage:
    // strict isolation returns rows explicitly matching ownerId (or non-owner-scoped system/auth rows when allowedOwners has both)
    conditions.push('(owner_id = ?)');
    args.push(opts.ownerId);
  }
  if (opts.channel && (opts.channel === 'MCP' || opts.channel === 'ADMIN_PROVISIONING')) {
    conditions.push('channel = ?');
    args.push(opts.channel);
  }
  if (opts.decision && (opts.decision === 'ALLOWED' || opts.decision === 'DENIED')) {
    conditions.push('decision = ?');
    args.push(opts.decision);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM mcp_audit_events ${whereClause}`)
    .get(...args) as { cnt: number };
  const totalCount = Number(totalRow?.cnt || 0);

  const allowedRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM mcp_audit_events ${
        conditions.length > 0 ? `${whereClause} AND decision = 'ALLOWED'` : "WHERE decision = 'ALLOWED'"
      }`
    )
    .get(...args) as { cnt: number };
  const deniedRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM mcp_audit_events ${
        conditions.length > 0 ? `${whereClause} AND decision = 'DENIED'` : "WHERE decision = 'DENIED'"
      }`
    )
    .get(...args) as { cnt: number };

  const latestRow = db
    .prepare('SELECT seq, event_hash FROM mcp_audit_events ORDER BY seq DESC LIMIT 1')
    .get() as { seq: number; event_hash: string } | undefined;

  const rows = db
    .prepare(
      `SELECT event_id, seq, occurred_at, channel, transport, auth_mode, actor_id, role, owner_id, tool_name, decision, http_status, denial_reason
       FROM mcp_audit_events ${whereClause}
       ORDER BY seq DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, limit, offset) as Array<Record<string, unknown>>;

  const recentEvents: McpAuditSummaryEvent[] = rows.map((r) => ({
    id: String(r.event_id),
    seq: Number(r.seq),
    timestamp: String(r.occurred_at),
    channel: String(r.channel) as McpAuditChannel,
    transport: String(r.transport) as McpAuditTransport,
    authMode: String(r.auth_mode) as McpAuditAuthMode,
    actorId: r.actor_id == null ? null : String(r.actor_id),
    role: r.role == null ? null : sanitizeMcpText(r.role, 80),
    ownerId: r.owner_id == null ? null : String(r.owner_id),
    toolName: String(r.tool_name),
    decision: String(r.decision) as 'ALLOWED' | 'DENIED',
    httpStatus: Number(r.http_status),
    denialReason: r.denial_reason == null ? null : sanitizeMcpText(r.denial_reason, 80),
  }));

  return {
    auditStream: 'MCP_SERVER_ONLY',
    totalCount,
    latestSeq: Number(latestRow?.seq || 0),
    latestEventHash: latestRow?.event_hash || 'GENESIS',
    countsByDecision: {
      ALLOWED: Number(allowedRow?.cnt || 0),
      DENIED: Number(deniedRow?.cnt || 0),
    },
    recentEvents,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + recentEvents.length < totalCount,
    },
  };
}
