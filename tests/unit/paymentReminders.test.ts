import { describe, expect, it } from 'vitest';
import { ChargeRecord } from '../../src/types/prms';
import {
  buildManualReminderCopy,
  getDaysPastDue,
  getMissedDeadlineCharges,
  isChargeMissedDeadline,
  isValidEmailAddress,
  maskMsisdnForDisplay,
} from '../../src/utils/paymentReminders';

const sampleCharges: ChargeRecord[] = [
  {
    id: 'CHG-PAID',
    ownerId: 'OWN-ALPHA',
    leaseId: 'LSE-1',
    tenantId: 'TEN-001',
    unitId: 'UNT-A-101',
    period: '2026-09',
    invoiceNumber: 'INV-SYNTH-A-0901',
    dueDate: '2026-09-05',
    billedEtb: 45000,
    paidEtb: 45000,
    status: 'Paid',
  },
  {
    id: 'CHG-PAST-PARTIAL',
    ownerId: 'OWN-ALPHA',
    leaseId: 'LSE-1',
    tenantId: 'TEN-001',
    unitId: 'UNT-A-101',
    period: '2026-10',
    invoiceNumber: 'INV-SYNTH-A-1001',
    dueDate: '2026-10-05',
    billedEtb: 45000,
    paidEtb: 25000,
    status: 'Partially Paid',
  },
  {
    id: 'CHG-FUTURE-OPEN',
    ownerId: 'OWN-ALPHA',
    leaseId: 'LSE-1',
    tenantId: 'TEN-001',
    unitId: 'UNT-A-101',
    period: '2026-12',
    invoiceNumber: 'INV-SYNTH-A-1201',
    dueDate: '2026-12-05',
    billedEtb: 45000,
    paidEtb: 0,
    status: 'Open',
  },
  {
    id: 'CHG-OVERDUE',
    ownerId: 'OWN-ALPHA',
    leaseId: 'LSE-1',
    tenantId: 'TEN-001',
    unitId: 'UNT-A-101',
    period: '2026-11',
    invoiceNumber: 'INV-SYNTH-A-1101',
    dueDate: '2026-11-05',
    billedEtb: 45000,
    paidEtb: 0,
    status: 'Overdue',
  },
];

describe('paymentReminders utility', () => {
  it('identifies missed-deadline charges with open balance sorted oldest-first', () => {
    const refDate = '2026-11-19';
    expect(isChargeMissedDeadline(sampleCharges[0], refDate)).toBe(false);
    expect(isChargeMissedDeadline(sampleCharges[1], refDate)).toBe(true);
    expect(isChargeMissedDeadline(sampleCharges[2], refDate)).toBe(false);
    expect(isChargeMissedDeadline(sampleCharges[3], refDate)).toBe(true);

    const missed = getMissedDeadlineCharges(sampleCharges, refDate);
    expect(missed.map((c) => c.invoiceNumber)).toEqual([
      'INV-SYNTH-A-1001',
      'INV-SYNTH-A-1101',
    ]);
    expect(getDaysPastDue('2026-11-05', refDate)).toBe(14);
    expect(getDaysPastDue('2026-12-05', refDate)).toBe(0);
  });

  it('validates email addresses and masks MSISDN numbers cleanly', () => {
    expect(isValidEmailAddress('tenant001.demo@synthetic.example.et')).toBe(true);
    expect(isValidEmailAddress('invalid-email')).toBe(false);
    expect(isValidEmailAddress('')).toBe(false);
    expect(maskMsisdnForDisplay('+251910000001')).toBe('+25191****001');
  });

  it('builds bilingual sandbox email and notification copy for selected invoices', () => {
    const missed = getMissedDeadlineCharges(sampleCharges, '2026-11-19');
    const copyEn = buildManualReminderCopy({
      locale: 'en',
      tenantName: 'SYNTH Tenant 001',
      unitLabel: 'A-101',
      charges: missed,
      channel: 'Email & Notification',
      recipientEmail: 'tenant001.demo@synthetic.example.et',
      note: 'Paying Friday afternoon',
    });

    expect(copyEn.totalOpenEtb).toBe(65000);
    expect(copyEn.emailSubject).toContain('INV-SYNTH-A-1001, INV-SYNTH-A-1101');
    expect(copyEn.emailPreviewBody).toContain('ETB 65,000');
    expect(copyEn.emailPreviewBody).toContain('Paying Friday afternoon');
    expect(copyEn.notificationBody).toContain('ETB 65,000');

    const copyAm = buildManualReminderCopy({
      locale: 'am',
      tenantName: 'SYNTH Tenant 001',
      unitLabel: 'A-101',
      charges: [missed[0]],
      channel: 'Notification',
      recipientEmail: 'tenant001.demo@synthetic.example.et',
    });
    expect(copyAm.notificationBody).toContain('[AD-PRMS ሙከራ]');
    expect(copyAm.noticeBodyAm).toContain('INV-SYNTH-A-1001');
  });
});
