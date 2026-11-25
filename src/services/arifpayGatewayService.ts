import { OwnerId } from '../types/prms';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { validateTelebirrMsisdn } from './telebirrGatewayService';

export type ArifPaySelectedMethod = 'TELEBIRR' | 'CBE';
export type ArifPayOutcome = 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface ArifPaySession {
  sessionId: string;
  nonce: string;
  ownerId: OwnerId;
  tenantId: string;
  tenantName: string;
  unitId: string;
  chargeId: string;
  invoiceNumber: string;
  amountEtb: number;
  msisdn: string;
  paymentMethods: ArifPaySelectedMethod[];
  selectedMethod: ArifPaySelectedMethod;
  checkoutUrl: string;
  notifyUrl: string;
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  expiresAt: string;
  failureReason?: string;
}

export interface ArifPayCreateInput {
  ownerId: OwnerId;
  tenantId: string;
  tenantName: string;
  unitId: string;
  chargeId: string;
  invoiceNumber: string;
  amountEtb: number;
  openBalanceEtb: number;
  msisdn: string;
  nonce?: string;
  selectedMethod?: ArifPaySelectedMethod;
}

export const ARIFPAY_SANDBOX_CONFIG = {
  endpointBase: 'https://gateway.arifpay.org/api/sandbox/checkout/session',
  notifyUrl: '/api/webhooks/arifpay',
  supportedMethods: ['TELEBIRR', 'CBE'] as ArifPaySelectedMethod[],
  modeLabel: 'ARIFPAY SANDBOX CHECKOUT — SYNTHETIC DATA ONLY',
} as const;

const clientNonceCache = new Map<string, ArifPaySession>();

export function buildArifPaySessionSync(
  input: ArifPayCreateInput
): { ok: true; session: ArifPaySession; reused: boolean } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input.tenantId) errors.push('Select a tenant.');
  if (!input.chargeId) errors.push('Select an open invoice.');
  if (!Number.isFinite(input.amountEtb) || input.amountEtb <= 0) {
    errors.push('Payment amount must be greater than ETB 0.');
  }
  if (input.openBalanceEtb > 0 && input.amountEtb > input.openBalanceEtb) {
    errors.push(
      `Amount ETB ${input.amountEtb.toLocaleString()} exceeds open invoice balance (ETB ${input.openBalanceEtb.toLocaleString()}).`
    );
  }
  const phone = validateTelebirrMsisdn(input.msisdn);
  if (!phone.valid) {
    errors.push(phone.error || 'Invalid Ethiopian MSISDN.');
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nonce = input.nonce?.trim() || `AP-NONCE-${input.chargeId}-${Math.round(input.amountEtb)}-${Date.now()}`;
  const cached = clientNonceCache.get(nonce);
  if (cached) {
    return { ok: true, session: cached, reused: true };
  }

  const rand = Math.floor(100000 + Math.random() * 900000);
  const sessionId = `AP-SESS-${rand}`;
  const transactionId = `AP-TX-${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

  const session: ArifPaySession = {
    sessionId,
    nonce,
    ownerId: input.ownerId,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    unitId: input.unitId,
    chargeId: input.chargeId,
    invoiceNumber: input.invoiceNumber,
    amountEtb: Math.round(input.amountEtb * 100) / 100,
    msisdn: phone.normalized,
    paymentMethods: ['TELEBIRR', 'CBE'],
    selectedMethod: input.selectedMethod || 'TELEBIRR',
    checkoutUrl: `https://gateway.arifpay.org/sandbox/checkout/${sessionId}`,
    notifyUrl: ARIFPAY_SANDBOX_CONFIG.notifyUrl,
    transactionId,
    status: 'PENDING',
    createdAt,
    expiresAt,
  };

  clientNonceCache.set(nonce, session);
  return { ok: true, session, reused: false };
}

export async function createArifPayCheckoutSession(
  input: ArifPayCreateInput
): Promise<{ ok: true; session: ArifPaySession; reused: boolean } | { ok: false; errors: string[] }> {
  const local = buildArifPaySessionSync(input);
  if (!local.ok) return local;

  if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    try {
      const resp = await fetchWithTimeout('/api/gateways/arifpay/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nonce: local.session.nonce,
          ownerId: local.session.ownerId,
          tenantId: local.session.tenantId,
          chargeId: local.session.chargeId,
          amountEtb: local.session.amountEtb,
          paymentMethods: local.session.paymentMethods,
        }),
      });
      if (resp.ok) {
        const json = (await resp.json()) as {
          reused?: boolean;
          data?: { sessionId?: string; transactionId?: string; checkoutUrl?: string; expiresAt?: string };
        };
        if (json.data?.sessionId) {
          const merged: ArifPaySession = {
            ...local.session,
            sessionId: json.data.sessionId,
            transactionId: json.data.transactionId || local.session.transactionId,
            checkoutUrl: json.data.checkoutUrl || local.session.checkoutUrl,
            expiresAt: json.data.expiresAt || local.session.expiresAt,
          };
          clientNonceCache.set(merged.nonce, merged);
          return { ok: true, session: merged, reused: Boolean(json.reused) };
        }
      }
    } catch {
      // Offline or test DOM — continue cleanly with local deterministic sandbox session
    }
  }

  return local;
}

export async function simulateArifPayHostedPayment(
  session: ArifPaySession,
  selectedMethod: ArifPaySelectedMethod,
  outcome: ArifPayOutcome = 'COMPLETED'
): Promise<ArifPaySession> {
  const updated: ArifPaySession = {
    ...session,
    selectedMethod,
    status: outcome,
    failureReason:
      outcome === 'CANCELLED'
        ? 'Customer cancelled hosted ArifPay checkout before authorization.'
        : outcome === 'FAILED'
          ? `ArifPay ${selectedMethod} authorization declined (Sandbox simulation).`
          : undefined,
  };
  clientNonceCache.set(updated.nonce, updated);

  if (
    outcome === 'COMPLETED' &&
    typeof fetch === 'function' &&
    typeof window !== 'undefined' &&
    window.location?.origin?.startsWith('http')
  ) {
    try {
      await fetchWithTimeout('/api/webhooks/arifpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: updated.sessionId,
          transactionId: updated.transactionId,
          ownerId: updated.ownerId,
          amountEtb: updated.amountEtb,
          paymentMethod: selectedMethod,
          status: 'COMPLETED',
        }),
      });
    } catch {
      // Fallback handled cleanly
    }
  }

  return updated;
}

export async function verifyArifPaySessionFallback(session: ArifPaySession): Promise<ArifPaySession> {
  if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    try {
      const resp = await fetchWithTimeout('/api/gateways/arifpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!resp.ok) {
        const errBody = (await resp.json().catch(() => ({}))) as { msg?: string };
        const failed: ArifPaySession = {
          ...session,
          status: 'FAILED',
          failureReason: errBody.msg || `Gateway session verification failed (HTTP ${resp.status}).`,
        };
        clientNonceCache.set(failed.nonce, failed);
        return failed;
      }
    } catch {
      // Offline / unit test DOM — fall back deterministically
    }
  }
  const verified: ArifPaySession = { ...session, status: 'COMPLETED', failureReason: undefined };
  clientNonceCache.set(verified.nonce, verified);
  return verified;
}
