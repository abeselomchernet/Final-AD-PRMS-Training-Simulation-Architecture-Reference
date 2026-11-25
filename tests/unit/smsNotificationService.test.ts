import { describe, expect, it } from 'vitest';
import { buildBilingualSmsBody } from '../../src/services/smsNotificationService';
import { SmsTriggerType } from '../../src/types/prms';

describe('Automated Bilingual SMS Notification Service', () => {
  const triggers: SmsTriggerType[] = [
    'Rent Due Soon',
    'Overdue Reminder',
    'Payment Confirmed',
    'Maintenance Update',
    'General Notice',
  ];

  it('generates distinct non-empty English and Amharic sandbox templates for all 5 trigger types', () => {
    const params = {
      tenantName: 'SYNTH Tenant 001',
      unitCode: 'A-101',
      amountEtb: 45000,
      invoiceNumber: 'INV-SYNTH-001',
      dueDate: '2026-11-30',
      receiptNumber: 'RCT-DEMO-1001',
      ticketNumber: 'MNT-2026-01',
      workOrderState: 'Scheduled',
      noticeTitle: 'Water Tank Cleaning',
    };

    for (const trigger of triggers) {
      const en = buildBilingualSmsBody(trigger, 'en', params);
      const am = buildBilingualSmsBody(trigger, 'am', params);

      expect(en).toContain('DEMO');
      expect(am).toContain('ሙከራ');
      expect(en).toContain('A-101');
      expect(am).toContain('A-101');
      expect(en).not.toBe(am);
    }
  });
});
