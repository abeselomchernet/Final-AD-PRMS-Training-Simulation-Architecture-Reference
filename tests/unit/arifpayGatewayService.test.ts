import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildArifPaySessionSync,
  createArifPayCheckoutSession,
  simulateArifPayHostedPayment,
  verifyArifPaySessionFallback,
} from '../../src/services/arifpayGatewayService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ArifPay Hosted Checkout Sandbox Service', () => {
  const validInput = {
    ownerId: 'OWN-ALPHA' as const,
    tenantId: 'TEN-001',
    tenantName: 'SYNTH Tenant 001',
    unitId: 'UNT-A101',
    chargeId: 'CHG-001',
    invoiceNumber: 'INV-SYNTH-2026-01',
    amountEtb: 15000,
    openBalanceEtb: 25000,
    msisdn: '+251910000001',
  };

  it('rejects zero/negative amounts, balance overflow, and malformed MSISDN', () => {
    const zeroRes = buildArifPaySessionSync({ ...validInput, amountEtb: 0 });
    expect(zeroRes.ok).toBe(false);

    const overflowRes = buildArifPaySessionSync({ ...validInput, amountEtb: 30000 });
    expect(overflowRes.ok).toBe(false);

    const badPhoneRes = buildArifPaySessionSync({ ...validInput, msisdn: '12345' });
    expect(badPhoneRes.ok).toBe(false);
  });

  it('enforces nonce idempotency when creating sessions', async () => {
    const nonce = 'AP-TEST-NONCE-IDEMPOTENT-1';
    const first = await createArifPayCheckoutSession({ ...validInput, nonce });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.reused).toBe(false);

    const second = await createArifPayCheckoutSession({ ...validInput, nonce });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.reused).toBe(true);
    expect(second.session.sessionId).toBe(first.session.sessionId);
  });

  it('simulates COMPLETED, CANCELLED, FAILED, and verify-by-session fallback outcomes', async () => {
    const created = buildArifPaySessionSync({
      ...validInput,
      nonce: 'AP-TEST-NONCE-OUTCOMES-1',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const cancelled = await simulateArifPayHostedPayment(created.session, 'TELEBIRR', 'CANCELLED');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.failureReason).toMatch(/cancelled/i);

    const failed = await simulateArifPayHostedPayment(created.session, 'CBE', 'FAILED');
    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toMatch(/declined/i);

    const verified = await verifyArifPaySessionFallback(failed);
    expect(verified.status).toBe('COMPLETED');
    expect(verified.failureReason).toBeUndefined();
  });

  it('returns FAILED when /api/gateways/arifpay/verify responds 404 instead of fabricating COMPLETED', async () => {
    const created = buildArifPaySessionSync({
      ...validInput,
      nonce: 'AP-TEST-NONCE-404-CHECK',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: true, msg: 'ArifPay session not found.' }),
      })
    );

    const verified = await verifyArifPaySessionFallback(created.session);
    expect(verified.status).toBe('FAILED');
    expect(verified.failureReason).toContain('ArifPay session not found');
  });
});
