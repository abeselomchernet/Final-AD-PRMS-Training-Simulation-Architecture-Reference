import { UiLocale } from '../data/i18n';
import { ChargeRecord, PaymentReminderChannel } from '../types/prms';

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getOpenBalanceEtb(charge: Pick<ChargeRecord, 'billedEtb' | 'paidEtb'>): number {
  return Math.max(0, charge.billedEtb - charge.paidEtb);
}

export function isChargeMissedDeadline(
  charge: Pick<ChargeRecord, 'billedEtb' | 'paidEtb' | 'dueDate' | 'status'>,
  referenceDateIso: string = getTodayIsoDate()
): boolean {
  if (getOpenBalanceEtb(charge) <= 0) return false;
  return charge.status === 'Overdue' || charge.dueDate < referenceDateIso;
}

export function getMissedDeadlineCharges<T extends ChargeRecord>(
  charges: T[],
  referenceDateIso: string = getTodayIsoDate()
): T[] {
  return charges
    .filter((ch) => isChargeMissedDeadline(ch, referenceDateIso))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getDaysPastDue(
  dueDateIso: string,
  referenceDateIso: string = getTodayIsoDate()
): number {
  const dueMs = Date.parse(`${dueDateIso}T00:00:00Z`);
  const refMs = Date.parse(`${referenceDateIso}T00:00:00Z`);
  if (!Number.isFinite(dueMs) || !Number.isFinite(refMs) || refMs <= dueMs) return 0;
  return Math.floor((refMs - dueMs) / 86_400_000);
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function maskMsisdnForDisplay(rawMsisdn: string): string {
  const cleaned = rawMsisdn.trim();
  if (cleaned.length >= 9) {
    return `${cleaned.slice(0, 6)}****${cleaned.slice(-3)}`;
  }
  return cleaned || '+25191****000';
}

export interface ManualReminderCopyParams {
  locale: UiLocale;
  tenantName: string;
  unitLabel: string;
  charges: ChargeRecord[];
  channel: PaymentReminderChannel;
  recipientEmail: string;
  note?: string;
}

export interface ManualReminderCopyResult {
  totalOpenEtb: number;
  invoiceList: string;
  emailSubject: string;
  emailPreviewBody: string;
  notificationBody: string;
  noticeTitleEn: string;
  noticeTitleAm: string;
  noticeBodyEn: string;
  noticeBodyAm: string;
}

export function buildManualReminderCopy(params: ManualReminderCopyParams): ManualReminderCopyResult {
  const totalOpenEtb = params.charges.reduce((sum, ch) => sum + getOpenBalanceEtb(ch), 0);
  const invoiceList = params.charges.map((ch) => ch.invoiceNumber).join(', ');
  const earliestDueDate = [...params.charges].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate || '-';
  const formattedTotal = `ETB ${totalOpenEtb.toLocaleString()}`;
  const cleanNote = params.note?.trim();

  const emailSubject = `[AD-PRMS DEMO] Payment Reminder: ${invoiceList} (${formattedTotal} Past Due)`;
  const emailLines = [
    `Dear ${params.tenantName} (${params.unitLabel}),`,
    `As requested, here is your payment reminder for missed deadline invoice(s): ${invoiceList}.`,
    `Earliest Due Date: ${earliestDueDate} · Total Outstanding Balance: ${formattedTotal}.`,
    ...(cleanNote ? [`Tenant Note: ${cleanNote}`] : []),
    'You can settle via Telebirr USSD QR, ArifPay Checkout, or CBE Transfer Slip in the Pay tab.',
    'SANDBOX EMAIL PREVIEW — NO LIVE SMTP DISPATCH.',
  ];
  const emailPreviewBody = emailLines.join('\n');

  const notificationBody =
    params.locale === 'am'
      ? `[AD-PRMS ሙከራ] የክፍያ ማሳሰቢያ (${params.unitLabel})፡ ቀነ-ገደባቸው ያለፈ ደረሰኞች ${invoiceList} · ቀሪ ${formattedTotal} (የመክፈያ ቀን ${earliestDueDate})።${cleanNote ? ` ማስታወሻ፡ ${cleanNote}` : ''}`
      : `[AD-PRMS DEMO] Requested payment reminder (${params.unitLabel}): ${invoiceList} · ${formattedTotal} past due (since ${earliestDueDate}).${cleanNote ? ` Note: ${cleanNote}` : ''}`;

  const noticeTitleEn = `Payment Reminder Sent (${params.channel}) — ${invoiceList}`;
  const noticeTitleAm = `የክፍያ ማሳሰቢያ ተልኳል (${params.channel}) — ${invoiceList}`;

  const channelSuffixEn =
    params.channel === 'Email'
      ? `Email preview prepared for ${params.recipientEmail}.`
      : params.channel === 'Notification'
        ? 'Mobile SMS & App notification dispatched in sandbox mode.'
        : `Sent to ${params.recipientEmail} and dispatched via SMS & App notification in sandbox mode.`;

  const channelSuffixAm =
    params.channel === 'Email'
      ? `የኢሜይል ማሳሰቢያ ለ ${params.recipientEmail} ተዘጋጅቷል።`
      : params.channel === 'Notification'
        ? 'የሞባይል SMS እና የመተግበሪያ ማሳወቂያ በሙከራ ሁኔታ ተልኳል።'
        : `ለ ${params.recipientEmail} በኢሜይል እንዲሁም በSMS እና መተግበሪያ ማሳወቂያ ተልኳል።`;

  const noticeBodyEn = `Requested reminder for missed deadline invoice(s) ${invoiceList} totaling ${formattedTotal} (earliest due ${earliestDueDate}). ${channelSuffixEn}${cleanNote ? ` Note: "${cleanNote}".` : ''}`;
  const noticeBodyAm = `ቀነ-ገደባቸው ላለፈ ደረሰኞች ${invoiceList} (ጠቅላላ ቀሪ ${formattedTotal}፣ መክፈያ ${earliestDueDate}) ማሳሰቢያ ተጠይቋል። ${channelSuffixAm}${cleanNote ? ` ማስታወሻ፡ "${cleanNote}"` : ''}`;

  return {
    totalOpenEtb,
    invoiceList,
    emailSubject,
    emailPreviewBody,
    notificationBody,
    noticeTitleEn,
    noticeTitleAm,
    noticeBodyEn,
    noticeBodyAm,
  };
}
