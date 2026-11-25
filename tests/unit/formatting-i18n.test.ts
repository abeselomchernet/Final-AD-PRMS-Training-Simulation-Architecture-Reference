import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TIMEZONE,
  formatDateByMode,
  formatDateTimeByMode,
  formatEtbLocale,
  formatShortEtbLocale,
} from '../../src/utils/formatting';
import { localizeStatus, UI_LABELS } from '../../src/data/i18n';

describe('Ethiopian / Gregorian Date & Bilingual ETB Formatting', () => {
  it('uses Africa/Addis_Ababa as the authoritative business timezone', () => {
    expect(BUSINESS_TIMEZONE).toBe('Africa/Addis_Ababa');
  });

  it('formats Gregorian date strings without off-by-one timezone shifts', () => {
    const formatted = formatDateByMode('2026-09-11', 'en', 'gregorian');
    expect(formatted).toContain('11');
    expect(formatted).toContain('September');
    expect(formatted).toContain('2026');
  });

  it('renders Ethiopian (E.C. / ዓ.ም) and Dual calendar modes clearly', () => {
    const ecEn = formatDateByMode('2026-09-11', 'en', 'ethiopic');
    expect(ecEn).toContain('E.C.');

    const ecAm = formatDateByMode('2026-09-11', 'am', 'ethiopic');
    expect(ecAm).toContain('ዓ.ም');

    const dual = formatDateByMode('2026-09-11', 'en', 'dual');
    expect(dual).toContain('E.C.');
    expect(dual).toContain('September 2026');
  });

  it('preserves pending/undetermined placeholders verbatim', () => {
    expect(formatDateByMode('Pending Adviser', 'en', 'dual')).toBe('Pending Adviser');
    expect(formatDateByMode('', 'en', 'gregorian')).toBe('—');
  });

  it('formats Africa/Addis_Ababa datetime strings across modes', () => {
    const dt = formatDateTimeByMode('2026-11-12 09:42:00', 'en', 'gregorian');
    expect(dt).toContain('09:42:00');
    expect(dt).toContain('Africa/Addis_Ababa');
  });

  it('formats ETB monetary amounts in English and Amharic', () => {
    expect(formatEtbLocale(35000, 'en')).toBe('ETB 35,000.00');
    expect(formatEtbLocale(35000, 'am')).toBe('ብር 35,000.00 (ETB)');
    expect(formatShortEtbLocale(1_250_000, 'en')).toBe('ETB 1.25M');
    expect(formatShortEtbLocale(45_000, 'am')).toBe('ብር 45,000');
  });

  it('maintains 100% key parity between English and Amharic UI_LABELS', () => {
    const enKeys = Object.keys(UI_LABELS.en).sort();
    const amKeys = Object.keys(UI_LABELS.am).sort();
    expect(amKeys).toEqual(enKeys);
  });

  it('localizes compliance and workflow statuses into Amharic', () => {
    expect(localizeStatus('Pending', 'en')).toBe('Pending');
    expect(localizeStatus('Pending', 'am')).not.toBe('Pending');
    expect(localizeStatus('Draft', 'am')).not.toBe('Draft');
  });
});
