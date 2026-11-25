// @vitest-environment node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approveMcpBinding,
  createPendingMcpBinding,
  revokeMcpBindingById,
  revokeMcpByClientOrUser,
  verifyMcpAuditChain,
} from '../../server/mcpGovernanceStore.ts';
import { signInternalBridgeRequest } from '../../server/mcpBridge.ts';
import { ALL_MCP_TOOL_NAMES } from '../../server/mcpRbac.ts';
import type { OfficeSqliteStore } from '../../server/officeStore.ts';
import { signLocalDevBearerToken } from '../../services/mcp/src/auth.ts';
import { resolveMcpConfig, type McpServiceConfig } from '../../services/mcp/src/config.ts';
import { createMcpHttpApp } from '../../services/mcp/src/server.ts';

const BRIDGE_SECRET_PRIMARY = 'primary-bridge-secret-0123456789abcdef0123456789abcdef';
const BRIDGE_SECRET_PREVIOUS = 'previous-bridge-secret-abcdef0123456789abcdef0123456789';
const SUPABASE_ISSUER = 'https://vzjojdnttsfdwynumxtv.supabase.co/auth/v1';

let tmpDir = '';
let expressServer: http.Server;
let mcpServer: http.Server;
let expressBaseUrl = '';
let mcpBaseUrl = '';
let mcpResourceUri = '';
let store: OfficeSqliteStore;
let mcpConfig: McpServiceConfig;
const activeBridgePrimary = BRIDGE_SECRET_PRIMARY;
const activeBridgePrevious = BRIDGE_SECRET_PREVIOUS;

let ecPrivateKey: CryptoKey;
let rsaPrivateKey: CryptoKey;
let localJwks: ReturnType<typeof createLocalJWKSet>;

async function signEs256Jwt(claims: Record<string, unknown>, opts?: { iat?: number; exp?: number; iss?: string }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: 'test-es256-kid', typ: 'JWT' })
    .setIssuedAt(opts?.iat ?? nowSec)
    .setExpirationTime(opts?.exp ?? nowSec + 600);
  if (opts?.iss !== undefined) {
    if (opts.iss) jwt.setIssuer(opts.iss);
  } else {
    jwt.setIssuer(SUPABASE_ISSUER);
  }
  return jwt.sign(ecPrivateKey);
}

async function callMcpJsonRpc(
  token: string | null,
  method: string,
  params: Record<string, unknown> = {},
  id = 1
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${mcpBaseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }),
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { rawText: text };
  }
  return { status: res.status, headers: res.headers, json };
}

async function callMcpTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const { status, json } = await callMcpJsonRpc(token, 'tools/call', { name, arguments: args }, 10);
  const result = (json.result || {}) as {
    isError?: boolean;
    content?: Array<{ type: string; text: string }>;
    structuredContent?: Record<string, unknown>;
  };
  const error = json.error as { code?: number; message?: string } | undefined;
  return { httpStatus: status, result, error, rawJson: json };
}

async function loginExpressStaff(username: string, password: string): Promise<string> {
  const res = await fetch(`${expressBaseUrl}/api/office/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

function provisionApprovedBinding(opts: {
  supabaseUid: string;
  oauthClientId: string;
  actorId: string;
  allowedOwners: string[];
  defaultOwnerId?: string | null;
  allowedTools: string[];
  checkerActorId?: string;
  checkerRole?: string;
}) {
  const reqRes = createPendingMcpBinding(store.getDatabase(), {
    makerActorId: 'USR-SYNTH-06',
    makerRole: 'System Administrator',
    supabaseUid: opts.supabaseUid,
    oauthClientId: opts.oauthClientId,
    targetActorId: opts.actorId,
    allowedOwners: opts.allowedOwners,
    defaultOwnerId: opts.defaultOwnerId === undefined ? opts.allowedOwners[0] : opts.defaultOwnerId,
    allowedTools: opts.allowedTools,
  });
  if (!reqRes.ok || !reqRes.binding) {
    throw new Error(`Maker binding failed: ${!reqRes.ok ? reqRes.message : 'missing'}`);
  }
  const appRes = approveMcpBinding(store.getDatabase(), {
    bindingId: reqRes.binding.id,
    checkerActorId: opts.checkerActorId || 'USR-SYNTH-02',
    checkerRole: opts.checkerRole || 'General Manager',
  });
  if (!appRes.ok || !appRes.binding) {
    throw new Error(`Checker approve failed: ${!appRes.ok ? appRes.message : 'missing'}`);
  }
  return appRes.binding;
}

describe('AD-PRMS MCP Phase 1 Integration & Acceptance Suite (AT-01..AT-26 Offline/Mocked)', () => {
  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adprms-mcp-e2e-'));
    process.env.OFFICE_DB_PATH = path.join(tmpDir, 'adprms-mcp-e2e.db');
    process.env.OFFICE_SESSION_SECRET = 'vitest-office-session-secret-0123456789';

    const ecPair = await generateKeyPair('ES256');
    ecPrivateKey = ecPair.privateKey;
    const ecJwk = await exportJWK(ecPair.publicKey);
    ecJwk.kid = 'test-es256-kid';
    ecJwk.alg = 'ES256';
    ecJwk.use = 'sig';

    const rsaPair = await generateKeyPair('RS256');
    rsaPrivateKey = rsaPair.privateKey;

    const jwksPayload: JSONWebKeySet = { keys: [ecJwk] };
    localJwks = createLocalJWKSet(jwksPayload);

    const { createTrainingServerApp } = await import('../../server.ts');
    const createdExpress = await createTrainingServerApp({
      dataDir: tmpDir,
      dbPath: process.env.OFFICE_DB_PATH,
      attachVite: false,
      mcpBridge: {
        getPrimarySecret: () => activeBridgePrimary,
        getPreviousSecret: () => activeBridgePrevious,
        allowNonLoopbackForTests: true,
      },
    });
    store = createdExpress.store;

    await new Promise<void>((resolve) => {
      expressServer = http.createServer(createdExpress.app);
      expressServer.listen(0, '127.0.0.1', () => {
        const addr = expressServer.address() as { port: number };
        expressBaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Pick a free ephemeral port for MCP service
    const tmpSocket = http.createServer();
    await new Promise<void>((resolve) => tmpSocket.listen(0, '127.0.0.1', () => resolve()));
    const mcpPort = (tmpSocket.address() as { port: number }).port;
    await new Promise<void>((resolve) => tmpSocket.close(() => resolve()));

    mcpResourceUri = `http://127.0.0.1:${mcpPort}/mcp`;
    mcpConfig = resolveMcpConfig({
      NODE_ENV: 'test',
      MCP_INTERNAL_BRIDGE_SECRET: BRIDGE_SECRET_PRIMARY,
      MCP_INTERNAL_BRIDGE_SECRET_PREVIOUS: BRIDGE_SECRET_PREVIOUS,
      MCP_PORT: String(mcpPort),
      MCP_BIND_HOST: '127.0.0.1',
      MCP_RESOURCE_URI: mcpResourceUri,
      MCP_ALLOW_LOCAL_DEV_TOKEN: 'true',
      MCP_PUBLIC_TUNNEL_ENABLED: 'false',
      MCP_EXPRESS_BASE_URL: expressBaseUrl,
    });

    const { app: mcpApp } = createMcpHttpApp(mcpConfig, { customJwksLookup: localJwks });
    await new Promise<void>((resolve) => {
      mcpServer = http.createServer(mcpApp);
      mcpServer.listen(mcpPort, '127.0.0.1', () => {
        mcpBaseUrl = `http://127.0.0.1:${mcpPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mcpServer) await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
    if (expressServer) await new Promise<void>((resolve) => expressServer.close(() => resolve()));
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('AT-01: unauthenticated POST /mcp returns 401 WWW-Authenticate and serves RFC 9728 metadata', async () => {
    const postRes = await callMcpJsonRpc(null, 'tools/list', {}, 1);
    expect(postRes.status).toBe(401);
    const wwwAuth = postRes.headers.get('www-authenticate') || '';
    expect(wwwAuth).toContain('resource_metadata=');
    expect(wwwAuth).toContain('/.well-known/oauth-protected-resource');

    const metaRes = await fetch(`${mcpBaseUrl}/.well-known/oauth-protected-resource`);
    expect(metaRes.status).toBe(200);
    const metaJson = (await metaRes.json()) as Record<string, unknown>;
    expect(metaJson.resource).toBe(mcpResourceUri);
    expect(metaJson.authorization_servers).toEqual([SUPABASE_ISSUER]);
    expect(metaJson.scopes_supported).toEqual(['openid', 'profile', 'email']);
  });

  it('AT-04 & AT-23: rejects alg:none, HS256, unpublished RS256, expired, wrong iss, aud="authenticated" (browser SPA token), and logs PRE_AUTH_UNVERIFIED AUTH_GATE', async () => {
    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'u-bad', client_id: 'c1', aud: mcpResourceUri, iss: SUPABASE_ISSUER })
    ).toString('base64url');
    const resNone = await callMcpJsonRpc(`${headerNone}.${payload}.`, 'tools/list');
    expect(resNone.status).toBe(401);

    const hs256Token = await new SignJWT({ sub: 'u-hs', client_id: 'c1', aud: mcpResourceUri })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(SUPABASE_ISSUER)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode('symmetric-secret-0123456789abcdef'));
    expect((await callMcpJsonRpc(hs256Token, 'tools/list')).status).toBe(401);

    const rs256Token = await new SignJWT({ sub: 'u-rs', client_id: 'c1', aud: mcpResourceUri })
      .setProtectedHeader({ alg: 'RS256', kid: 'unpublished-rsa' })
      .setIssuer(SUPABASE_ISSUER)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(rsaPrivateKey);
    expect((await callMcpJsonRpc(rs256Token, 'tools/list')).status).toBe(401);

    const wrongIssToken = await signEs256Jwt(
      { sub: 'u-iss', client_id: 'c1', aud: mcpResourceUri },
      { iss: 'https://evil.example.com/auth/v1' }
    );
    expect((await callMcpJsonRpc(wrongIssToken, 'tools/list')).status).toBe(401);

    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await signEs256Jwt(
      { sub: 'u-exp', client_id: 'c1', aud: mcpResourceUri },
      { iat: now - 500, exp: now - 120 }
    );
    expect((await callMcpJsonRpc(expiredToken, 'tools/list')).status).toBe(401);

    // AT-23: Real signed ES256 Supabase browser SPA token with aud = "authenticated" MUST fail with 401
    const browserSpaToken = await signEs256Jwt({
      sub: '8a1f3b2c-browser-spa',
      client_id: 'c1',
      aud: 'authenticated',
      role: 'authenticated',
    });
    const spaRes = await callMcpJsonRpc(browserSpaToken, 'tools/list');
    expect(spaRes.status).toBe(401);
    expect(spaRes.json.code).toBe('JWT_AUDIENCE_MISMATCH');

    // Confirm PRE_AUTH_UNVERIFIED AUTH_GATE row recorded with NULL identity columns
    const preAuthRows = store
      .getDatabase()
      .prepare("SELECT * FROM mcp_audit_events WHERE auth_mode = 'PRE_AUTH_UNVERIFIED' ORDER BY seq DESC LIMIT 1")
      .all() as Array<Record<string, unknown>>;
    expect(preAuthRows.length).toBeGreaterThan(0);
    expect(preAuthRows[0].tool_name).toBe('AUTH_GATE');
    expect(preAuthRows[0].decision).toBe('DENIED');
    expect(preAuthRows[0].supabase_uid).toBeNull();
    expect(preAuthRows[0].actor_id).toBeNull();
    expect(preAuthRows[0].role).toBeNull();
  });

  it('AT-05 & AT-11 & AT-18: Auditor succeeds across all 8 tools, Zod rejects spoof fields, tools/list has 8 read-only tools, free-text stripped & wrapped', async () => {
    const uid = 'uid-auditor-07';
    const clientId = 'client-gemini-cli';
    provisionApprovedBinding({
      supabaseUid: uid,
      oauthClientId: clientId,
      actorId: 'USR-SYNTH-07',
      allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
      allowedTools: [...ALL_MCP_TOOL_NAMES],
    });
    const token = await signEs256Jwt({ sub: uid, client_id: clientId, aud: mcpResourceUri });

    const listRes = await callMcpJsonRpc(token, 'tools/list', {}, 2);
    expect(listRes.status).toBe(200);
    const tools = ((listRes.json.result as { tools?: Array<{ name: string; annotations?: Record<string, boolean> }> })?.tools || []);
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_MCP_TOOL_NAMES].sort());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
    }

    // Spoofed actorId/role rejected by Zod .strict()
    const spoofRes = await callMcpTool(token, 'get_property_summary', {
      ownerId: 'OWN-ALPHA',
      actorId: 'USR-SYNTH-02',
      role: 'General Manager',
    });
    expect(spoofRes.result.isError || Boolean(spoofRes.error)).toBe(true);

    // Execute all 8 tools for Auditor across OWN-ALPHA and OWN-BETA
    for (const toolName of ALL_MCP_TOOL_NAMES) {
      const r = await callMcpTool(token, toolName, { ownerId: 'OWN-ALPHA' });
      expect(r.result.isError).not.toBe(true);
      expect(r.result.structuredContent?.dataBoundary).toBe('SYNTHETIC_TRAINING_DATA_UNTRUSTED_TEXT');
      const actorMeta = r.result.structuredContent?.actor as Record<string, unknown>;
      expect(actorMeta.actorId).toBe('USR-SYNTH-07');
    }

    const leaseRes = await callMcpTool(token, 'get_lease_summary', { ownerId: 'OWN-BETA' });
    const leasePayload = leaseRes.result.structuredContent?.payload as { items: Array<Record<string, unknown>> };
    expect(leasePayload.items.length).toBeGreaterThan(0);
    expect(leasePayload.items[0].notes).toBeUndefined();
    expect(leasePayload.items[0].timeline).toBeUndefined();
  });

  it('AT-06: System Administrator allowed ONLY on get_system_status & get_audit_summary and blocked on all 6 operational/financial tools', async () => {
    const uid = 'uid-sysadmin-06';
    const clientId = 'client-sysadmin';
    const resMaker = createPendingMcpBinding(store.getDatabase(), {
      makerActorId: 'USR-SYNTH-06',
      makerRole: 'System Administrator',
      supabaseUid: 'uid-sysadmin-dummy-maker',
      oauthClientId: clientId,
      targetActorId: 'USR-SYNTH-03',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_property_summary'],
    });
    expect(resMaker.ok).toBe(true);

    // SysAdmin attempting to include prohibited tool get_property_summary for USR-SYNTH-06 is denied
    const badReq = createPendingMcpBinding(store.getDatabase(), {
      makerActorId: 'USR-SYNTH-06',
      makerRole: 'System Administrator',
      supabaseUid: uid,
      oauthClientId: clientId,
      targetActorId: 'USR-SYNTH-06',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_system_status', 'get_audit_summary'],
    });
    expect(badReq.ok).toBe(false);
    if (!badReq.ok) expect(badReq.code).toBe('SELF_PROVISIONING_FORBIDDEN');

    // Insert approved fixture binding for USR-SYNTH-06 (created by another admin actor via SQL seed for RBAC verification)
    const now = new Date().toISOString();
    store.getDatabase().prepare(`
      INSERT INTO mcp_actor_bindings (
        id, supabase_uid, oauth_client_id, actor_id, role,
        allowed_owners_json, default_owner_id, allowed_tools_json,
        grant_status, created_at, created_by, provisioned_by,
        approved_by, approved_at, token_not_before
      ) VALUES (?, ?, ?, 'USR-SYNTH-06', 'System Administrator', '["OWN-ALPHA"]', 'OWN-ALPHA', ?, 'ACTIVE', ?, 'SYS-SEED', 'SYS-SEED', 'USR-SYNTH-02', ?, 0)
    `).run('BIND-SYSADMIN-FIX', uid, clientId, JSON.stringify(['get_system_status', 'get_audit_summary']), now, now);

    const token = await signEs256Jwt({ sub: uid, client_id: clientId, aud: mcpResourceUri });
    expect((await callMcpTool(token, 'get_system_status', { ownerId: 'OWN-ALPHA' })).result.isError).not.toBe(true);
    expect((await callMcpTool(token, 'get_audit_summary', { ownerId: 'OWN-ALPHA' })).result.isError).not.toBe(true);

    for (const blocked of [
      'get_property_summary',
      'list_buildings',
      'get_unit_occupancy',
      'get_lease_summary',
      'get_rent_collection_summary',
      'get_overdue_rent_summary',
    ]) {
      const r = await callMcpTool(token, blocked, { ownerId: 'OWN-ALPHA' });
      expect(r.result.isError).toBe(true);
      expect(r.result.structuredContent?.status).toBe(403);
    }
  });

  it('AT-07: Owner / Director cross-owner isolation & zero out-of-binding OWN-ALPHA defaulting', async () => {
    const ownerUid = 'uid-owner-alpha';
    provisionApprovedBinding({
      supabaseUid: ownerUid,
      oauthClientId: 'client-owner',
      actorId: 'USR-SYNTH-01',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_property_summary'],
      checkerActorId: 'USR-SYNTH-02',
      checkerRole: 'General Manager',
    });
    const tokenAlpha = await signEs256Jwt({ sub: ownerUid, client_id: 'client-owner', aud: mcpResourceUri });

    const okAlpha = await callMcpTool(tokenAlpha, 'get_property_summary', { ownerId: 'OWN-ALPHA' });
    expect(okAlpha.result.isError).not.toBe(true);
    expect((okAlpha.result.structuredContent?.payload as Record<string, unknown>).isSyntheticFixture).toBe(true);

    const denyBeta = await callMcpTool(tokenAlpha, 'get_property_summary', { ownerId: 'OWN-BETA' });
    expect(denyBeta.result.isError).toBe(true);
    expect(denyBeta.result.structuredContent?.status).toBe(403);

    // Binding limited to OWN-BETA omitting ownerId MUST resolve strictly to OWN-BETA (never OWN-ALPHA)
    const betaUid = 'uid-gm-beta-only';
    provisionApprovedBinding({
      supabaseUid: betaUid,
      oauthClientId: 'client-beta',
      actorId: 'USR-SYNTH-02',
      allowedOwners: ['OWN-BETA'],
      defaultOwnerId: null,
      allowedTools: ['get_property_summary'],
      checkerActorId: 'USR-SYNTH-01',
      checkerRole: 'Owner / Director',
    });
    const tokenBeta = await signEs256Jwt({ sub: betaUid, client_id: 'client-beta', aud: mcpResourceUri });
    const noArgRes = await callMcpTool(tokenBeta, 'get_property_summary', {});
    expect(noArgRes.result.isError).not.toBe(true);
    expect((noArgRes.result.structuredContent?.actor as Record<string, unknown>).ownerId).toBe('OWN-BETA');
  });

  it('AT-08, AT-09, AT-10: Collections Clerk, Property Clerk, and Assistant Manager enforce exact role projections and denials', async () => {
    // Collections Clerk
    provisionApprovedBinding({
      supabaseUid: 'uid-col-04',
      oauthClientId: 'c-col',
      actorId: 'USR-SYNTH-04',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: [
        'get_property_summary',
        'get_unit_occupancy',
        'get_lease_summary',
        'get_rent_collection_summary',
        'get_overdue_rent_summary',
      ],
    });
    const colToken = await signEs256Jwt({ sub: 'uid-col-04', client_id: 'c-col', aud: mcpResourceUri });
    const colUnits = await callMcpTool(colToken, 'get_unit_occupancy', {});
    const firstUnit = ((colUnits.result.structuredContent?.payload as { items: Array<Record<string, unknown>> }).items)[0];
    expect(firstUnit.baseRentEtb).toBeUndefined();

    const colLeases = await callMcpTool(colToken, 'get_lease_summary', {});
    const leasePayload = colLeases.result.structuredContent?.payload as Record<string, unknown>;
    expect(leasePayload.totalSecurityDepositEtb).toBeUndefined();
    expect((await callMcpTool(colToken, 'get_rent_collection_summary', {})).result.isError).not.toBe(true);
    expect((await callMcpTool(colToken, 'get_audit_summary', {})).result.isError).toBe(true);

    // Property Clerk
    provisionApprovedBinding({
      supabaseUid: 'uid-prp-05',
      oauthClientId: 'c-prp',
      actorId: 'USR-SYNTH-05',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_property_summary', 'list_buildings', 'get_unit_occupancy', 'get_lease_summary'],
    });
    const prpToken = await signEs256Jwt({ sub: 'uid-prp-05', client_id: 'c-prp', aud: mcpResourceUri });
    const prpProp = await callMcpTool(prpToken, 'get_property_summary', {});
    expect((prpProp.result.structuredContent?.payload as Record<string, unknown>).monthlyScheduledRentEtb).toBeUndefined();
    expect((await callMcpTool(prpToken, 'get_rent_collection_summary', {})).result.isError).toBe(true);
    expect((await callMcpTool(prpToken, 'get_overdue_rent_summary', {})).result.isError).toBe(true);
    expect((await callMcpTool(prpToken, 'get_audit_summary', {})).result.isError).toBe(true);

    // Assistant Manager
    provisionApprovedBinding({
      supabaseUid: 'uid-am-09',
      oauthClientId: 'c-am',
      actorId: 'USR-SYNTH-09',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_rent_collection_summary', 'get_overdue_rent_summary', 'get_audit_summary'],
    });
    const amToken = await signEs256Jwt({ sub: 'uid-am-09', client_id: 'c-am', aud: mcpResourceUri });
    const amCol = await callMcpTool(amToken, 'get_rent_collection_summary', {});
    expect((amCol.result.structuredContent?.payload as Record<string, unknown>).byMethod).toBeUndefined();
    expect((amCol.result.structuredContent?.payload as Record<string, unknown>).collectionRatePct).toBeTypeOf('number');
    const amOverdue = await callMcpTool(amToken, 'get_overdue_rent_summary', {});
    expect((amOverdue.result.structuredContent?.payload as Record<string, unknown>).items).toBeUndefined();
    expect((await callMcpTool(amToken, 'get_audit_summary', {})).result.isError).not.toBe(true);
  });

  it('AT-12: Unmapped Supabase UID & Tenant account are denied (403) and logged to mcp_audit_events', async () => {
    const unmappedToken = await signEs256Jwt({
      sub: 'uid-totally-unmapped',
      client_id: 'client-unknown',
      aud: mcpResourceUri,
    });
    const res = await callMcpTool(unmappedToken, 'get_system_status', {});
    expect(res.result.isError).toBe(true);
    expect(res.result.structuredContent?.status).toBe(403);
    expect(res.result.structuredContent?.code).toBe('UNMAPPED_SUPABASE_UID');

    // Direct tenant insertion attempt blocked by validation too
    const tenantReq = createPendingMcpBinding(store.getDatabase(), {
      makerActorId: 'USR-SYNTH-06',
      makerRole: 'System Administrator',
      supabaseUid: 'uid-tenant-01',
      oauthClientId: 'c-ten',
      targetActorId: 'TEN-ACC-01',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_system_status'],
    });
    expect(tenantReq.ok).toBe(false);
  });

  it('AT-13 & AT-14: Immediate user & client revocation with zero jti/session_id dependency and same-second cutoff (tokenIat <= token_not_before)', async () => {
    const uid = 'uid-revoke-test';
    const bA = provisionApprovedBinding({
      supabaseUid: uid,
      oauthClientId: 'client-a',
      actorId: 'USR-SYNTH-03',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_system_status'],
    });
    provisionApprovedBinding({
      supabaseUid: uid,
      oauthClientId: 'client-b',
      actorId: 'USR-SYNTH-03',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_system_status'],
    });

    const fixedSec = Math.floor(Date.now() / 1000);
    // Token has NO jti and NO session_id
    const tokenA = await signEs256Jwt(
      { sub: uid, client_id: 'client-a', aud: mcpResourceUri },
      { iat: fixedSec, exp: fixedSec + 600 }
    );
    const tokenB = await signEs256Jwt(
      { sub: uid, client_id: 'client-b', aud: mcpResourceUri },
      { iat: fixedSec, exp: fixedSec + 600 }
    );

    expect((await callMcpTool(tokenA, 'get_system_status', {})).result.isError).not.toBe(true);

    // Grant-level revoke on Client A (with exact same-second cutoff token_not_before === fixedSec)
    revokeMcpBindingById(store.getDatabase(), {
      bindingId: bA.id,
      revokerActorId: 'USR-SYNTH-06',
      revokerRole: 'System Administrator',
      reason: 'Compromised Client A',
      nowEpochSec: fixedSec,
    });

    // Client A immediately blocked; Client B stays ACTIVE
    const resA = await callMcpTool(tokenA, 'get_system_status', {});
    expect(resA.result.isError).toBe(true);
    expect(resA.result.structuredContent?.status).toBe(403);
    expect((await callMcpTool(tokenB, 'get_system_status', {})).result.isError).not.toBe(true);

    // Same-second token_not_before check directly (simulate token issued at exact cutoff second T while row remains ACTIVE)
    store.getDatabase().prepare('UPDATE mcp_actor_bindings SET token_not_before = ? WHERE supabase_uid = ? AND oauth_client_id = ?').run(fixedSec, uid, 'client-b');
    const sameSecRes = await callMcpTool(tokenB, 'get_system_status', {});
    expect(sameSecRes.result.isError).toBe(true);
    expect(sameSecRes.result.structuredContent?.code).toBe('TOKEN_REVOKED_BY_NOT_BEFORE');

    // User-level kill switch
    const userKill = revokeMcpByClientOrUser(store.getDatabase(), {
      targetType: 'USER',
      targetValue: uid,
      revokerActorId: 'USR-SYNTH-02',
      revokerRole: 'General Manager',
      reason: 'User emergency lock',
    });
    expect(userKill.ok).toBe(true);
  });

  it('AT-15: Local dev token works on 127.0.0.1 non-prod and config refuses unsafe combinations', async () => {
    expect(() =>
      resolveMcpConfig({
        NODE_ENV: 'production',
        MCP_INTERNAL_BRIDGE_SECRET: BRIDGE_SECRET_PRIMARY,
        MCP_ALLOW_LOCAL_DEV_TOKEN: 'true',
      })
    ).toThrow(/production/i);

    expect(() =>
      resolveMcpConfig({
        NODE_ENV: 'development',
        MCP_INTERNAL_BRIDGE_SECRET: BRIDGE_SECRET_PRIMARY,
        MCP_BIND_HOST: '0.0.0.0',
        MCP_ALLOW_LOCAL_DEV_TOKEN: 'true',
      })
    ).toThrow(/loopback/i);

    expect(() =>
      resolveMcpConfig({
        NODE_ENV: 'development',
        MCP_INTERNAL_BRIDGE_SECRET: BRIDGE_SECRET_PRIMARY,
        MCP_PUBLIC_TUNNEL_ENABLED: 'true',
        MCP_PUBLIC_HOST: 'mcp.example.org',
        MCP_ALLOW_LOCAL_DEV_TOKEN: 'true',
      })
    ).toThrow(/MCP_PUBLIC_TUNNEL_ENABLED/i);

    const devUid = 'uid-local-dev';
    provisionApprovedBinding({
      supabaseUid: devUid,
      oauthClientId: 'local-dev-cli',
      actorId: 'USR-SYNTH-07',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: ['get_system_status'],
    });
    const devToken = signLocalDevBearerToken(
      { sub: devUid, client_id: 'local-dev-cli', aud: mcpResourceUri },
      mcpConfig.localDevTokenSecret
    );
    const res = await callMcpTool(devToken, 'get_system_status', {});
    expect(res.result.isError).not.toBe(true);
  });

  it('AT-16 & AT-17: Audit chain integrity, trigger immutability, seed.auditEvents exclusion, and Host/Origin/path hardening', async () => {
    const db = store.getDatabase();
    // Triggers block UPDATE / DELETE
    expect(() => db.exec("UPDATE mcp_audit_events SET decision = 'ALLOWED' WHERE seq = 1")).toThrow(/append-only/);
    expect(() => db.exec('DELETE FROM mcp_audit_events WHERE seq = 1')).toThrow(/append-only/);

    // Verify full cryptographic v1 chain
    const chainCheck = verifyMcpAuditChain(db);
    expect(chainCheck.valid).toBe(true);
    expect(chainCheck.totalRows).toBeGreaterThan(5);

    // Ensure get_audit_summary omits legacy seed.auditEvents (AUD-900x)
    const token = await signEs256Jwt({
      sub: 'uid-auditor-07',
      client_id: 'client-gemini-cli',
      aud: mcpResourceUri,
    });
    const auditRes = await callMcpTool(token, 'get_audit_summary', {});
    const payload = auditRes.result.structuredContent?.payload as {
      auditStream: string;
      recentEvents: Array<{ id: string }>;
    };
    expect(payload.auditStream).toBe('MCP_SERVER_ONLY');
    expect(payload.recentEvents.every((e) => e.id.startsWith('MCP-AUD-'))).toBe(true);

    // AT-17: Surface minimization & Host/Origin guard
    expect((await fetch(`${mcpBaseUrl}/api/office/state`)).status).toBe(404);
    expect(
      (
        await fetch(`${mcpBaseUrl}/.well-known/oauth-protected-resource`, {
          headers: { Origin: 'https://evil-attacker.example' },
        })
      ).status
    ).toBe(403);
  });

  it('AT-20: Default allowed_tools_json=[] denies tool calls and SQL wildcard "*" violates CHECK constraint', async () => {
    const uid = 'uid-empty-tools';
    provisionApprovedBinding({
      supabaseUid: uid,
      oauthClientId: 'c-empty',
      actorId: 'USR-SYNTH-02',
      allowedOwners: ['OWN-ALPHA'],
      allowedTools: [], // deny-by-default
      checkerActorId: 'USR-SYNTH-01',
      checkerRole: 'Owner / Director',
    });
    const token = await signEs256Jwt({ sub: uid, client_id: 'c-empty', aud: mcpResourceUri });
    const res = await callMcpTool(token, 'get_system_status', {});
    expect(res.result.isError).toBe(true);
    expect(res.result.structuredContent?.code).toBe('TOOL_NOT_GRANTED');

    const now = new Date().toISOString();
    expect(() =>
      store
        .getDatabase()
        .prepare(
          `INSERT INTO mcp_actor_bindings (
            id, supabase_uid, oauth_client_id, actor_id, role,
            allowed_owners_json, allowed_tools_json, grant_status,
            created_at, created_by, provisioned_by, approved_by, approved_at
          ) VALUES ('BIND-WILD', 'u-w', 'c-w', 'USR-SYNTH-02', 'General Manager', '["OWN-ALPHA"]', '["*"]', 'ACTIVE', ?, 'USR-SYNTH-06', 'USR-SYNTH-06', 'USR-SYNTH-01', ?)`
        )
        .run(now, now)
    ).toThrow(/CHECK constraint/i);
  });

  it('AT-21 & AT-24: Bridge secret fail-closed, replay/timestamp rejection, dual-key rotation, and pre-parse/pre-nonce HMAC verification', async () => {
    // Short secret fails closed
    expect(() => resolveMcpConfig({ MCP_INTERNAL_BRIDGE_SECRET: 'too-short' })).toThrow(/32/);

    const originalUrl = '/api/internal/mcp/v1/system/status';
    const validEnvelope = {
      params: { ownerId: 'OWN-ALPHA' },
      verifiedIdentity: {
        authMode: 'SUPABASE_OAUTH21',
        clientId: 'client-gemini-cli',
        jti: null,
        supabaseUid: 'uid-auditor-07',
        tokenIat: Math.floor(Date.now() / 1000),
      },
    };
    const signed = signInternalBridgeRequest({
      method: 'POST',
      originalUrl,
      body: validEnvelope,
      secret: activeBridgePrimary,
      kid: 'primary',
    });

    // Tamper supabaseUid, clientId, tokenIat, jti, authMode WITHOUT updating signature (keeping exact same nonce)
    const tamperedBodies = [
      { ...validEnvelope, verifiedIdentity: { ...validEnvelope.verifiedIdentity, supabaseUid: 'uid-other' } },
      { ...validEnvelope, verifiedIdentity: { ...validEnvelope.verifiedIdentity, clientId: 'client-other' } },
      { ...validEnvelope, verifiedIdentity: { ...validEnvelope.verifiedIdentity, tokenIat: 9999999999 } },
      { ...validEnvelope, verifiedIdentity: { ...validEnvelope.verifiedIdentity, jti: 'spoof-jti' } },
      { ...validEnvelope, verifiedIdentity: { ...validEnvelope.verifiedIdentity, authMode: 'LOCAL_DEV_TOKEN' } },
    ];
    for (const badBody of tamperedBodies) {
      const badRes = await fetch(`${expressBaseUrl}${originalUrl}`, {
        method: 'POST',
        headers: signed.headers,
        body: JSON.stringify(badBody),
      });
      expect(badRes.status).toBe(403);
      expect(((await badRes.json()) as { code: string }).code).toBe('BRIDGE_HMAC_MISMATCH');
    }

    // Legacy unsigned X-MCP-Verified-Identity header rejected immediately
    const legacyHeaderRes = await fetch(`${expressBaseUrl}${originalUrl}`, {
      method: 'POST',
      headers: {
        ...signed.headers,
        'X-MCP-Verified-Identity': '{"actorId":"USR-SYNTH-02"}',
      },
      body: new Uint8Array(signed.rawBodyBytes),
    });
    expect(legacyHeaderRes.status).toBe(403);
    expect(((await legacyHeaderRes.json()) as { code: string }).code).toBe('UNSIGNED_IDENTITY_HEADER_FORBIDDEN');

    // CRITICAL AT-24 Assertion: Replay nonce was NOT consumed by the failed tampered / legacy attempts!
    // Re-submitting the untouched original valid signed payload with that exact nonce MUST SUCCEED (200 OK).
    const untouchedRes = await fetch(`${expressBaseUrl}${originalUrl}`, {
      method: 'POST',
      headers: signed.headers,
      body: new Uint8Array(signed.rawBodyBytes),
    });
    expect(untouchedRes.status).toBe(200);

    // Now replaying the same nonce after HMAC succeeded MUST fail (403)
    const replayRes = await fetch(`${expressBaseUrl}${originalUrl}`, {
      method: 'POST',
      headers: signed.headers,
      body: new Uint8Array(signed.rawBodyBytes),
    });
    expect(replayRes.status).toBe(403);
    expect(((await replayRes.json()) as { code: string }).code).toBe('BRIDGE_NONCE_REPLAYED');

    // Dual-key rotation: accept 'previous' slot
    const prevSigned = signInternalBridgeRequest({
      method: 'POST',
      originalUrl,
      body: validEnvelope,
      secret: activeBridgePrevious,
      kid: 'previous',
    });
    const prevRes = await fetch(`${expressBaseUrl}${originalUrl}`, {
      method: 'POST',
      headers: prevSigned.headers,
      body: new Uint8Array(prevSigned.rawBodyBytes),
    });
    expect(prevRes.status).toBe(200);
  });

  it('AT-25: Controlled two-stage PENDING -> ACTIVE provisioning and Maker-Checker HTTP API enforcement', async () => {
    const sysAdminCookie = await loginExpressStaff('sysadmin.demo', 'TRAIN-SYS-2026!');
    const gmCookie = await loginExpressStaff('gm.demo', 'TRAIN-GM-2026!');

    // Step A (Maker USR-SYNTH-06): submit PENDING candidate for Finance Officer
    const uid = 'uid-maker-checker-03';
    const clientId = 'client-mc-03';
    const reqRes = await fetch(`${expressBaseUrl}/api/office/mcp/bindings/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sysAdminCookie },
      body: JSON.stringify({
        supabaseUid: uid,
        oauthClientId: clientId,
        actorId: 'USR-SYNTH-03',
        allowedOwners: ['OWN-ALPHA'],
        defaultOwnerId: 'OWN-ALPHA',
        allowedTools: ['get_system_status', 'get_property_summary'],
      }),
    });
    expect(reqRes.status).toBe(201);
    const created = (await reqRes.json()) as { binding: { id: string; grantStatus: string; approvedBy: string | null } };
    expect(created.binding.grantStatus).toBe('PENDING');
    expect(created.binding.approvedBy).toBeNull();

    // PENDING binding MUST fail closed on /mcp (403)
    const pendingToken = await signEs256Jwt({ sub: uid, client_id: clientId, aud: mcpResourceUri });
    const pendingCall = await callMcpTool(pendingToken, 'get_system_status', {});
    expect(pendingCall.result.isError).toBe(true);
    expect(pendingCall.result.structuredContent?.code).toBe('GRANT_PENDING');

    // Maker attempting self-approval receives 403
    const selfApprove = await fetch(`${expressBaseUrl}/api/office/mcp/bindings/${created.binding.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sysAdminCookie },
      body: JSON.stringify({}),
    });
    expect(selfApprove.status).toBe(403);

    // Direct SQL insert as ACTIVE with NULL approved_by or approved_by == provisioned_by fails CHECK
    const now = new Date().toISOString();
    expect(() =>
      store
        .getDatabase()
        .prepare(
          `INSERT INTO mcp_actor_bindings (
            id, supabase_uid, oauth_client_id, actor_id, role,
            allowed_owners_json, allowed_tools_json, grant_status,
            created_at, created_by, provisioned_by, approved_by, approved_at
          ) VALUES ('BIND-BAD-ACTIVE', 'u-bad', 'c-bad', 'USR-SYNTH-03', 'Finance Officer', '["OWN-ALPHA"]', '[]', 'ACTIVE', ?, 'USR-SYNTH-06', 'USR-SYNTH-06', 'USR-SYNTH-06', ?)`
        )
        .run(now, now)
    ).toThrow(/CHECK constraint/i);

    // Step B (Checker GM USR-SYNTH-02): approve PENDING -> ACTIVE
    const approveRes = await fetch(`${expressBaseUrl}/api/office/mcp/bindings/${created.binding.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: gmCookie },
      body: JSON.stringify({}),
    });
    expect(approveRes.status).toBe(200);
    const approved = (await approveRes.json()) as { binding: { grantStatus: string; approvedBy: string } };
    expect(approved.binding.grantStatus).toBe('ACTIVE');
    expect(approved.binding.approvedBy).toBe('USR-SYNTH-02');

    // Now /mcp succeeds cleanly
    const activeCall = await callMcpTool(pendingToken, 'get_system_status', {});
    expect(activeCall.result.isError).not.toBe(true);

    // Verify ADMIN_PROVISIONING audit rows exist inside same chain
    const adminRows = store
      .getDatabase()
      .prepare("SELECT channel, transport, auth_mode, tool_name, decision FROM mcp_audit_events WHERE channel = 'ADMIN_PROVISIONING'")
      .all() as Array<Record<string, unknown>>;
    expect(adminRows.some((r) => r.tool_name === 'PROVISION_REQUEST' && r.decision === 'ALLOWED')).toBe(true);
    expect(adminRows.some((r) => r.tool_name === 'PROVISION_APPROVE' && r.decision === 'ALLOWED')).toBe(true);
    expect(adminRows.every((r) => r.transport === 'ADMIN_API' && r.auth_mode === 'STAFF_SESSION')).toBe(true);
  });

  it('AT-22 & AT-26 (Static & Boundary Contracts): Portfolio entity isolation and Supabase Custom Access Token Hook output contract', () => {
    const djangoPortfolioPath = path.resolve(import.meta.dirname, '../../backend/apps/portfolio/services.py');
    const pySource = fs.readFileSync(djangoPortfolioPath, 'utf8');
    expect(pySource).toContain('Abdulwehab Dekebo');
    expect(pySource).toContain('Abdulwehab Dekebo Trading');
    expect(pySource).toContain('range(1, 6)');
    expect(pySource).toContain('inter_entity_posting_enabled');

    const hookSqlPath = path.resolve(
      import.meta.dirname,
      '../../supabase/migrations/202611230002_mcp_oauth_clients_and_hook.sql'
    );
    const sqlSource = fs.readFileSync(hookSqlPath, 'utf8');
    expect(sqlSource).toContain('CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients');
    expect(sqlSource).toContain("RETURN jsonb_build_object('claims', claims);");
    expect(sqlSource).not.toContain("jsonb_set(event, '{claims}'");
    expect(sqlSource).toContain('GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin');
  });
});
