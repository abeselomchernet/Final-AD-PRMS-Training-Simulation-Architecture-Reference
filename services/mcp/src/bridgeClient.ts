import {
  signInternalBridgeRequest,
  type SignedBridgeToolPayload,
  type SignedPreAuthRejectionPayload,
  type VerifiedBridgeIdentity,
} from '../../../server/mcpBridge.ts';
import type { McpServiceConfig } from './config.ts';

export interface BridgeCallResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export class ExpressBridgeClient {
  private readonly config: McpServiceConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: McpServiceConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async invokeToolRoute(
    internalSubPath: string,
    params: Record<string, unknown>,
    identity: VerifiedBridgeIdentity
  ): Promise<BridgeCallResult> {
    const originalUrl = `/api/internal/mcp/v1${internalSubPath}`;
    const payload: SignedBridgeToolPayload = {
      params,
      verifiedIdentity: identity,
    };

    const signed = signInternalBridgeRequest({
      method: 'POST',
      originalUrl,
      body: payload,
      secret: this.config.bridgeSecret,
      kid: 'primary',
    });

    const response = await this.fetchImpl(`${this.config.expressBaseUrl}${originalUrl}`, {
      method: 'POST',
      headers: signed.headers,
      body: new Uint8Array(signed.rawBodyBytes),
    });

    const body = (await response.json().catch(() => ({
      ok: false,
      code: 'BRIDGE_INVALID_RESPONSE',
      message: 'Express bridge returned a non-JSON response.',
    }))) as Record<string, unknown>;

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  }

  async reportPreAuthRejection(input: SignedPreAuthRejectionPayload): Promise<void> {
    const originalUrl = '/api/internal/mcp/v1/audit/preauth-rejection';
    const signed = signInternalBridgeRequest({
      method: 'POST',
      originalUrl,
      body: input,
      secret: this.config.bridgeSecret,
      kid: 'primary',
    });

    try {
      await this.fetchImpl(`${this.config.expressBaseUrl}${originalUrl}`, {
        method: 'POST',
        headers: signed.headers,
        body: new Uint8Array(signed.rawBodyBytes),
      });
    } catch {
      // Non-fatal telemetry: never obscure the primary 401 WWW-Authenticate response
    }
  }
}
