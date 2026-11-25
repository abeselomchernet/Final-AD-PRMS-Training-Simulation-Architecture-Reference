import { ArifPaySession } from '../services/arifpayGatewayService';
import { TelebirrUssdQrSession } from '../services/telebirrGatewayService';

export type PaymentGatewayKind =
  | 'Telebirr USSD QR'
  | 'ArifPay Checkout'
  | 'CBE Transfer Slip';

export interface ParsedPaymentQr {
  gateway: PaymentGatewayKind;
  reference: string;
  sessionId?: string;
  transactionId?: string;
  invoiceNumber?: string;
  amountEtb?: number;
  merchantCode?: string;
  expiresAtMs?: number;
  signature?: string;
  rawPayload: string;
}

async function computeHmacHex(secret: string, message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const nodeCrypto = await import('crypto');
  return nodeCrypto.createHmac('sha256', secret).update(message).digest('hex');
}

export async function signPaymentQrPayload(
  payloadUrl: string,
  secret: string,
  ttlMs = 15 * 60 * 1000
): Promise<string> {
  const sep = payloadUrl.includes('?') ? '&' : '?';
  const exp = Date.now() + Math.max(1000, ttlMs);
  const withExp = `${payloadUrl}${sep}exp=${exp}`;
  const sig = await computeHmacHex(secret, withExp);
  return `${withExp}&sig=${sig}`;
}

export async function verifySignedPaymentQrPayload(
  signedPayload: string,
  secret: string,
  nowMs = Date.now()
): Promise<{ valid: boolean; reason?: string }> {
  const sigIdx = signedPayload.lastIndexOf('&sig=');
  if (sigIdx === -1) {
    return { valid: false, reason: 'Missing QR HMAC signature.' };
  }
  const unsigned = signedPayload.slice(0, sigIdx);
  const sig = signedPayload.slice(sigIdx + 5).trim();
  const expMatch = unsigned.match(/[?&]exp=(\d+)/);
  if (!expMatch) {
    return { valid: false, reason: 'Missing QR expiration timestamp.' };
  }
  const expMs = Number(expMatch[1]);
  if (!Number.isFinite(expMs) || expMs < nowMs) {
    return { valid: false, reason: 'Signed payment QR has expired.' };
  }
  const expected = await computeHmacHex(secret, unsigned);
  if (expected.length !== sig.length) {
    return { valid: false, reason: 'Invalid QR HMAC signature.' };
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0 ? { valid: true } : { valid: false, reason: 'Invalid QR HMAC signature.' };
}

/**
 * Builds a complete, scannable Telebirr QR payload string including the transaction reference
 * so camera QR scanners can auto-populate the reference field directly.
 */
export function buildTelebirrQrPayload(session: TelebirrUssdQrSession): string {
  const base = session.qrPayload;
  if (/[?&]ref=/i.test(base)) {
    return base;
  }
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ref=${encodeURIComponent(session.transactionRef)}`;
}

/**
 * Builds a complete, scannable ArifPay checkout QR payload encoding the hosted session URL,
 * transaction ID, invoice number, and ETB amount.
 */
export function buildArifPayQrPayload(session: ArifPaySession): string {
  const sep = session.checkoutUrl.includes('?') ? '&' : '?';
  return `${session.checkoutUrl}${sep}tx=${encodeURIComponent(
    session.transactionId
  )}&inv=${encodeURIComponent(session.invoiceNumber)}&amt=${encodeURIComponent(
    String(session.amountEtb)
  )}`;
}

/**
 * Parses Telebirr, ArifPay, or raw bank/gateway QR payloads into a normalized reference object.
 */
export function parsePaymentQrPayload(raw: string): ParsedPaymentQr | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Telebirr URI: telebirr://pay?merch=204910&inv=INV-...&amt=22000&sess=TB-SESS-123456&ref=TEL-QR-123456&mode=SANDBOX
  if (/^telebirr:\/\//i.test(trimmed)) {
    try {
      const normalizedUrl = trimmed.replace(/^telebirr:\/\//i, 'https://telebirr.local/');
      const url = new URL(normalizedUrl);
      const sess = url.searchParams.get('sess') || undefined;
      const refParam = url.searchParams.get('ref') || undefined;
      const inv = url.searchParams.get('inv') || undefined;
      const amtRaw = url.searchParams.get('amt');
      const amt = amtRaw && Number.isFinite(Number(amtRaw)) && Number(amtRaw) > 0
        ? Number(amtRaw)
        : undefined;
      const merch = url.searchParams.get('merch') || undefined;
      const expRaw = url.searchParams.get('exp');
      const expiresAtMs = expRaw && /^\d+$/.test(expRaw) ? Number(expRaw) : undefined;
      const signature = url.searchParams.get('sig') || undefined;
      const reference = refParam || sess || `TEL-QR-${trimmed.slice(-6)}`;
      return {
        gateway: 'Telebirr USSD QR',
        reference,
        sessionId: sess,
        invoiceNumber: inv,
        amountEtb: amt,
        merchantCode: merch,
        expiresAtMs,
        signature,
        rawPayload: trimmed,
      };
    } catch {
      return {
        gateway: 'Telebirr USSD QR',
        reference: trimmed,
        rawPayload: trimmed,
      };
    }
  }

  // 2. ArifPay URI or Hosted Checkout URL:
  // https://gateway.arifpay.org/sandbox/checkout/AP-SESS-123456?tx=AP-TX-1234567&inv=...&amt=...
  if (/arifpay/i.test(trimmed) || /\/AP-SESS-\d+/i.test(trimmed)) {
    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : trimmed.replace(/^arifpay:\/\//i, 'https://gateway.arifpay.org/');
      const url = new URL(normalizedUrl);
      const pathMatch = url.pathname.match(/(AP-SESS-[A-Za-z0-9_-]+)/i);
      const sessionId = url.searchParams.get('sess') || pathMatch?.[1] || undefined;
      const tx = url.searchParams.get('tx') || url.searchParams.get('ref') || undefined;
      const inv = url.searchParams.get('inv') || undefined;
      const amtRaw = url.searchParams.get('amt');
      const amt = amtRaw && Number.isFinite(Number(amtRaw)) && Number(amtRaw) > 0
        ? Number(amtRaw)
        : undefined;
      const reference = tx || sessionId || trimmed;
      return {
        gateway: 'ArifPay Checkout',
        reference,
        sessionId,
        transactionId: tx,
        invoiceNumber: inv,
        amountEtb: amt,
        rawPayload: trimmed,
      };
    } catch {
      const sessMatch = trimmed.match(/(AP-SESS-[A-Za-z0-9_-]+)/i);
      const txMatch = trimmed.match(/(AP-TX-[A-Za-z0-9_-]+)/i);
      return {
        gateway: 'ArifPay Checkout',
        reference: txMatch?.[1] || sessMatch?.[1] || trimmed,
        sessionId: sessMatch?.[1],
        transactionId: txMatch?.[1],
        rawPayload: trimmed,
      };
    }
  }

  // 3. Raw Telebirr reference/session token
  if (/^(TB-SESS-|TEL-QR-|TB-TRACE-)/i.test(trimmed)) {
    return {
      gateway: 'Telebirr USSD QR',
      reference: trimmed,
      sessionId: /^TB-SESS-/i.test(trimmed) ? trimmed : undefined,
      rawPayload: trimmed,
    };
  }

  // 4. Raw ArifPay reference/session token
  if (/^(AP-SESS-|AP-TX-)/i.test(trimmed)) {
    return {
      gateway: 'ArifPay Checkout',
      reference: trimmed,
      sessionId: /^AP-SESS-/i.test(trimmed) ? trimmed : undefined,
      transactionId: /^AP-TX-/i.test(trimmed) ? trimmed : undefined,
      rawPayload: trimmed,
    };
  }

  // 5. Generic CBE / bank slip QR string
  return {
    gateway: 'CBE Transfer Slip',
    reference: trimmed.slice(0, 80),
    rawPayload: trimmed,
  };
}
