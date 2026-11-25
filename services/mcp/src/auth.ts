import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type CryptoKey, type JWSHeaderParameters, type FlattenedJWSInput } from 'jose';
import type { VerifiedBridgeIdentity } from '../../../server/mcpBridge.ts';
import type { McpServiceConfig } from './config.ts';

export type JwksKeyLookup = (
  protectedHeader?: JWSHeaderParameters,
  token?: FlattenedJWSInput
) => Promise<CryptoKey | Uint8Array>;

export interface McpTokenVerificationError {
  ok: false;
  code: string;
  message: string;
}

export interface McpTokenVerificationSuccess {
  ok: true;
  identity: VerifiedBridgeIdentity;
}

export type McpTokenVerificationResult = McpTokenVerificationSuccess | McpTokenVerificationError;

export function signLocalDevBearerToken(
  payload: {
    sub: string;
    client_id: string;
    aud: string;
    iat?: number;
    exp?: number;
    jti?: string | null;
  },
  secret: string
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    sub: payload.sub,
    client_id: payload.client_id,
    aud: payload.aud,
    iat: payload.iat ?? nowSec,
    exp: payload.exp ?? nowSec + 300,
    jti: payload.jti ?? null,
    localDev: true,
  };
  const bodyB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', secret).update(bodyB64, 'utf8').digest('base64url');
  return `localdev.${bodyB64}.${sigB64}`;
}

export function createMcpTokenVerifier(
  config: McpServiceConfig,
  customKeyLookup?: JwksKeyLookup
) {
  const jwks = customKeyLookup ?? createRemoteJWKSet(new URL(config.jwksUri));

  return async function verifyBearerToken(rawToken: string): Promise<McpTokenVerificationResult> {
    const token = rawToken.trim();
    if (!token) {
      return { ok: false, code: 'EMPTY_BEARER_TOKEN', message: 'Empty Bearer token.' };
    }

    // Local Dev Token path (explicitly gated by fail-closed startup rules)
    if (token.startsWith('localdev.')) {
      if (!config.allowLocalDevToken) {
        return {
          ok: false,
          code: 'LOCAL_DEV_TOKEN_DISABLED',
          message: 'Local development tokens are disabled on this server.',
        };
      }
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { ok: false, code: 'LOCAL_DEV_TOKEN_MALFORMED', message: 'Malformed local dev token.' };
      }
      const [, bodyB64, sigB64] = parts;
      const expectedSig = crypto
        .createHmac('sha256', config.localDevTokenSecret)
        .update(bodyB64, 'utf8')
        .digest('base64url');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');
      const receivedBuf = Buffer.from(sigB64, 'utf8');
      if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
        return { ok: false, code: 'LOCAL_DEV_TOKEN_INVALID_SIG', message: 'Invalid local dev token signature.' };
      }
      try {
        const parsed = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as Record<string, unknown>;
        const nowSec = Math.floor(Date.now() / 1000);
        if (parsed.aud !== config.resourceUri) {
          return { ok: false, code: 'JWT_AUDIENCE_MISMATCH', message: 'Token audience does not match MCP_RESOURCE_URI.' };
        }
        if (typeof parsed.exp !== 'number' || parsed.exp <= nowSec - 30) {
          return { ok: false, code: 'JWT_EXPIRED', message: 'Local dev token expired.' };
        }
        if (typeof parsed.sub !== 'string' || !parsed.sub.trim() || typeof parsed.client_id !== 'string' || !parsed.client_id.trim()) {
          return { ok: false, code: 'JWT_CLAIMS_MISSING', message: 'Missing sub or client_id.' };
        }
        const iat = typeof parsed.iat === 'number' && Number.isFinite(parsed.iat) ? Math.floor(parsed.iat) : nowSec;
        return {
          ok: true,
          identity: {
            authMode: 'LOCAL_DEV_TOKEN',
            supabaseUid: parsed.sub.trim(),
            clientId: parsed.client_id.trim(),
            tokenIat: iat,
            jti: typeof parsed.jti === 'string' && parsed.jti.trim() ? parsed.jti.trim() : null,
          },
        };
      } catch {
        return { ok: false, code: 'LOCAL_DEV_TOKEN_PARSE_ERROR', message: 'Invalid local dev token payload.' };
      }
    }

    // Standard Supabase OAuth 2.1 JWT verification: ES256-only matching live Supabase JWKS
    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['ES256'],
        issuer: config.supabaseIssuer,
        audience: config.resourceUri,
        clockTolerance: 30,
      });

      // Double-check strict non-empty aud against "authenticated" or wildcard leaks
      const audList = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === 'string' ? [payload.aud] : [];
      if (!audList.includes(config.resourceUri) || audList.includes('authenticated')) {
        return {
          ok: false,
          code: 'JWT_AUDIENCE_MISMATCH',
          message: 'Token audience must match canonical MCP_RESOURCE_URI ("authenticated" is forbidden).',
        };
      }

      const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
      const rawClientId =
        typeof (payload as Record<string, unknown>).client_id === 'string'
          ? String((payload as Record<string, unknown>).client_id).trim()
          : '';

      if (!sub || !rawClientId) {
        return {
          ok: false,
          code: 'JWT_SUBJECT_OR_CLIENT_MISSING',
          message: 'Access token is missing required sub or client_id claim.',
        };
      }

      const tokenIat =
        typeof payload.iat === 'number' && Number.isFinite(payload.iat) ? Math.floor(payload.iat) : 0;
      if (tokenIat <= 0) {
        return { ok: false, code: 'JWT_IAT_MISSING', message: 'Access token is missing valid iat claim.' };
      }

      const jti = typeof payload.jti === 'string' && payload.jti.trim() ? payload.jti.trim() : null;

      return {
        ok: true,
        identity: {
          authMode: 'SUPABASE_OAUTH21',
          supabaseUid: sub,
          clientId: rawClientId,
          tokenIat,
          jti,
        },
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : 'JWT verification failed.';
      let code = 'JWT_VERIFICATION_FAILED';
      if (msg.toLowerCase().includes('aud')) code = 'JWT_AUDIENCE_MISMATCH';
      else if (name === 'JWTExpired') code = 'JWT_EXPIRED';
      else if (msg.toLowerCase().includes('iss')) code = 'JWT_ISSUER_MISMATCH';
      else if (msg.toLowerCase().includes('alg')) code = 'JWT_ALGORITHM_REJECTED';

      return { ok: false, code, message: msg };
    }
  };
}
