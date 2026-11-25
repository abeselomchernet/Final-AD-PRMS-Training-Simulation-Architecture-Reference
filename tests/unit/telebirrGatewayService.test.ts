import { describe, expect, it } from 'vitest';
import {
  confirmTelebirrCustomerPin,
  createTelebirrUssdQrSession,
  finalizeTelebirrSettlement,
  generateDeterministicQrMatrix,
  normalizeEthiopianMsisdn,
  runMockTelebirrFlow,
  sendTelebirrUssdPush,
  validateTelebirrInitiation,
  validateTelebirrMsisdn,
} from '../../src/services/telebirrGatewayService';

describe('Telebirr USSD QR Sandbox Service Layer', () => {
  it('normalizes and validates Ethiopian MSISDN numbers', () => {
    expect(normalizeEthiopianMsisdn('0911234567')).toBe('+251911234567');
    expect(normalizeEthiopianMsisdn('+251-91-123-4567')).toBe('+251911234567');
    expect(normalizeEthiopianMsisdn('0701122334')).toBe('+251701122334');

    expect(validateTelebirrMsisdn('0911234567').valid).toBe(true);
    expect(validateTelebirrMsisdn('12345').valid).toBe(false);
    expect(validateTelebirrMsisdn('+14155551234').valid).toBe(false);
  });

  it('rejects invalid amounts exceeding invoice open balance or zero/negative values', () => {
    const tooHigh = validateTelebirrInitiation({
      ownerId: 'OWN-ALPHA',
      tenantId: 'TEN-001',
      tenantName: 'SYNTH Tenant 001',
      unitId: 'UNIT-A101',
      chargeId: 'CHG-A-101',
      invoiceNumber: 'INV-SYNTH-A-1001',
      amountEtb: 50000,
      openBalanceEtb: 20000,
      msisdn: '+251911234567',
    });
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.some((e) => /cannot exceed invoice open balance/i.test(e))).toBe(true);

    const zeroAmt = validateTelebirrInitiation({
      ownerId: 'OWN-ALPHA',
      tenantId: 'TEN-001',
      tenantName: 'SYNTH Tenant 001',
      unitId: 'UNIT-A101',
      chargeId: 'CHG-A-101',
      invoiceNumber: 'INV-SYNTH-A-1001',
      amountEtb: 0,
      openBalanceEtb: 20000,
      msisdn: 'bad-phone',
    });
    expect(zeroAmt.valid).toBe(false);
    expect(zeroAmt.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('generates deterministic 21x21 QR matrix with finder patterns', () => {
    const payload = 'telebirr://pay?merch=204910&inv=INV-SYNTH-A-1001&amt=20000&sess=TB-SESS-100001';
    const matrixA = generateDeterministicQrMatrix(payload);
    const matrixB = generateDeterministicQrMatrix(payload);

    expect(matrixA.length).toBe(21);
    expect(matrixA[0].length).toBe(21);
    expect(matrixA).toEqual(matrixB);
    // Top-left 7x7 finder outer ring
    expect(matrixA[0][0]).toBe(true);
    expect(matrixA[6][6]).toBe(true);
    expect(matrixA[1][1]).toBe(false);
    expect(matrixA[3][3]).toBe(true);
  });

  it('progresses Telebirr USSD QR session cleanly through push, PIN confirmation, and webhook settlement', () => {
    const created = createTelebirrUssdQrSession({
      ownerId: 'OWN-ALPHA',
      tenantId: 'TEN-001',
      tenantName: 'SYNTH Tenant 001',
      unitId: 'UNIT-A101',
      chargeId: 'CHG-A-101',
      invoiceNumber: 'INV-SYNTH-A-1001',
      amountEtb: 20000,
      openBalanceEtb: 20000,
      msisdn: '0911234567',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.session.step).toBe('QR_GENERATED');
    expect(created.session.ussdDialString).toMatch(/^\*127\*1\*204910\*\d{6}#$/);
    expect(created.session.msisdn).toBe('+251911234567');

    const pushed = sendTelebirrUssdPush(created.session);
    expect(pushed.step).toBe('USSD_PUSH_SENT');

    const badPin = confirmTelebirrCustomerPin(pushed, '12');
    expect(badPin.ok).toBe(false);

    const confirmed = confirmTelebirrCustomerPin(pushed, '4321');
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.session.step).toBe('PIN_CONFIRMED');

    const settled = finalizeTelebirrSettlement(confirmed.session, 'SETTLED');
    expect(settled.step).toBe('SETTLED');
    expect(settled.webhookPayload?.tradeStatus).toBe('Completed');
    expect(settled.events.length).toBe(4);
  });

  it('supports one-click runMockTelebirrFlow for success and simulated failure outcomes', () => {
    const baseInput = {
      ownerId: 'OWN-BETA' as const,
      tenantId: 'TEN-003',
      tenantName: 'SYNTH Tenant 003',
      unitId: 'UNIT-B101',
      chargeId: 'CHG-B-111',
      invoiceNumber: 'INV-SYNTH-B-1101',
      amountEtb: 26000,
      openBalanceEtb: 26000,
      msisdn: '+251922847100',
    };

    const success = runMockTelebirrFlow(baseInput);
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.session.step).toBe('SETTLED');
      expect(success.session.webhookPayload?.totalAmount).toBe(26000);
    }

    const timedOut = runMockTelebirrFlow(baseInput, { outcome: 'FAILED_TIMEOUT' });
    expect(timedOut.ok).toBe(true);
    if (timedOut.ok) {
      expect(timedOut.session.step).toBe('FAILED_TIMEOUT');
      expect(timedOut.session.webhookPayload?.tradeStatus).toBe('TimedOut');
      expect(timedOut.session.failureReason).toBeTruthy();
    }
  });
});
