import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { createArifPayCheckoutSession } from '../../src/services/arifpayGatewayService';
import { fetchWithTimeout } from '../../src/utils/fetchWithTimeout';
import { signPaymentQrPayload, verifySignedPaymentQrPayload } from '../../src/utils/paymentQr';

const server = setupServer();

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('Gateway & Network Negative Edge Cases', () => {
  it('handles HTTP 500 gateway error via fetchWithTimeout cleanly', async () => {
    server.use(
      http.post('https://sandbox.gateway.local/api/checkout', () => {
        return HttpResponse.json({ detail: 'Upstream gateway error' }, { status: 500 });
      })
    );

    const res = await fetchWithTimeout('https://sandbox.gateway.local/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ amountEtb: 12000 }),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });

  it('aborts hung gateway connections via AbortController timeout', async () => {
    server.use(
      http.get('https://sandbox.gateway.local/api/slow', async () => {
        await delay(300);
        return HttpResponse.json({ ok: true });
      })
    );

    await expect(
      fetchWithTimeout('https://sandbox.gateway.local/api/slow', { method: 'GET' }, 30)
    ).rejects.toThrow();
  });

  it('validates HMAC-SHA256 QR signatures, tampered payloads, and expired timestamps', async () => {
    const secret = 'test-qr-hmac-secret-2026';
    const baseUrl = 'telebirr://pay?merch=204910&inv=INV-ALPHA-1&amt=22000&ref=TEL-QR-001';
    const signed = await signPaymentQrPayload(baseUrl, secret, 60_000);

    await expect(verifySignedPaymentQrPayload(signed, secret)).resolves.toEqual({ valid: true });

    const tampered = signed.replace('amt=22000', 'amt=100');
    const tamperedResult = await verifySignedPaymentQrPayload(tampered, secret);
    expect(tamperedResult.valid).toBe(false);

    const expired = await signPaymentQrPayload(baseUrl, secret, 1000);
    const expiredResult = await verifySignedPaymentQrPayload(expired, secret, Date.now() + 10_000);
    expect(expiredResult.valid).toBe(false);
    expect(expiredResult.reason).toMatch(/expired/i);
  });

  it('rejects non-positive ArifPay session amounts cleanly', async () => {
    await expect(
      createArifPayCheckoutSession({
        ownerId: 'OWN-ALPHA',
        tenantId: 'TEN-001',
        tenantName: 'SYNTH Tenant 001',
        unitId: 'UNT-A-101',
        chargeId: 'CHG-ZERO',
        invoiceNumber: 'INV-ZERO',
        amountEtb: 0,
        openBalanceEtb: 22000,
        selectedMethod: 'TELEBIRR',
        msisdn: '+251911234567',
      })
    ).resolves.toMatchObject({ ok: false });
  });
});
