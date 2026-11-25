import { ArifPaySession } from '../../src/services/arifpayGatewayService';

export function buildArifPayCheckoutTestSession(): ArifPaySession {
  return {
    sessionId: 'AP-SESS-778899',
    nonce: 'AP-NONCE-TEST-1',
    ownerId: 'OWN-ALPHA',
    tenantId: 'TEN-001',
    tenantName: 'SYNTH Tenant Alpha',
    unitId: 'UNIT-A101',
    chargeId: 'CHG-A-101',
    invoiceNumber: 'INV-SYNTH-A-1001',
    amountEtb: 22000,
    msisdn: '+251910000001',
    paymentMethods: ['TELEBIRR', 'CBE'],
    selectedMethod: 'TELEBIRR',
    checkoutUrl: 'https://gateway.arifpay.org/sandbox/checkout/AP-SESS-778899',
    notifyUrl: '/api/webhooks/arifpay',
    transactionId: 'AP-TX-4455667',
    status: 'PENDING',
    createdAt: '2026-11-15T10:00:00.000Z',
    expiresAt: '2026-11-15T10:20:00.000Z',
  };
}
