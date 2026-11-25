import { UiLocale } from '../data/i18n';
import { SmsTriggerType } from '../types/prms';

export interface SmsTemplateParams {
  tenantName: string;
  unitCode: string;
  amountEtb?: number;
  invoiceNumber?: string;
  dueDate?: string;
  receiptNumber?: string;
  ticketNumber?: string;
  workOrderState?: string;
  noticeTitle?: string;
}

export function buildBilingualSmsBody(
  trigger: SmsTriggerType,
  locale: UiLocale,
  p: SmsTemplateParams
): string {
  const amt = typeof p.amountEtb === 'number' ? `ETB ${p.amountEtb.toLocaleString()}` : 'ETB 0';
  switch (trigger) {
    case 'Rent Due Soon':
      return locale === 'am'
        ? `[AD-PRMS ሙከራ] ውድ ${p.tenantName}፣ ለክፍል ${p.unitCode} የ${amt} ኪራይ (${p.invoiceNumber || ''}) እስከ ${p.dueDate || ''} መከፈል አለበት። በቴሌብር/ArifPay ይክፈሉ።`
        : `[AD-PRMS DEMO] Dear ${p.tenantName}, rent of ${amt} for Unit ${p.unitCode} (${p.invoiceNumber || ''}) is due on ${p.dueDate || ''}. Pay via Telebirr or ArifPay mobile portal.`;
    case 'Overdue Reminder':
      return locale === 'am'
        ? `[AD-PRMS ሙከራ] ማሳሰቢያ ለ${p.tenantName} (${p.unitCode})፡ የ${amt} ውዝፍ ኪራይ (${p.invoiceNumber || ''}) ቀነ-ገደብ አልፏል። እባክዎ በአስቸኳይ ይክፈሉ።`
        : `[AD-PRMS DEMO] Overdue alert for ${p.tenantName} (${p.unitCode}): ${amt} on ${p.invoiceNumber || ''} (due ${p.dueDate || ''}) remains unpaid. Please settle via Telebirr/ArifPay.`;
    case 'Payment Confirmed':
      return locale === 'am'
        ? `[AD-PRMS ሙከራ] ክፍያ ተረጋግጧል! ${amt} ለክፍል ${p.unitCode} ተመዝግቧል። ደረሰኝ ቁጥር፡ ${p.receiptNumber || 'DEMO'}።`
        : `[AD-PRMS DEMO] Payment confirmed! ${amt} received for Unit ${p.unitCode}. Demo receipt: ${p.receiptNumber || 'DEMO'}. Thank you.`;
    case 'Maintenance Update':
      return locale === 'am'
        ? `[AD-PRMS ሙከራ] የጥገና ማሻሻያ (${p.ticketNumber || ''}) ለክፍል ${p.unitCode}፡ ሁኔታው ወደ "${p.workOrderState || 'Updated'}" ተቀይሯል።`
        : `[AD-PRMS DEMO] Maintenance update (${p.ticketNumber || ''}) for Unit ${p.unitCode}: Status is now "${p.workOrderState || 'Updated'}". Check app thread for details.`;
    case 'General Notice':
      return locale === 'am'
        ? `[AD-PRMS ሙከራ] ማስታወቂያ ለ${p.unitCode}፡ ${p.noticeTitle || 'አዲስ የህንጻ ማስታወቂያ'} — ዝርዝሩን በተከራይ መተግበሪያ ይመልከቱ።`
        : `[AD-PRMS DEMO] Notice for Unit ${p.unitCode}: ${p.noticeTitle || 'Building Advisory'} — open your Tenant Mobile App to read full details.`;
  }
}

export async function postSmsDispatchToServer(payload: {
  ownerId: string;
  count: number;
  triggerType: SmsTriggerType;
}): Promise<{ dispatchedOnline: boolean; dispatchId: string }> {
  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine
  ) {
    return { dispatchedOnline: false, dispatchId: `SMS-OFFLINE-${Date.now()}` };
  }

  if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    try {
      const resp = await fetch('/api/sms/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { dispatchId?: string };
        return {
          dispatchedOnline: true,
          dispatchId: data.dispatchId || `SMS-SBX-${Date.now()}`,
        };
      }
    } catch {
      // Offline or sandbox fallback
    }
  }

  return { dispatchedOnline: true, dispatchId: `SMS-SBX-${Date.now()}` };
}
