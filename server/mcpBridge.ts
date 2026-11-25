import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import { canonicalJson } from './mcpRbac.ts';

export type BridgeKeyId = 'primary' | 'previous';

export interface VerifiedBridgeIdentity {
  authMode: 'SUPABASE_OAUTH21' | 'LOCAL_DEV_TOKEN' | 'LOCAL_STDIO';
  clientId: string;
  jti: string | null;
  supabaseUid: string;
  tokenIat: number;
}

export interface SignedBridgeToolPayload {
  params: Record<string, unknown>;
  verifiedIdentity: VerifiedBridgeIdentity;
}

export interface SignedPreAuthRejectionPayload {
  transport: 'STREAMABLE_HTTP' | 'STDIO';
  denialReason: string;
  httpStatus: number;
  requestedPath: string;
}

export interface VerifiedBridgeRequest extends Request {
  bridgeBody?: unknown;
  bridgeKid?: BridgeKeyId;
  bridgeNonce?: string;
}

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64_REGEX = /^[0-9a-f]{64}$/;

export function isValidBridgeSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.trim().length >= 32;
}

export function isLoopbackAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.trim().toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
  );
}

export function computeBridgeHmacSignature(params: {
  secret: string;
  method: string;
  originalUrl: string;
  timestamp: string;
  nonce: string;
  kid: BridgeKeyId;
  rawBodyBytes: Buffer;
}): string {
  const bodySha256 = crypto.createHash('sha256').update(params.rawBodyBytes).digest('hex');
  const preimage = [
    'v1',
    params.method.toUpperCase(),
    params.originalUrl,
    params.timestamp,
    params.nonce,
    params.kid,
    bodySha256,
  ].join('\n');
  return crypto.createHmac('sha256', params.secret).update(preimage, 'utf8').digest('hex');
}

export function signInternalBridgeRequest(params: {
  method?: string;
  originalUrl: string;
  body: unknown;
  secret: string;
  kid?: BridgeKeyId;
  timestampSec?: number;
  nonce?: string;
}): {
  rawBodyBytes: Buffer;
  rawBodyText: string;
  headers: Record<string, string>;
} {
  if (!isValidBridgeSecret(params.secret)) {
    throw new Error('MCP_INTERNAL_BRIDGE_SECRET must be at least 32 characters.');
  }
  const method = (params.method || 'POST').toUpperCase();
  const kid: BridgeKeyId = params.kid || 'primary';
  const timestamp = String(params.timestampSec ?? Math.floor(Date.now() / 1000));
  const nonce = params.nonce || crypto.randomUUID();
  const rawBodyText = canonicalJson(params.body);
  const rawBodyBytes = Buffer.from(rawBodyText, 'utf8');
  const signature = computeBridgeHmacSignature({
    secret: params.secret.trim(),
    method,
    originalUrl: params.originalUrl,
    timestamp,
    nonce,
    kid,
    rawBodyBytes,
  });

  return {
    rawBodyBytes,
    rawBodyText,
    headers: {
      'Content-Type': 'application/json',
      'X-MCP-Bridge-Timestamp': timestamp,
      'X-MCP-Bridge-Nonce': nonce,
      'X-MCP-Bridge-Kid': kid,
      'X-MCP-Bridge-Signature': signature,
    },
  };
}

export function createDefaultBridgeReplayCache(): LRUCache<string, true> {
  return new LRUCache<string, true>({
    max: 10_000,
    ttl: 120_000,
  });
}

export function createBridgeAuthMiddleware(options: {
  getPrimarySecret: () => string;
  getPreviousSecret: () => string;
  replayCache: LRUCache<string, true>;
  nowSecFn?: () => number;
  maxClockSkewSec?: number;
  allowNonLoopbackForTests?: boolean;
}) {
  const maxSkew = options.maxClockSkewSec ?? 60;
  const nowSecFn = options.nowSecFn ?? (() => Math.floor(Date.now() / 1000));

  return (req: VerifiedBridgeRequest, res: Response, next: NextFunction): void => {
    // 1. Loopback network restriction
    const remoteIp = req.socket?.remoteAddress || req.ip;
    if (!options.allowNonLoopbackForTests && !isLoopbackAddress(remoteIp)) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_NON_LOOPBACK_FORBIDDEN',
        message: 'Internal MCP bridge endpoints accept loopback connections only.',
      });
      return;
    }

    // Reject legacy/unsigned identity headers unconditionally (ERR-3.1-04 / AMD-3.1-02)
    if (req.headers['x-mcp-verified-identity'] !== undefined) {
      res.status(403).json({
        ok: false,
        code: 'UNSIGNED_IDENTITY_HEADER_FORBIDDEN',
        message: 'Unsigned identity headers are prohibited; verifiedIdentity must be signed in raw body.',
      });
      return;
    }

    // Fail closed if primary secret is not configured cleanly
    const primarySecret = options.getPrimarySecret().trim();
    const previousSecret = options.getPreviousSecret().trim();
    if (!isValidBridgeSecret(primarySecret)) {
      res.status(503).json({
        ok: false,
        code: 'BRIDGE_SECRET_UNCONFIGURED',
        message: 'MCP internal bridge secret is not configured on Express backend.',
      });
      return;
    }

    // 2. Capture raw body bytes (express.raw middleware must run immediately before this)
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({
        ok: false,
        code: 'BRIDGE_RAW_BODY_REQUIRED',
        message: 'Expected application/json raw byte payload.',
      });
      return;
    }

    // 3. Validate bridge metadata headers without consuming nonce yet
    const timestampRaw = String(req.headers['x-mcp-bridge-timestamp'] || '').trim();
    const nonce = String(req.headers['x-mcp-bridge-nonce'] || '').trim();
    const kidRaw = String(req.headers['x-mcp-bridge-kid'] || '').trim();
    const signatureHex = String(req.headers['x-mcp-bridge-signature'] || '').trim().toLowerCase();

    const parsedTs = Number(timestampRaw);
    const nowSec = nowSecFn();
    if (!timestampRaw || !Number.isInteger(parsedTs) || Math.abs(nowSec - parsedTs) > maxSkew) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_TIMESTAMP_INVALID',
        message: 'Stale or invalid X-MCP-Bridge-Timestamp.',
      });
      return;
    }

    if (!UUID_V4_REGEX.test(nonce)) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_NONCE_INVALID',
        message: 'X-MCP-Bridge-Nonce must be a valid UUID v4.',
      });
      return;
    }

    if (kidRaw !== 'primary' && kidRaw !== 'previous') {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_KID_INVALID',
        message: 'Invalid X-MCP-Bridge-Kid key slot.',
      });
      return;
    }

    if (!HEX_64_REGEX.test(signatureHex)) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_SIGNATURE_MALFORMED',
        message: 'Malformed X-MCP-Bridge-Signature.',
      });
      return;
    }

    // Read-only replay check BEFORE HMAC (do NOT insert into cache until HMAC passes)
    if (options.replayCache.has(nonce)) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_NONCE_REPLAYED',
        message: 'Duplicate X-MCP-Bridge-Nonce rejected.',
      });
      return;
    }

    const activeSecret = kidRaw === 'primary' ? primarySecret : previousSecret;
    if (!isValidBridgeSecret(activeSecret)) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_KEY_SLOT_INACTIVE',
        message: `Key slot "${kidRaw}" is inactive.`,
      });
      return;
    }

    // 4. Compute expected HMAC over rawBodyBytes and compare BEFORE JSON.parse or nonce insert
    const expectedHex = computeBridgeHmacSignature({
      secret: activeSecret,
      method: req.method,
      originalUrl: req.originalUrl,
      timestamp: timestampRaw,
      nonce,
      kid: kidRaw,
      rawBodyBytes: req.body,
    });

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const receivedBuf = Buffer.from(signatureHex, 'hex');
    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      res.status(403).json({
        ok: false,
        code: 'BRIDGE_HMAC_MISMATCH',
        message: 'Invalid X-MCP-Bridge-Signature.',
      });
      return;
    }

    // 5. Only after HMAC succeeds: record nonce in LRUCache & parse JSON body
    options.replayCache.set(nonce, true);

    try {
      const parsed = JSON.parse(req.body.toString('utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        res.status(400).json({
          ok: false,
          code: 'BRIDGE_BODY_INVALID',
          message: 'Signed bridge payload must be a JSON object.',
        });
        return;
      }
      req.bridgeBody = parsed;
      req.bridgeKid = kidRaw;
      req.bridgeNonce = nonce;
      next();
    } catch {
      res.status(400).json({
        ok: false,
        code: 'BRIDGE_JSON_PARSE_ERROR',
        message: 'Signed bridge payload is not valid JSON.',
      });
    }
  };
}
