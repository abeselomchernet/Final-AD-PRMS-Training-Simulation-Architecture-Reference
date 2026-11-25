import { describe, expect, it } from 'vitest';
import {
  buildOromifaContractExportRows,
  buildOromifaContractSections,
  createSampleOromifaContractData,
  recalculateOromifaFinancials,
} from '../../src/data/oromifaContractTemplate';

describe('oromifaContractTemplate', () => {
  it('preserves exact Afaan Oromoo (Oromifa) legal clauses and Keewwata structure verbatim', () => {
    const sample = createSampleOromifaContractData();
    const doc = buildOromifaContractSections(sample);

    expect(doc.title).toBe('WALIIGALTEE (AHADII) KIRAA MANA DALDALAA');
    expect(doc.legalPreamble).toContain('1678, 1719, 1731, 2896, 2945 fi 2005');
    expect(doc.articles.map((a) => a.heading)).toEqual([
      'KEEWWATA-1',
      'KEEWWATA-2',
      'KEEWWATA-3',
      'KEEWWATA-4',
      'KEEWWATA-5',
      'KEEWWATA-6',
      'KEEWWATA-7',
      'KEEWWATA-8',
    ]);
    expect(doc.articles[3].paragraphs[0]).toContain('21,250.00');
    expect(doc.articles[3].paragraphs[0]).toContain('3,750.00');
    expect(doc.articles[3].paragraphs[0]).toContain('25,000.00');
    expect(doc.articles[3].paragraphs[1]).toContain('75,000.00');
    expect(doc.articles[6].paragraphs[4]).toContain('SHH.Lakk 1889 fi 1892');
  });

  it('recalculates VAT and multi-month advance rent cleanly for reusable contracts', () => {
    const updated = recalculateOromifaFinancials({
      ...createSampleOromifaContractData(),
      baseMonthlyRentEtb: 30000,
      vatRatePercent: 15,
      advanceMonths: 6,
    });

    expect(updated.vatAmountEtb).toBe(4500);
    expect(updated.grossMonthlyRentEtb).toBe(34500);
    expect(updated.advanceBaseTotalEtb).toBe(180000);
    expect(updated.advanceVatTotalEtb).toBe(27000);
    expect(updated.advanceGrandTotalEtb).toBe(207000);

    const exported = buildOromifaContractExportRows(updated);
    expect(exported.columns).toHaveLength(2);
    expect(exported.rows.some((r) => r[1].includes('207,000.00'))).toBe(true);
  });
});
