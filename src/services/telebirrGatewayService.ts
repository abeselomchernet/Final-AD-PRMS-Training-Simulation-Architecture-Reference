import { OwnerId } from '../types/prms';

export type TelebirrFlowStep =
  | 'QR_GENERATED'
  | 'USSD_PUSH_SENT'
  | 'PIN_CONFIRMED'
  | 'SETTLED'
  | 'FAILED_TIMEOUT'
  | 'FAILED_INSUFFICIENT_FUNDS';

export type TelebirrSettlementOutcome =
  | 'SETTLED'
  | 'FAILED_TIMEOUT'
  | 'FAILED_INSUFFICIENT_FUNDS';

export interface TelebirrFlowEvent {
  timestamp: string;
  step: TelebirrFlowStep;
  channel: 'QR' | 'USSD' | 'WEBHOOK';
  label: string;
}

export interface TelebirrWebhookPayload {
  tradeNo: string;
  outTradeNo: string;
  merchantCode: string;
  totalAmount: number;
  currency: 'ETB';
  msisdn: string;
  notifyTime: string;
  tradeStatus: 'Completed' | 'TimedOut' | 'InsufficientBalance';
  signatureType: 'SYNTHETIC-SANDBOX-SHA256';
  signatureDigest: string;
}

export interface TelebirrUssdQrSession {
  sessionId: string;
  traceId: string;
  ownerId: OwnerId;
  tenantId: string;
  tenantName: string;
  unitId: string;
  chargeId: string;
  invoiceNumber: string;
  amountEtb: number;
  feeEtb: number;
  msisdn: string;
  ussdShortCode: string;
  ussdDialString: string;
  qrPayload: string;
  qrMatrix: boolean[][];
  step: TelebirrFlowStep;
  transactionRef: string;
  createdAt: string;
  expiresAt: string;
  failureReason?: string;
  events: TelebirrFlowEvent[];
  webhookPayload?: TelebirrWebhookPayload;
}

export interface TelebirrInitiationInput {
  ownerId: OwnerId;
  tenantId: string;
  tenantName: string;
  unitId: string;
  chargeId: string;
  invoiceNumber: string;
  amountEtb: number;
  openBalanceEtb: number;
  msisdn: string;
}

export const TELEBIRR_SANDBOX_CONFIG = {
  merchantCode: '204910',
  merchantName: 'AD-PRMS Synthetic Rental Escrow (Demo)',
  ussdShortCode: '*127#',
  ussdMenuPrefix: '*127*1*204910',
  sessionTtlSeconds: 180,
  feeEtb: 0,
  modeLabel: 'SYNTHETIC SANDBOX SIMULATION — NO LIVE TELEBIRR API',
} as const;

function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nowIsoShort(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function futureIsoShort(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Normalizes Ethiopian mobile phone formats (09..., 07..., +2519..., +2517...)
 * into canonical +251XXXXXXXXX display format.
 */
export function normalizeEthiopianMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) {
    return `+${digits}`;
  }
  if ((digits.startsWith('09') || digits.startsWith('07')) && digits.length === 10) {
    return `+251${digits.slice(1)}`;
  }
  if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length === 9) {
    return `+251${digits}`;
  }
  return raw.trim();
}

export function validateTelebirrMsisdn(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeEthiopianMsisdn(raw);
  const pattern = /^\+251[79]\d{8}$/;
  if (!pattern.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Enter a valid Ethiopian Telebirr mobile number (+2519XXXXXXXX or 09XXXXXXXX).',
    };
  }
  return { valid: true, normalized };
}

export function validateTelebirrInitiation(input: TelebirrInitiationInput): {
  valid: boolean;
  errors: string[];
  normalizedMsisdn: string;
} {
  const errors: string[] = [];
  if (!input.tenantId) errors.push('Target tenant is required.');
  if (!input.chargeId) errors.push('Target invoice/charge is required.');
  if (!Number.isFinite(input.amountEtb) || input.amountEtb <= 0) {
    errors.push('Payment amount must be greater than ETB 0.');
  } else if (input.amountEtb > input.openBalanceEtb) {
    errors.push(
      `Payment amount (ETB ${input.amountEtb.toLocaleString()}) cannot exceed invoice open balance (ETB ${input.openBalanceEtb.toLocaleString()}).`
    );
  }
  const phoneCheck = validateTelebirrMsisdn(input.msisdn);
  if (!phoneCheck.valid && phoneCheck.error) {
    errors.push(phoneCheck.error);
  }
  return {
    valid: errors.length === 0,
    errors,
    normalizedMsisdn: phoneCheck.normalized,
  };
}

/**
 * Generates a deterministic 21x21 QR-style boolean matrix with canonical 7x7
 * finder patterns in 3 corners, timing lines, and hashed payload modules.
 */
export function generateDeterministicQrMatrix(payload: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const stampFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[rr][cc] = false;
        } else {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = isBorder || isCenter;
        }
      }
    }
  };

  stampFinder(0, 0);
  stampFinder(0, size - 7);
  stampFinder(size - 7, 0);

  // Timing tracks
  for (let i = 8; i < size - 8; i += 1) {
    reserved[6][i] = true;
    matrix[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic pseudo-random module fill seeded from payload
  let state = fnv1aHash(payload) || 0x12345678;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (reserved[r][c]) continue;
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      matrix[r][c] = (state >>> 0) % 100 < 52;
    }
  }

  return matrix;
}

export function createTelebirrUssdQrSession(
  input: TelebirrInitiationInput
): { ok: true; session: TelebirrUssdQrSession } | { ok: false; errors: string[] } {
  const validation = validateTelebirrInitiation(input);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const seedHash = fnv1aHash(
    `${input.ownerId}|${input.chargeId}|${input.amountEtb}|${validation.normalizedMsisdn}|${Date.now()}`
  );
  const suffix6 = String(seedHash % 900000 + 100000);
  const trace6 = String(((seedHash >>> 4) % 900000) + 100000);
  const sessionId = `TB-SESS-${suffix6}`;
  const traceId = `TB-TRACE-${trace6}`;
  const ussdDialString = `${TELEBIRR_SANDBOX_CONFIG.ussdMenuPrefix}*${suffix6}#`;
  const qrPayload = `telebirr://pay?merch=${TELEBIRR_SANDBOX_CONFIG.merchantCode}&inv=${encodeURIComponent(
    input.invoiceNumber
  )}&amt=${input.amountEtb}&sess=${sessionId}&mode=SANDBOX`;

  const createdAt = nowIsoShort();
  const expiresAt = futureIsoShort(TELEBIRR_SANDBOX_CONFIG.sessionTtlSeconds);

  const session: TelebirrUssdQrSession = {
    sessionId,
    traceId,
    ownerId: input.ownerId,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    unitId: input.unitId,
    chargeId: input.chargeId,
    invoiceNumber: input.invoiceNumber,
    amountEtb: input.amountEtb,
    feeEtb: TELEBIRR_SANDBOX_CONFIG.feeEtb,
    msisdn: validation.normalizedMsisdn,
    ussdShortCode: TELEBIRR_SANDBOX_CONFIG.ussdShortCode,
    ussdDialString,
    qrPayload,
    qrMatrix: generateDeterministicQrMatrix(qrPayload),
    step: 'QR_GENERATED',
    transactionRef: `TEL-QR-${suffix6}`,
    createdAt,
    expiresAt,
    events: [
      {
        timestamp: createdAt,
        step: 'QR_GENERATED',
        channel: 'QR',
        label: `Dynamic QR & USSD token ${ussdDialString} generated for ${input.invoiceNumber} (ETB ${input.amountEtb.toLocaleString()}).`,
      },
    ],
  };

  return { ok: true, session };
}

export function sendTelebirrUssdPush(session: TelebirrUssdQrSession): TelebirrUssdQrSession {
  if (session.step !== 'QR_GENERATED') return session;
  const ts = nowIsoShort();
  return {
    ...session,
    step: 'USSD_PUSH_SENT',
    events: [
      ...session.events,
      {
        timestamp: ts,
        step: 'USSD_PUSH_SENT',
        channel: 'USSD',
        label: `USSD Push (${session.ussdShortCode}) delivered to ${session.msisdn} — awaiting tenant PIN confirmation.`,
      },
    ],
  };
}

export function confirmTelebirrCustomerPin(
  session: TelebirrUssdQrSession,
  syntheticPin: string
): { ok: true; session: TelebirrUssdQrSession } | { ok: false; error: string } {
  if (!/^\d{4}$/.test(syntheticPin.trim())) {
    return {
      ok: false,
      error: 'Enter any 4-digit synthetic demo PIN (e.g. 1234) to simulate USSD confirmation.',
    };
  }
  const current =
    session.step === 'QR_GENERATED' ? sendTelebirrUssdPush(session) : session;
  if (current.step !== 'USSD_PUSH_SENT') {
    return {
      ok: false,
      error: `Cannot confirm PIN from session step ${current.step}.`,
    };
  }
  const ts = nowIsoShort();
  return {
    ok: true,
    session: {
      ...current,
      step: 'PIN_CONFIRMED',
      events: [
        ...current.events,
        {
          timestamp: ts,
          step: 'PIN_CONFIRMED',
          channel: 'USSD',
          label: `Tenant handset ${current.msisdn} confirmed synthetic USSD prompt (****).`,
        },
      ],
    },
  };
}

export function finalizeTelebirrSettlement(
  session: TelebirrUssdQrSession,
  outcome: TelebirrSettlementOutcome = 'SETTLED'
): TelebirrUssdQrSession {
  const ts = nowIsoShort();
  const tradeStatusMap: Record<TelebirrSettlementOutcome, TelebirrWebhookPayload['tradeStatus']> = {
    SETTLED: 'Completed',
    FAILED_TIMEOUT: 'TimedOut',
    FAILED_INSUFFICIENT_FUNDS: 'InsufficientBalance',
  };
  const digestSeed = fnv1aHash(
    `${session.sessionId}|${session.transactionRef}|${outcome}|${ts}`
  )
    .toString(16)
    .padStart(8, '0');

  const webhookPayload: TelebirrWebhookPayload = {
    tradeNo: session.transactionRef,
    outTradeNo: session.sessionId,
    merchantCode: TELEBIRR_SANDBOX_CONFIG.merchantCode,
    totalAmount: session.amountEtb,
    currency: 'ETB',
    msisdn: session.msisdn,
    notifyTime: ts,
    tradeStatus: tradeStatusMap[outcome],
    signatureType: 'SYNTHETIC-SANDBOX-SHA256',
    signatureDigest: `demo-sha256-${digestSeed}a91f`,
  };

  if (outcome === 'SETTLED') {
    return {
      ...session,
      step: 'SETTLED',
      webhookPayload,
      events: [
        ...session.events,
        {
          timestamp: ts,
          step: 'SETTLED',
          channel: 'WEBHOOK',
          label: `Sandbox webhook settled ${session.transactionRef} (ETB ${session.amountEtb.toLocaleString()}) — Trace ${session.traceId}.`,
        },
      ],
    };
  }

  const failureReason =
    outcome === 'FAILED_TIMEOUT'
      ? 'USSD session expired after 180s before final wallet debit.'
      : 'Simulated wallet reported insufficient synthetic ETB balance.';

  return {
    ...session,
    step: outcome,
    failureReason,
    webhookPayload,
    events: [
      ...session.events,
      {
        timestamp: ts,
        step: outcome,
        channel: 'WEBHOOK',
        label: `Sandbox settlement declined (${tradeStatusMap[outcome]}): ${failureReason}`,
      },
    ],
  };
}

/**
 * Convenience mock trigger executing the full Telebirr USSD QR payment lifecycle
 * synchronously for fast one-click rent collection simulation in AD-PRMS.
 */
export function runMockTelebirrFlow(
  input: TelebirrInitiationInput,
  options: { syntheticPin?: string; outcome?: TelebirrSettlementOutcome } = {}
): { ok: true; session: TelebirrUssdQrSession } | { ok: false; errors: string[] } {
  const created = createTelebirrUssdQrSession(input);
  if (!created.ok) return created;

  const pushed = sendTelebirrUssdPush(created.session);
  const confirmed = confirmTelebirrCustomerPin(pushed, options.syntheticPin ?? '1234');
  if (!confirmed.ok) {
    return { ok: false, errors: [confirmed.error] };
  }
  const finalized = finalizeTelebirrSettlement(confirmed.session, options.outcome ?? 'SETTLED');
  return { ok: true, session: finalized };
}
