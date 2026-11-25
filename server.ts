import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { LRUCache } from 'lru-cache';
import { WebSocketServer, WebSocket } from 'ws';
import { registerMcpAdminRoutes, registerMcpInternalRoutes } from './server/mcpRoutes.ts';
import {
  type ArifPayServerSession,
  OfficeSqliteStore,
  type SyncEventPayload,
} from './server/officeStore.ts';
import {
  authenticateOfficeCredential,
  buildClaimsFromDirectory,
  extractOfficeSessionFromHeaders,
  findDirectoryEntryByUsername,
  OFFICE_SESSION_COOKIE_NAME,
  type OfficeSessionClaims,
  resolveAllowedViteHosts,
  resolveBindHost,
  resolveListenPort,
  signOfficeSessionToken,
  verifyArifPayWebhookSignature,
  verifyTelebirrWebhookSignature,
} from './server/security.ts';
import { createInitialSeedState } from './src/data/seedData.ts';

interface AuthedRequest extends Request {
  officeSession?: OfficeSessionClaims;
  rawBody?: string;
}

const PORT = resolveListenPort();
const BIND_HOST = resolveBindHost();
const isProduction = process.env.NODE_ENV === 'production';

// Bounded LRU replay guard (max 5000 keys, 10-minute TTL)
const seenWebhookReplayKeys = new LRUCache<string, true>({
  max: 5000,
  ttl: 10 * 60 * 1000,
});

function appendSessionCookie(res: Response, req: Request, token: string): void {
  const isHttps =
    req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const parts = [
    `${OFFICE_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${4 * 60 * 60}`,
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response, req?: Request): void {
  const isHttps = Boolean(
    req && (req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https')
  );
  const parts = [
    `${OFFICE_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireOfficeAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const claims = extractOfficeSessionFromHeaders(req.headers);
  if (!claims) {
    res.status(401).json({
      error: true,
      msg: 'Authentication required for AD-PRMS Training Server endpoints.',
    });
    return;
  }
  req.officeSession = claims;
  next();
}

function isOwnerAllowed(claims: OfficeSessionClaims, ownerId: string): boolean {
  return claims.allowedOwners.includes(ownerId);
}

function canMutateStaffLedgerOrState(claims: OfficeSessionClaims): boolean {
  if (claims.sessionType !== 'staff') return false;
  if (claims.role === 'Auditor / Read-only reviewer') return false;
  return true;
}

function maskMsisdn(msisdn: string): string {
  if (!msisdn || msisdn.length <= 6) return '***';
  return `${msisdn.slice(0, 5)}****${msisdn.slice(-2)}`;
}

export async function createTrainingServerApp(options?: {
  dataDir?: string;
  dbPath?: string;
  attachVite?: boolean;
  authRateLimitMax?: number;
  mcpBridge?: {
    getPrimarySecret?: () => string;
    getPreviousSecret?: () => string;
    allowNonLoopbackForTests?: boolean;
  };
}) {
  const store = new OfficeSqliteStore(
    options?.dataDir || path.resolve(import.meta.dirname, '.data'),
    options?.dbPath ?? process.env.OFFICE_DB_PATH
  );
  store.ensureSyntheticSeedInitialized(
    () => createInitialSeedState() as unknown as Record<string, unknown>,
    isProduction
  );

  const app = express();
  app.set('trust proxy', 1);

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: options?.authRateLimitMax ?? (isProduction ? 10 : 100),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, msg: 'Too many authentication attempts. Please retry later.' },
  });

  const mutationRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, msg: 'Rate limit exceeded for API mutation endpoint.' },
  });

  app.use((req, res, next) => {
    res.setHeader('X-ADPRMS-Mode', 'TRAINING-SYNTHETIC-ONLY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:; object-src 'none'; base-uri 'self'"
    );

    // Enforce Origin match for cookie-authenticated mutations when Origin header is present
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      req.headers.cookie &&
      req.headers.origin &&
      !req.path.startsWith('/api/webhooks/')
    ) {
      const origin = String(req.headers.origin);
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
      const allowedOrigins = new Set<string>();
      if (host) {
        allowedOrigins.add(`http://${host}`);
        allowedOrigins.add(`https://${host}`);
      }
      if (process.env.APP_URL) {
        try {
          allowedOrigins.add(new URL(process.env.APP_URL).origin);
        } catch {
          // Ignore invalid APP_URL
        }
      }
      if (!allowedOrigins.has(origin)) {
        res.status(403).json({ error: true, msg: 'Cross-origin state mutation blocked.' });
        return;
      }
    }

    next();
  });

  // Raw binary route for local evidence uploads (authenticated before reading/writing disk)
  app.post(
    '/api/office/uploads',
    mutationRateLimiter,
    requireOfficeAuth,
    express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      limit: '11mb',
    }),
    (req: AuthedRequest, res: Response) => {
      const claims = req.officeSession!;
      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim();
      const rawName = String(req.headers['x-file-name'] || 'evidence');
      let filename: string;
      try {
        filename = decodeURIComponent(rawName);
      } catch {
        filename = rawName;
      }
      const ownerId = String(req.headers['x-owner-id'] || claims.defaultOwnerId);
      if (!isOwnerAllowed(claims, ownerId)) {
        res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
        return;
      }
      if (claims.role === 'Auditor / Read-only reviewer') {
        res.status(403).json({ error: true, msg: 'Auditor role is strictly read-only.' });
        return;
      }
      const entityType = String(req.headers['x-entity-type'] || 'GENERAL');
      const entityRefId = String(req.headers['x-entity-ref-id'] || '');

      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: true, msg: 'Binary file body is required.' });
        return;
      }

      const saved = store.saveUploadedFile({
        ownerId,
        entityType,
        entityRefId,
        filename,
        mimeType,
        buffer: req.body,
      });

      if (!saved.ok) {
        res.status(400).json({ error: true, msg: saved.error });
        return;
      }

      res.status(200).json({
        ok: true,
        fileId: saved.file.fileId,
        objectKey: `office-vault/${saved.file.ownerId.toLowerCase()}/${saved.file.fileId}`,
        url: `/api/office/uploads/${saved.file.fileId}`,
        filename: saved.file.filename,
        mimeType: saved.file.mimeType,
        sizeBytes: saved.file.sizeBytes,
        sha256: saved.file.sha256,
        createdAt: saved.file.createdAt,
      });
    }
  );

  // Mounted BEFORE global express.json() so rawBodyBytes HMAC verification runs pre-parse (ERR-3.1-04)
  registerMcpInternalRoutes(app, store, options?.mcpBridge);

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as AuthedRequest).rawBody = buf.toString('utf8');
      },
    })
  );

  registerMcpAdminRoutes(app, store, requireOfficeAuth);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/ws') {
      const claims = extractOfficeSessionFromHeaders(req.headers);
      if (!claims) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        (ws as WebSocket & { officeSession?: OfficeSessionClaims }).officeSession = claims;
        wss.emit('connection', ws, req);
      });
    }
  });

  const broadcastSyncEvent = (event: SyncEventPayload) => {
    const inserted = store.recordSyncEvent(event);
    if (!inserted) return;

    const encoded = JSON.stringify({ kind: 'sync:event', event });
    wss.clients.forEach((client) => {
      const clientClaims = (client as WebSocket & { officeSession?: OfficeSessionClaims }).officeSession;
      if (
        client.readyState === WebSocket.OPEN &&
        clientClaims &&
        isOwnerAllowed(clientClaims, event.ownerId)
      ) {
        client.send(encoded);
      }
    });
  };

  wss.on('connection', (ws) => {
    const clientClaims = (ws as WebSocket & { officeSession?: OfficeSessionClaims }).officeSession;
    const recentEvents = store
      .getRecentSyncEvents(20)
      .filter((ev) => (clientClaims ? isOwnerAllowed(clientClaims, ev.ownerId) : false));

    ws.send(
      JSON.stringify({
        kind: 'sync:hello',
        serverTime: new Date().toISOString(),
        connectedClients: wss.clients.size,
        recentEvents,
      })
    );

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw)) as {
          kind?: string;
          event?: SyncEventPayload;
        };
        if (parsed.kind === 'sync:publish' && parsed.event && parsed.event.eventId) {
          if (clientClaims && !isOwnerAllowed(clientClaims, parsed.event.ownerId)) {
            return;
          }
          broadcastSyncEvent(parsed.event);
          ws.send(JSON.stringify({ kind: 'sync:ack', eventId: parsed.event.eventId }));
        }
      } catch {
        // Ignore malformed socket frames cleanly
      }
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'TRAINING-SYNTHETIC-ONLY',
      runtime: 'AD-PRMS Training & Office Simulator (SQLite)',
      authRequired: true,
      sqlite: true,
      timestamp: new Date().toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // Training Server Session Authentication (HttpOnly Signed Cookie)
  // --------------------------------------------------------------------------
  app.get('/api/office/auth/session', (req, res) => {
    const claims = extractOfficeSessionFromHeaders(req.headers);
    if (!claims) {
      res.status(200).json({ ok: true, authenticated: false, session: null });
      return;
    }
    res.status(200).json({ ok: true, authenticated: true, session: claims });
  });

  app.post('/api/office/auth/login', authRateLimiter, (req, res) => {
    const body = (req.body || {}) as { username?: string; password?: string };
    const matched = authenticateOfficeCredential(
      String(body.username || ''),
      String(body.password || '')
    );
    if (!matched) {
      res.status(401).json({
        error: true,
        msg: 'Invalid training simulator username or password.',
      });
      return;
    }
    const claims = buildClaimsFromDirectory(matched);
    const token = signOfficeSessionToken(claims);
    appendSessionCookie(res, req, token);
    res.status(200).json({
      ok: true,
      authenticated: true,
      session: claims,
    });
  });

  app.post('/api/office/auth/logout', (req, res) => {
    clearSessionCookie(res, req);
    res.status(200).json({ ok: true, authenticated: false });
  });

  // --------------------------------------------------------------------------
  // Persistent Office SQLite State API (Authenticated & Server-Role Authorized)
  // --------------------------------------------------------------------------
  app.get('/api/office/state', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (claims.sessionType !== 'staff') {
      res.status(403).json({ error: true, msg: 'Workspace state retrieval is restricted to staff training sessions.' });
      return;
    }
    res.json(store.getWorkspaceState());
  });

  app.put('/api/office/state', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (!canMutateStaffLedgerOrState(claims)) {
      res.status(403).json({
        error: true,
        msg: `Role "${claims.role}" is read-only and cannot modify SQLite workspace state.`,
      });
      return;
    }
    const body = (req.body || {}) as {
      state?: Record<string, unknown>;
      onlyIfUninitialized?: boolean;
      expectedRevision?: number;
      originClientId?: string;
      ownerId?: string;
    };
    const requestedOwner = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, requestedOwner)) {
      res.status(403).json({ error: true, msg: `Forbidden cross-owner state write (${requestedOwner}).` });
      return;
    }
    if (!body.state || typeof body.state !== 'object') {
      res.status(400).json({ error: true, msg: 'Valid state object is required.' });
      return;
    }

    const saved = store.saveWorkspaceState(
      body.state,
      claims.username,
      Boolean(body.onlyIfUninitialized),
      typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined
    );

    if (saved.conflict) {
      res.status(409).json({
        error: true,
        conflict: true,
        currentRevision: saved.revision,
        updatedAt: saved.updatedAt,
        msg: 'Workspace revision conflict. Reload latest SQLite state before saving.',
      });
      return;
    }

    if (!saved.reusedExisting) {
      broadcastSyncEvent({
        eventId: `EVT-STATE-${saved.revision}-${Date.now()}`,
        type: 'state:synced',
        ownerId: requestedOwner,
        originClientId: body.originClientId,
        timestamp: saved.updatedAt,
        data: { revision: saved.revision, updatedBy: claims.username },
      });
    }

    res.json({
      ok: true,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
      reusedExisting: saved.reusedExisting,
    });
  });

  app.post('/api/office/reset', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    // Derive trainer authority strictly from verified server session cookie — never request headers or body.
    if (claims.role !== 'Training Coordinator' || !claims.isTrainer) {
      res.status(403).json({
        error: true,
        msg: 'Seed reset is restricted to authenticated Training Coordinator sessions.',
      });
      return;
    }
    const body = (req.body || {}) as {
      state?: Record<string, unknown>;
      originClientId?: string;
      ownerId?: string;
    };
    const requestedOwner = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, requestedOwner)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope for reset (${requestedOwner}).` });
      return;
    }
    if (!body.state || typeof body.state !== 'object') {
      res.status(400).json({ error: true, msg: 'Initial seed state is required for reset.' });
      return;
    }
    const saved = store.resetWorkspaceState(body.state, claims.username);
    broadcastSyncEvent({
      eventId: `EVT-RESET-${saved.revision}-${Date.now()}`,
      type: 'state:reset',
      ownerId: requestedOwner,
      originClientId: body.originClientId,
      timestamp: saved.updatedAt,
      data: { revision: saved.revision, resetBy: claims.username },
    });
    res.json({ ok: true, revision: saved.revision, updatedAt: saved.updatedAt });
  });

  // --------------------------------------------------------------------------
  // Normalized Double-Entry Ledger API (SQLite Training Sandbox)
  // --------------------------------------------------------------------------
  app.get('/api/office/ledger/summary', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const ownerId = String(req.query.ownerId || req.headers['x-owner-id'] || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    res.json(store.getLedgerSummary(ownerId));
  });

  app.get('/api/office/ledger/accounts', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const ownerId = String(req.query.ownerId || req.headers['x-owner-id'] || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    res.json({ ok: true, ownerId, accounts: store.listLedgerAccountsSql(ownerId) });
  });

  app.get('/api/office/ledger/journals', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const ownerId = String(req.query.ownerId || req.headers['x-owner-id'] || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const accountCodePrefix = req.query.accountPrefix ? String(req.query.accountPrefix) : undefined;
    const periodCode = req.query.periodCode ? String(req.query.periodCode) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json({
      ok: true,
      ownerId,
      journals: store.listLedgerJournalsSql(ownerId, { accountCodePrefix, periodCode, limit }),
    });
  });

  app.get('/api/office/ledger/trial-balance', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const ownerId = String(req.query.ownerId || req.headers['x-owner-id'] || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const periodCode = req.query.periodCode ? String(req.query.periodCode) : undefined;
    res.json(store.getLedgerTrialBalanceSql(ownerId, periodCode));
  });

  app.post('/api/office/ledger/post', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (!canMutateStaffLedgerOrState(claims)) {
      res.status(403).json({ error: true, msg: `Role "${claims.role}" cannot post ledger entries.` });
      return;
    }
    const body = (req.body || {}) as {
      ownerId?: string;
      entryDate?: string;
      periodCode?: string;
      ruleId?: string;
      sourceType?: string;
      sourceId?: string;
      idempotencyKey?: string;
      description?: string;
      checkerActorId?: string;
      lines?: Array<{ accountCode: string; accountName?: string; debitCents: number; creditCents: number }>;
    };
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const result = store.postLedgerJournalSql({
      ownerId,
      entryDate: String(body.entryDate || new Date().toISOString().slice(0, 10)),
      periodCode: String(body.periodCode || '2019-03'),
      ruleId: String(body.ruleId || 'Manual'),
      sourceType: String(body.sourceType || 'ManualJournal'),
      sourceId: String(body.sourceId || ''),
      idempotencyKey: String(body.idempotencyKey || `API-${Date.now()}`),
      description: String(body.description || 'SQLite ledger entry'),
      makerActorId: claims.sub,
      checkerActorId: body.checkerActorId ? String(body.checkerActorId) : undefined,
      lines: Array.isArray(body.lines) ? body.lines : [],
    });
    if (!result.ok) {
      res.status(400).json({ error: true, msg: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/office/ledger/reverse', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (!canMutateStaffLedgerOrState(claims)) {
      res.status(403).json({ error: true, msg: `Role "${claims.role}" cannot reverse ledger entries.` });
      return;
    }
    const body = (req.body || {}) as {
      ownerId?: string;
      journalId?: string;
      entryDate?: string;
      periodCode?: string;
      reason?: string;
      makerActorId?: string;
    };
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const result = store.reverseLedgerJournalSql({
      ownerId,
      journalId: String(body.journalId || ''),
      entryDate: String(body.entryDate || new Date().toISOString().slice(0, 10)),
      periodCode: String(body.periodCode || '2019-03'),
      reason: String(body.reason || 'PR-25 Mirror Reversal'),
      makerActorId: String(body.makerActorId || 'USR-SYNTH-03'),
      checkerActorId: claims.sub,
    });
    if (!result.ok) {
      res.status(400).json({ error: true, msg: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/office/ledger/period-close', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (!canMutateStaffLedgerOrState(claims)) {
      res.status(403).json({ error: true, msg: `Role "${claims.role}" cannot close accounting periods.` });
      return;
    }
    const body = (req.body || {}) as {
      ownerId?: string;
      periodCode?: string;
      makerActorId?: string;
    };
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const result = store.requestPeriodCloseSql({
      ownerId,
      periodCode: String(body.periodCode || '2019-03'),
      closedBy: claims.displayName,
      makerActorId: String(body.makerActorId || 'USR-SYNTH-03'),
      checkerActorId: claims.sub,
    });
    if (!result.ok) {
      res.status(400).json({ error: true, msg: result.error });
      return;
    }
    res.json(result);
  });

  app.get('/api/office/ledger/manifest', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const ownerId = String(req.query.ownerId || req.headers['x-owner-id'] || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    res.json(store.getBackupLedgerManifest(ownerId));
  });

  // --------------------------------------------------------------------------
  // Local Evidence Vault Retrieval & Listing
  // --------------------------------------------------------------------------
  app.get('/api/office/uploads', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const ownerId =
      typeof req.query.ownerId === 'string'
        ? req.query.ownerId
        : typeof req.headers['x-owner-id'] === 'string'
          ? req.headers['x-owner-id']
          : claims.defaultOwnerId;
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    res.json({ ok: true, files: store.listUploadedFiles(ownerId) });
  });

  app.get('/api/office/uploads/:fileId', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const file = store.getUploadedFile(req.params.fileId);
    if (!file) {
      res.status(404).json({ error: true, msg: 'Evidence file not found.' });
      return;
    }
    if (!isOwnerAllowed(claims, file.meta.ownerId)) {
      res.status(403).json({ error: true, msg: 'Forbidden cross-owner upload access.' });
      return;
    }
    const requestedOwner =
      typeof req.query.ownerId === 'string'
        ? req.query.ownerId
        : typeof req.headers['x-owner-id'] === 'string'
          ? req.headers['x-owner-id']
          : undefined;
    if (requestedOwner && requestedOwner !== file.meta.ownerId) {
      res.status(403).json({ error: true, msg: 'Forbidden cross-owner upload access.' });
      return;
    }
    res.setHeader('Content-Type', file.meta.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${file.meta.filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(file.buffer);
  });

  // --------------------------------------------------------------------------
  // Zero-Key Local VAPID Web Push API (Authenticated)
  // --------------------------------------------------------------------------
  app.get('/api/office/push/vapid-key', requireOfficeAuth, (_req, res) => {
    res.json({
      ok: true,
      publicKey: store.getVapidPublicKey(),
      mode: 'local-sqlite-vapid',
    });
  });

  app.post('/api/office/push/subscribe', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
      device_label?: string;
      deviceLabel?: string;
      ownerId?: string;
    };
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    if (!body.endpoint || !body.p256dh || !body.auth) {
      res.status(400).json({ error: true, msg: 'endpoint, p256dh, and auth are required.' });
      return;
    }
    const saved = store.savePushSubscription({
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      deviceLabel: body.deviceLabel || body.device_label || 'AD-PRMS Device',
      ownerId,
      actorId: claims.sub,
    });
    res.status(200).json({ ok: true, id: saved.endpoint, totalSubscribers: store.getPushSubscribersCount() });
  });

  app.delete('/api/office/push/subscribe', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as { endpoint?: string };
    if (body.endpoint) {
      store.removePushSubscription(body.endpoint);
    }
    res.json({ ok: true, totalSubscribers: store.getPushSubscribersCount() });
  });

  app.post('/api/office/push/send', requireOfficeAuth, async (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (!canMutateStaffLedgerOrState(claims)) {
      res.status(403).json({ error: true, msg: 'Push broadcast is restricted to staff roles.' });
      return;
    }
    const body = (req.body || {}) as {
      title?: string;
      body?: string;
      url?: string;
      tag?: string;
      ownerId?: string;
    };
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const result = await store.sendPushNotifications({
      title: body.title || 'AD-PRMS Office Test Alert',
      body: body.body || 'Background Web Push is active via local SQLite VAPID.',
      url: body.url || '/',
      tag: body.tag || 'adprms-office-push',
      ownerId,
    });
    res.json({ ok: true, mode: 'local-sqlite-vapid', ...result });
  });

  // --------------------------------------------------------------------------
  // Simulated Tenant Phone OTP (Issues Signed Tenant Cookie Upon Verification)
  // --------------------------------------------------------------------------
  app.post('/api/office/auth/tenant/otp/request', authRateLimiter, (req, res) => {
    const body = (req.body || {}) as { msisdn?: string; locale?: 'en' | 'am' };
    const result = store.requestSimulatedTenantOtp(String(body.msisdn || ''), body.locale || 'en');
    if (!result.ok) {
      res.status(400).json({ error: true, detail: result.error });
      return;
    }

    const maskedPhone = maskMsisdn(result.msisdn);
    broadcastSyncEvent({
      eventId: `EVT-OTP-${Date.now()}`,
      type: 'sms:dispatched',
      ownerId: result.matchedAccount?.ownerId || 'OWN-ALPHA',
      timestamp: new Date().toISOString(),
      data: {
        count: 1,
        msisdn: maskedPhone,
        mode: 'OFFICE TEST SANDBOX OTP — NO LIVE TELCO',
      },
    });

    res.json({
      ok: true,
      msisdn: result.msisdn,
      ...(isProduction ? {} : { sandboxOtpCode: result.code }),
      matchedAccount: result.matchedAccount,
      detail: `Sandbox SMS OTP logged to SQLite SMS Outbox for ${maskedPhone}.`,
    });
  });

  app.post('/api/office/auth/tenant/otp/verify', authRateLimiter, (req, res) => {
    const body = (req.body || {}) as { msisdn?: string; code?: string };
    const result = store.verifySimulatedTenantOtp(String(body.msisdn || ''), String(body.code || ''));
    if (!result.ok || !result.account) {
      res.status(400).json({ error: true, detail: result.error || 'OTP verification failed.' });
      return;
    }
    const dirEntry = findDirectoryEntryByUsername(result.account.username);
    if (dirEntry) {
      const claims = buildClaimsFromDirectory(dirEntry);
      appendSessionCookie(res, req, signOfficeSessionToken(claims));
    }
    res.json({
      ok: true,
      msisdn: result.msisdn,
      account: result.account,
    });
  });

  // --------------------------------------------------------------------------
  // ArifPay, Telebirr & SMS Sandbox Routes (Session-Gated & Fail-Closed Webhooks)
  // --------------------------------------------------------------------------
  app.post('/api/gateways/arifpay/session', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as Record<string, unknown>;
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }

    const nonce = String(body.nonce || `AP-NONCE-${Date.now()}`);
    const existing = store.getArifPaySessionByNonce(nonce);
    if (existing) {
      if (existing.ownerId !== ownerId) {
        res.status(403).json({ error: true, msg: 'Forbidden cross-owner ArifPay nonce.' });
        return;
      }
      res.status(200).json({ error: false, reused: true, data: existing });
      return;
    }

    const amountEtb = Number(body.amountEtb || 0);
    if (!Number.isFinite(amountEtb) || amountEtb <= 0) {
      res.status(400).json({ error: true, msg: 'Invalid amountEtb for ArifPay sandbox session.' });
      return;
    }

    const sessionId = `AP-SESS-${Math.floor(100000 + Math.random() * 900000)}`;
    const transactionId = `AP-TX-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const session: ArifPayServerSession = {
      sessionId,
      nonce,
      ownerId,
      tenantId: String(body.tenantId || claims.tenantId || ''),
      chargeId: String(body.chargeId || ''),
      amountEtb,
      paymentMethods: Array.isArray(body.paymentMethods)
        ? body.paymentMethods.map(String)
        : ['TELEBIRR', 'CBE'],
      checkoutUrl: `https://gateway.arifpay.org/sandbox/checkout/${sessionId}`,
      status: 'PENDING',
      transactionId,
      createdAt,
      expiresAt,
    };
    store.upsertArifPaySession(session);
    res.status(200).json({ error: false, reused: false, data: session });
  });

  app.post('/api/gateways/arifpay/verify', requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    const body = (req.body || {}) as Record<string, unknown>;
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      res.status(400).json({ error: true, msg: 'sessionId is required.' });
      return;
    }
    const session = store.getArifPaySessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: true, msg: 'ArifPay session not found.' });
      return;
    }
    if (!isOwnerAllowed(claims, session.ownerId)) {
      res.status(403).json({ error: true, msg: 'Forbidden cross-owner gateway verification.' });
      return;
    }
    session.status = 'COMPLETED';
    store.upsertArifPaySession(session);
    res.status(200).json({ error: false, sandboxOnly: true, data: session });
  });

  app.post('/api/webhooks/arifpay', async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const rawBody = req.rawBody ?? JSON.stringify(body);
    const sig = String(req.headers['x-arifpay-signature'] || '');
    const ts = req.headers['x-arifpay-timestamp'] ? String(req.headers['x-arifpay-timestamp']) : undefined;

    const sigCheck = verifyArifPayWebhookSignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: ts,
    });
    if (!sigCheck.ok) {
      res.status(sigCheck.status).json({ error: true, msg: sigCheck.reason });
      return;
    }

    const sessionId = String(body.sessionId || '').trim();
    const replayKey = `AP:${sessionId}:${String(body.transactionId || '')}:${sig.slice(0, 16)}`;
    if (seenWebhookReplayKeys.has(replayKey)) {
      res.status(409).json({ error: true, msg: 'Duplicate replayed ArifPay webhook ignored.' });
      return;
    }

    const session = store.getArifPaySessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: true, msg: 'ArifPay session not found.' });
      return;
    }

    const reportedOwner = String(body.ownerId || session.ownerId);
    const reportedAmount = Number(body.amountEtb ?? session.amountEtb);
    if (reportedOwner !== session.ownerId || Math.abs(reportedAmount - session.amountEtb) > 0.01) {
      res.status(400).json({
        error: true,
        msg: 'ArifPay webhook owner or amount mismatch rejected.',
      });
      return;
    }

    seenWebhookReplayKeys.set(replayKey, true);
    session.status = 'COMPLETED';
    store.upsertArifPaySession(session);

    // Sandbox simulator emits non-authoritative sandbox telemetry, never live settlement clearance
    broadcastSyncEvent({
      eventId: `EVT-AP-SBX-${Date.now()}`,
      type: 'sandbox:webhook:received' as SyncEventPayload['type'],
      ownerId: session.ownerId,
      timestamp: new Date().toISOString(),
      data: {
        gateway: 'ArifPay Checkout (Sandbox)',
        sandboxOnly: true,
        sessionId,
        transactionId: String(body.transactionId || session.transactionId || ''),
        amountEtb: session.amountEtb,
        status: String(body.status || 'COMPLETED'),
        signatureVerified: true,
      },
    });
    void store.sendPushNotifications({
      title: 'ArifPay Sandbox Webhook Verified',
      body: `ETB ${session.amountEtb.toLocaleString()} sandbox event verified in Training Mode.`,
      ownerId: session.ownerId,
      tag: `arifpay-${sessionId}`,
    });
    res.status(200).json({
      received: true,
      sandboxOnly: true,
      provider: 'ArifPay Sandbox (SQLite)',
    });
  });

  app.post('/api/webhooks/telebirr', (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const sigCheck = verifyTelebirrWebhookSignature({ payload: body });
    if (!sigCheck.ok) {
      res.status(sigCheck.status).json({ error: true, msg: sigCheck.reason });
      return;
    }

    const merchOrderId = String(body.merch_order_id || body.nonce || '').trim();
    const replayKey = `TB:${merchOrderId}:${String(body.payment_order_id || '')}`;
    if (merchOrderId && seenWebhookReplayKeys.has(replayKey)) {
      res.status(409).json({ error: true, msg: 'Duplicate replayed Telebirr webhook ignored.' });
      return;
    }
    if (merchOrderId) seenWebhookReplayKeys.set(replayKey, true);

    const ownerId = String(body.ownerId || 'OWN-ALPHA');
    broadcastSyncEvent({
      eventId: `EVT-TB-SBX-${Date.now()}`,
      type: 'sandbox:webhook:received' as SyncEventPayload['type'],
      ownerId,
      timestamp: new Date().toISOString(),
      data: {
        gateway: 'Telebirr USSD QR (Sandbox)',
        sandboxOnly: true,
        merchOrderId,
        signatureVerified: true,
      },
    });
    res.status(200).json({
      received: true,
      sandboxOnly: true,
      provider: 'Telebirr Sandbox (SQLite)',
    });
  });

  app.post('/api/sms/dispatch', mutationRateLimiter, requireOfficeAuth, (req: AuthedRequest, res: Response) => {
    const claims = req.officeSession!;
    if (!canMutateStaffLedgerOrState(claims)) {
      res.status(403).json({ error: true, msg: `Role "${claims.role}" cannot dispatch SMS notices.` });
      return;
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const ownerId = String(body.ownerId || claims.defaultOwnerId);
    if (!isOwnerAllowed(claims, ownerId)) {
      res.status(403).json({ error: true, msg: `Forbidden owner scope: ${ownerId}` });
      return;
    }
    const logged = store.logSmsOutbox({
      ownerId,
      msisdn: String(body.msisdn || '+251900000000'),
      triggerType: String(body.triggerType || 'General Notice'),
      locale: String(body.locale || 'en'),
      body: String(body.body || `Batch dispatch (${Number(body.count || 1)} recipient(s))`),
    });
    broadcastSyncEvent({
      eventId: `EVT-SMS-${Date.now()}`,
      type: 'sms:dispatched',
      ownerId,
      timestamp: logged.createdAt,
      data: {
        dispatchId: logged.id,
        count: Number(body.count || 1),
        mode: 'SANDBOX DISPATCH — NO LIVE TELCO',
      },
    });
    res.status(200).json({
      ok: true,
      dispatchId: logged.id,
      mode: 'SANDBOX DISPATCH — NO LIVE TELCO',
    });
  });

  const shouldAttachVite = options?.attachVite ?? !isProduction;
  if (shouldAttachVite) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: resolveAllowedViteHosts(),
        hmr: !disableHmr,
        ws: {
          server,
          path: '/vite-hmr',
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    const safeMsg =
      status < 500 && err instanceof Error
        ? err.message
        : 'An unexpected server error occurred.';
    if (status >= 500) {
      console.error('AD-PRMS server error:', err instanceof Error ? err.message : 'Unknown error');
    }
    if (!res.headersSent) {
      res.status(status).json({ error: true, msg: safeMsg });
    }
  });

  return { app, server, store, wss };
}

const isMainEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isMainEntry) {
  createTrainingServerApp()
    .then(({ server }) => {
      server.on('error', (err) => {
        console.error('AD-PRMS HTTP server error:', err);
        process.exit(1);
      });
      server.listen(PORT, BIND_HOST, () => {
        console.log(
          `AD-PRMS Office Test & Training Server (SQLite) listening on http://${BIND_HOST}:${PORT}`
        );
      });
    })
    .catch((err) => {
      console.error('Failed to start AD-PRMS server:', err);
      process.exit(1);
    });
}
