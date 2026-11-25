import { DateDisplayMode } from '../types/prms';
import { UiLocale } from '../data/i18n';

export const BUSINESS_TIMEZONE = 'Africa/Addis_Ababa';

function parseIsoSafe(value: string): { dateObj: Date | null; timePart: string } {
  if (!value || value.startsWith('Undetermined') || value.startsWith('Pending')) {
    return { dateObj: null, timePart: '' };
  }
  const clean = value.trim();
  const dateOnlyMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    // Construct at midday UTC so Addis Ababa (UTC+3) stays strictly on the same calendar date
    return {
      dateObj: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 9, 0, 0)),
      timePart: '',
    };
  }
  const dtMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);
  if (dtMatch) {
    const [, y, m, d, hhmm, ss] = dtMatch;
    // Treat local business timestamps as Africa/Addis_Ababa (UTC+3)
    const utcHour = Number(hhmm.slice(0, 2)) - 3;
    const utcMin = Number(hhmm.slice(3, 5));
    const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), utcHour, utcMin, Number(ss || 0)));
    return { dateObj, timePart: `${hhmm}${ss ? `:${ss}` : ''}` };
  }
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) {
    return { dateObj: null, timePart: '' };
  }
  return { dateObj: parsed, timePart: '' };
}

function formatGregorian(dateObj: Date, locale: UiLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: BUSINESS_TIMEZONE,
    }).format(dateObj);
  } catch {
    return dateObj.toISOString().slice(0, 10);
  }
}

function formatEthiopic(dateObj: Date, locale: UiLocale): string {
  const candidates =
    locale === 'am'
      ? ['am-ET-u-ca-ethiopic', 'en-US-u-ca-ethiopic']
      : ['en-GB-u-ca-ethiopic', 'am-ET-u-ca-ethiopic'];

  for (const tag of candidates) {
    try {
      const formatted = new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: BUSINESS_TIMEZONE,
      }).format(dateObj);
      if (formatted) return formatted;
    } catch {
      // Fallback to next locale candidate
    }
  }
  return dateObj.toISOString().slice(0, 10);
}

export function formatDateByMode(
  rawDate: string,
  locale: UiLocale,
  mode: DateDisplayMode
): string {
  if (!rawDate) return '—';
  const { dateObj } = parseIsoSafe(rawDate);
  if (!dateObj) return rawDate;

  if (mode === 'gregorian') {
    return formatGregorian(dateObj, locale);
  }
  if (mode === 'ethiopic') {
    return `${formatEthiopic(dateObj, locale)} (${locale === 'am' ? 'ዓ.ም' : 'E.C.'})`;
  }
  return `${formatEthiopic(dateObj, locale)} (${locale === 'am' ? 'ዓ.ም' : 'E.C.'}) / ${formatGregorian(dateObj, locale)}`;
}

export function formatDateTimeByMode(
  rawDateTime: string,
  locale: UiLocale,
  mode: DateDisplayMode
): string {
  if (!rawDateTime) return '—';
  const { dateObj, timePart } = parseIsoSafe(rawDateTime);
  if (!dateObj) return rawDateTime;

  const dateLabel = formatDateByMode(rawDateTime, locale, mode);
  if (timePart) {
    return `${dateLabel} · ${timePart} (Africa/Addis_Ababa)`;
  }
  try {
    const hm = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: BUSINESS_TIMEZONE,
    }).format(dateObj);
    return `${dateLabel} · ${hm} (Africa/Addis_Ababa)`;
  } catch {
    return `${dateLabel} (Africa/Addis_Ababa)`;
  }
}

export function formatEtbLocale(amount: number, locale: UiLocale): string {
  const num = amount.toLocaleString(locale === 'am' ? 'en-US' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return locale === 'am' ? `ብር ${num} (ETB)` : `ETB ${num}`;
}

export function formatShortEtbLocale(amount: number, locale: UiLocale): string {
  if (Math.abs(amount) >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(2);
    return locale === 'am' ? `ብር ${val}M` : `ETB ${val}M`;
  }
  const num = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return locale === 'am' ? `ብር ${num}` : `ETB ${num}`;
}
