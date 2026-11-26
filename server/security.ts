import crypto from 'node:crypto';
import type { Request } from 'express';

export interface OfficeAuthDirectoryEntry {
  username: string;
  passwordPlaceholder: string;
  actorId: string;
  displayName: string;
  role: string;
  isTrainer: boolean;
  allowedOwners: string[];
  defaultOwnerId: string;
  sessionType: 'staff' | 'tenant';
  tenantId?: string;
}

export interface OfficeSessionClaims {
  sub: string;
  username: string;
  displayName: string;
  role: string;
  isTrainer: boolean;
  allowedOwners: string[];
  defaultOwnerId: string;
  sessionType: 'staff' | 'tenant';
  tenantId?: string;
  iat: number;
  exp: number;
}

export const OFFICE_SESSION_COOKIE_NAME = 'adprms_office_sid';
const SESSION_TTL_SECONDS = 4 * 60 * 60;

export const STAFF_DIRECTORY: OfficeAuthDirectoryEntry[] = [
  {
    username: 'gm.demo',
    passwordPlaceholder: 'TRAIN-GM-2026!',
    actorId: 'USR-SYNTH-02',
    displayName: 'Demo General Manager',
    role: 'General Manager',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'am.demo',
    passwordPlaceholder: 'TRAIN-AM-2026!',
    actorId: 'USR-SYNTH-09',
    displayName: 'Demo Assistant Manager',
    role: 'Assistant Manager',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'finance.demo',
    passwordPlaceholder: 'TRAIN-FIN-2026!',
    actorId: 'USR-SYNTH-03',
    displayName: 'Demo Finance Officer',
    role: 'Finance Officer',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'clerk.demo',
    passwordPlaceholder: 'TRAIN-CLK-2026!',
    actorId: 'USR-SYNTH-10',
    displayName: 'Demo Front-Office Clerk',
    role: 'Clerk',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'owner.alpha.demo',
    passwordPlaceholder: 'TRAIN-OWN-2026!',
    actorId: 'USR-SYNTH-01',
    displayName: 'Test Owner Alpha (Director Demo)',
    role: 'Owner / Director',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'collections.demo',
    passwordPlaceholder: 'TRAIN-COL-2026!',
    actorId: 'USR-SYNTH-04',
    displayName: 'Demo Collections Clerk',
    role: 'Collections Clerk',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'property.demo',
    passwordPlaceholder: 'TRAIN-PRP-2026!',
    actorId: 'USR-SYNTH-05',
    displayName: 'Demo Property Clerk',
    role: 'Property Clerk',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'sysadmin.demo',
    passwordPlaceholder: 'TRAIN-SYS-2026!',
    actorId: 'USR-SYNTH-06',
    displayName: 'Demo System Administrator',
    role: 'System Administrator',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'auditor.demo',
    passwordPlaceholder: 'TRAIN-AUD-2026!',
    actorId: 'USR-SYNTH-07',
    displayName: 'Demo Internal Auditor',
    role: 'Auditor / Read-only reviewer',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
  {
    username: 'trainer.demo',
    passwordPlaceholder: 'TRAIN-RESET-2026!',
    actorId: 'USR-TRAINER-00',
    displayName: 'Demo Training Coordinator',
    role: 'Training Coordinator',
    isTrainer: true,
    allowedOwners: ['OWN-ALPHA', 'OWN-BETA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'staff',
  },
];

const TENANT_DIRECTORY: OfficeAuthDirectoryEntry[] = [
  {
    username: 'tenant.a101.demo',
    passwordPlaceholder: 'TENANT-A101-2026!',
    actorId: 'TEN-ACC-01',
    displayName: 'SYNTH Tenant 001 (Unit A-101)',
    role: 'Tenant',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'tenant',
    tenantId: 'TEN-001',
  },
  {
    username: 'tenant.a102.demo',
    passwordPlaceholder: 'TENANT-A102-2026!',
    actorId: 'TEN-ACC-02',
    displayName: 'SYNTH Tenant 002 (Unit A-102)',
    role: 'Tenant',
    isTrainer: false,
    allowedOwners: ['OWN-ALPHA'],
    defaultOwnerId: 'OWN-ALPHA',
    sessionType: 'tenant',
    tenantId: 'TEN-002',
  },
  {
    username: 'tenant.b101.demo',
    passwordPlaceholder: 'TENANT-B101-2026!',
    actorId: 'TEN-ACC-03',
    displayName: 'SYNTH Tenant 003 (Unit B-101)',
    role: 'Tenant',
    isTrainer: false,
    allowedOwners: ['OWN-BETA'],
    defaultOwnerId: 'OWN-BETA',
    sessionType: 'tenant',
    tenantId: 'TEN-003',
  },
];

const ALL_DIRECTORY = [...STAFF_DIRECTORY, ...TENANT_DIRECTORY];

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

export function getOfficeSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.OFFICE_SESSION_SECRET || '').trim();
  return configured.length >= 16 ? configured : EPHEMERAL_FALLBACK_SECRET;
}

export function resolveBindHost(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host' && argv[i + 1]) {
      return argv[i + 1].trim();
    }
    if (arg.startsWith('--host=')) {
      const val = arg.slice('--host='.length).trim();
      if (val) return val;
    }
  }
  if (env.HOST && env.HOST.trim()) {
    return env.HOST.trim();
  }
  if (String(env.OFFICE_ENABLE_LAN || '').toLowerCase() === 'true') {
    return '0.0.0.0';
  }
  if (env.K_SERVICE || env.CLOUD_RUN_JOB || env.CODESANDBOX_HOST) {
    return '0.0.0.0';
  }
  return '127.0.0.1';
}

export function resolveListenPort(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): number {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (arg.startsWith('--port=')) {
      const n = Number(arg.slice('--port='.length));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const envPort = Number(env.PORT || 3000);
  return Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
}

export function resolveAllowedViteHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = new Set<string>(['localhost', '127.0.0.1', '.run.app']);
  const appUrl = (env.APP_URL || '').trim();
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.hostname) hosts.add(parsed.hostname);
    } catch {
      // Ignore malformed APP_URL cleanly
    }
  }
  const extra = (env.ALLOWED_VITE_HOSTS || '').trim();
  if (extra) {
    for (const part of extra.split(',')) {
      const trimmed = part.trim();
      if (trimmed) hosts.add(trimmed);
    }
  }
  return [...hosts];
}

export function authenticateOfficeCredential(
  username: string,
  password: string
): OfficeAuthDirectoryEntry | null {
  const norm = username.trim().toLowerCase();
  const entry = ALL_DIRECTORY.find((item) => item.username.toLowerCase() === norm);
  if (!entry) return null;
  const expected = Buffer.from(entry.passwordPlaceholder, 'utf8');
  const received = Buffer.from(password.trim(), 'utf8');
  if (expected.length !== received.length) return null;
  return crypto.timingSafeEqual(expected, received) ? entry : null;
}

export function findDirectoryEntryByUsername(username: string): OfficeAuthDirectoryEntry | null {
  const norm = username.trim().toLowerCase();
  return ALL_DIRECTORY.find((item) => item.username.toLowerCase() === norm) || null;
}

export function findStaffEntryByActorId(actorId: string): OfficeAuthDirectoryEntry | null {
  const norm = actorId.trim();
  return STAFF_DIRECTORY.find((item) => item.actorId === norm && item.sessionType === 'staff') || null;
}

export function buildClaimsFromDirectory(entry: OfficeAuthDirectoryEntry): OfficeSessionClaims {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    sub: entry.actorId,
    username: entry.username,
    displayName: entry.displayName,
    role: entry.role,
    isTrainer: entry.isTrainer,
    allowedOwners: entry.allowedOwners,
    defaultOwnerId: entry.defaultOwnerId,
    sessionType: entry.sessionType,
    tenantId: entry.tenantId,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
}

export function signOfficeSessionToken(
  claims: OfficeSessionClaims,
  secret: string = getOfficeSessionSecret()
): string {
  const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

export function verifyOfficeSessionToken(
  token: string,
  secret: string = getOfficeSessionSecret()
): OfficeSessionClaims | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const receivedBuf = Buffer.from(sigB64, 'utf8');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as OfficeSessionClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < nowSec) {
      return null;
    }
    if (!parsed.sub || !parsed.role || !Array.isArray(parsed.allowedOwners)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const rawVal = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(rawVal);
    } catch {
      out[key] = rawVal;
    }
  }
  return out;
}

export function extractOfficeSessionFromHeaders(
  headers: Request['headers'] | Record<string, string | string[] | undefined>,
  secret: string = getOfficeSessionSecret()
): OfficeSessionClaims | null {
  const rawAuth = typeof headers.authorization === 'string' ? headers.authorization.trim() : '';
  if (rawAuth.toLowerCase().startsWith('bearer ')) {
    const claims = verifyOfficeSessionToken(rawAuth.slice(7).trim(), secret);
    if (claims) return claims;
  }
  const rawCookie = typeof headers.cookie === 'string' ? headers.cookie : undefined;
  const cookies = parseCookies(rawCookie);
  const cookieToken = cookies[OFFICE_SESSION_COOKIE_NAME];
  if (cookieToken) {
    return verifyOfficeSessionToken(cookieToken, secret);
  }
  return null;
}

export interface WebhookVerifyResult {
  ok: boolean;
  status: number;
  reason?: string;
}

export function verifyArifPayWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  timestampHeader?: string;
  secret?: string;
  nowMs?: number;
}): WebhookVerifyResult {
  const secret = (params.secret ?? process.env.ARIFPAY_WEBHOOK_SECRET ?? '').trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      reason: 'ARIFPAY_WEBHOOK_SECRET is not configured; fail-closed.',
    };
  }
  const sig = params.signatureHeader.trim();
  if (!sig) {
    return { ok: false, status: 403, reason: 'Missing ArifPay HMAC signature.' };
  }
  if (params.timestampHeader) {
    const parsedTs = Number(params.timestampHeader);
    const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
    if (!Number.isFinite(parsedTs) || Math.abs(nowSec - parsedTs) > 300) {
      return { ok: false, status: 403, reason: 'Stale or invalid ArifPay webhook timestamp.' };
    }
  }
  const expected = crypto.createHmac('sha256', secret).update(params.rawBody).digest('hex');
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
    return valid
      ? { ok: true, status: 200 }
      : { ok: false, status: 403, reason: 'Invalid ArifPay webhook signature.' };
  } catch {
    return { ok: false, status: 403, reason: 'Invalid ArifPay webhook signature.' };
  }
}

export function verifyTelebirrWebhookSignature(params: {
  payload: Record<string, unknown>;
  publicKeyPem?: string;
  nowMs?: number;
}): WebhookVerifyResult {
  const publicKeyPem = (params.publicKeyPem ?? process.env.TELEBIRR_PUBLIC_KEY_PEM ?? '').trim();
  if (!publicKeyPem) {
    return {
      ok: false,
      status: 503,
      reason: 'TELEBIRR_PUBLIC_KEY_PEM is not configured; fail-closed.',
    };
  }
  const sig = String(params.payload.sign || '').trim();
  if (!sig) {
    return { ok: false, status: 403, reason: 'Missing Telebirr RSA signature.' };
  }
  if (params.payload.timestamp !== undefined) {
    const rawTs = Number(params.payload.timestamp);
    const tsSec = rawTs > 1e12 ? Math.floor(rawTs / 1000) : rawTs;
    const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
    if (!Number.isFinite(tsSec) || Math.abs(nowSec - tsSec) > 300) {
      return { ok: false, status: 403, reason: 'Stale or invalid Telebirr webhook timestamp.' };
    }
  }
  const canonical = Object.keys(params.payload)
    .filter(
      (k) =>
        params.payload[k] !== undefined &&
        params.payload[k] !== null &&
        params.payload[k] !== '' &&
        k !== 'sign' &&
        k !== 'sign_type'
    )
    .sort()
    .map((k) => `${k}=${params.payload[k]}`)
    .join('&');
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(canonical);
    const valid = verifier.verify(publicKeyPem, sig, 'base64');
    return valid
      ? { ok: true, status: 200 }
      : { ok: false, status: 403, reason: 'Invalid Telebirr RSA signature.' };
  } catch {
    return { ok: false, status: 403, reason: 'Invalid Telebirr RSA signature.' };
  }
}

export const AUTH_RATE_LIMIT_PRODUCTION_DEFAULT = 10;
export const AUTH_RATE_LIMIT_DEV_DEFAULT = 100;
export const AUTH_RATE_LIMIT_OVERRIDE_MIN = 1;
export const AUTH_RATE_LIMIT_OVERRIDE_MAX = 500;
export const AUTH_RATE_LIMIT_PLAYWRIGHT_DEFAULT = 120;

export function resolveAuthRateLimitMax(
  override: number | undefined,
  isProductionEnv: boolean
): number {
  if (override === undefined) {
    return isProductionEnv ? AUTH_RATE_LIMIT_PRODUCTION_DEFAULT : AUTH_RATE_LIMIT_DEV_DEFAULT;
  }
  if (
    typeof override !== 'number' ||
    !Number.isInteger(override) ||
    override < AUTH_RATE_LIMIT_OVERRIDE_MIN ||
    override > AUTH_RATE_LIMIT_OVERRIDE_MAX
  ) {
    throw new RangeError(
      `Invalid authRateLimitMax override (${String(override)}): must be an integer between ${AUTH_RATE_LIMIT_OVERRIDE_MIN} and ${AUTH_RATE_LIMIT_OVERRIDE_MAX}.`
    );
  }
  return override;
}

export function parsePlaywrightAuthRateLimitOverride(
  env: NodeJS.ProcessEnv = process.env
): number {
  if (env.ADPRMS_E2E_HARNESS !== '1') {
    throw new Error(
      'Refusing Playwright E2E rate-limit override outside designated ADPRMS_E2E_HARNESS=1 launcher.'
    );
  }
  const raw = env.ADPRMS_E2E_AUTH_RATE_LIMIT_MAX;
  if (raw === undefined || raw.trim() === '') {
    return AUTH_RATE_LIMIT_PLAYWRIGHT_DEFAULT;
  }
  const trimmed = raw.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new RangeError(
      `Invalid ADPRMS_E2E_AUTH_RATE_LIMIT_MAX (${raw}): must be a positive integer between ${AUTH_RATE_LIMIT_OVERRIDE_MIN} and ${AUTH_RATE_LIMIT_OVERRIDE_MAX}.`
    );
  }
  const parsed = Number(trimmed);
  return resolveAuthRateLimitMax(parsed, true);
}

