import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { buildArifPayCheckoutTestSession } from '../helpers/qrFixtures';
import {
  buildArifPayQrPayload,
  buildTelebirrQrPayload,
  parsePaymentQrPayload,
} from '../../src/utils/paymentQr';
import { createTelebirrUssdQrSession } from '../../src/services/telebirrGatewayService';

function decodeQrViaJsQr(payload: string): string | null {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  const count = modules.size;
  const scale = 4;
  const quiet = 4;
  const dim = (count + quiet * 2) * scale;
  const rgba = new Uint8ClampedArray(dim * dim * 4);

  for (let y = 0; y < dim; y += 1) {
    for (let x = 0; x < dim; x += 1) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      const isDark =
        mx >= 0 && my >= 0 && mx < count && my < count && modules.get(my, mx) === 1;
      const idx = (y * dim + x) * 4;
      const val = isDark ? 0 : 255;
      rgba[idx] = val;
      rgba[idx + 1] = val;
      rgba[idx + 2] = val;
      rgba[idx + 3] = 255;
    }
  }

  const decoded = jsQR(rgba, dim, dim);
  return decoded?.data ?? null;
}

describe('paymentQr utilities & jsQR roundtrip', () => {
  it('encodes Telebirr session QR and roundtrip-decodes via jsQR into reference & invoice', () => {
    const created = createTelebirrUssdQrSession({
      ownerId: 'OWN-ALPHA',
      tenantId: 'TEN-001',
      tenantName: 'SYNTH Tenant Alpha',
      unitId: 'UNIT-A101',
      chargeId: 'CHG-A-101',
      invoiceNumber: 'INV-SYNTH-A-1001',
      amountEtb: 22000,
      openBalanceEtb: 25000,
      msisdn: '+251910000001',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const payload = buildTelebirrQrPayload(created.session);
    const decodedText = decodeQrViaJsQr(payload);
    expect(decodedText).toBe(payload);

    const parsed = parsePaymentQrPayload(decodedText!);
    expect(parsed).not.toBeNull();
    expect(parsed?.gateway).toBe('Telebirr USSD QR');
    expect(parsed?.reference).toBe(created.session.transactionRef);
    expect(parsed?.invoiceNumber).toBe('INV-SYNTH-A-1001');
    expect(parsed?.amountEtb).toBe(22000);
    expect(parsed?.sessionId).toBe(created.session.sessionId);
  });

  it('encodes ArifPay checkout QR and roundtrip-decodes via jsQR into transaction reference', () => {
    const arifSession = buildArifPayCheckoutTestSession();
    const payload = buildArifPayQrPayload(arifSession);
    const decodedText = decodeQrViaJsQr(payload);
    expect(decodedText).toBe(payload);

    const parsed = parsePaymentQrPayload(decodedText!);
    expect(parsed).not.toBeNull();
    expect(parsed?.gateway).toBe('ArifPay Checkout');
    expect(parsed?.reference).toBe(arifSession.transactionId);
    expect(parsed?.sessionId).toBe(arifSession.sessionId);
    expect(parsed?.invoiceNumber).toBe(arifSession.invoiceNumber);
    expect(parsed?.amountEtb).toBe(arifSession.amountEtb);
  });

  it('parses raw Telebirr, ArifPay, and CBE reference tokens cleanly', () => {
    expect(parsePaymentQrPayload('TEL-QR-882101')?.gateway).toBe('Telebirr USSD QR');
    expect(parsePaymentQrPayload('AP-SESS-441199')?.gateway).toBe('ArifPay Checkout');
    expect(parsePaymentQrPayload('CBE-MOB-99201')?.gateway).toBe('CBE Transfer Slip');
    expect(parsePaymentQrPayload('   ')).toBeNull();
  });
});
