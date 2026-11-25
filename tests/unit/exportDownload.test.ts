import { describe, expect, it } from 'vitest';
import {
  buildCsvContent,
  buildPdfUint8Array,
  buildXlsxUint8Array,
  sanitizeExportFilename,
} from '../../src/utils/exportDownload';

describe('exportDownload utilities (PDF, Excel .xlsx, CSV)', () => {
  const sampleDoc = {
    title: 'Collections Summary',
    ownerName: 'Test Owner Alpha',
    columns: ['Receipt #', 'Date', 'Method', 'Amount', 'Status'],
    rows: [
      ['DEMO-RCT-001', '2026-11-10', 'Telebirr (Synthetic)', 'ETB 25,000', 'Issued'],
      ['DEMO-RCT-002', '2026-11-11', 'ArifPay (Synthetic)', 'ETB 32,000', 'Issued'],
    ],
    generatedAt: '2026-11-15 12:00:00',
  };

  it('builds UTF-8 BOM CSV with metadata header and proper RFC4180 quoting', () => {
    const csv = buildCsvContent({
      ...sampleDoc,
      rows: [['DEMO,001', '2026-11-10', 'ቴሌብር', 'ETB 25,000', 'Issued']],
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('SYNTHETIC DEMO DATA');
    expect(csv).toContain('"DEMO,001"');
    expect(csv).toContain('ቴሌብር');

    const rawOnly = buildCsvContent({ ...sampleDoc, includeMetadataHeader: false });
    expect(rawOnly).not.toContain('SYNTHETIC DEMO DATA');
  });

  it('builds a valid OOXML Excel (.xlsx) ZIP archive containing sheet XML', () => {
    const xlsxBytes = buildXlsxUint8Array(sampleDoc);
    // PK\x03\x04 ZIP magic header
    expect(xlsxBytes[0]).toBe(0x50);
    expect(xlsxBytes[1]).toBe(0x4b);
    expect(xlsxBytes[2]).toBe(0x03);
    expect(xlsxBytes[3]).toBe(0x04);

    const asciiText = new TextDecoder().decode(xlsxBytes);
    expect(asciiText).toContain('[Content_Types].xml');
    expect(asciiText).toContain('xl/worksheets/sheet1.xml');
    expect(asciiText).toContain('DEMO-RCT-001');
    expect(asciiText).toContain('Telebirr (Synthetic)');
  });

  it('builds a valid multi-page PDF 1.4 binary supporting portrait and landscape layouts', () => {
    const manyRows = Array.from({ length: 48 }, (_, idx) => [
      `DEMO-RCT-${idx + 1}`,
      '2026-11-15',
      'Telebirr',
      'ETB 10,000',
      'Issued',
    ]);
    const portraitPdf = buildPdfUint8Array({
      ...sampleDoc,
      rows: manyRows,
      pdfOrientation: 'portrait',
    });
    const landscapePdf = buildPdfUint8Array({
      ...sampleDoc,
      rows: manyRows,
      pdfOrientation: 'landscape',
    });

    const pText = new TextDecoder().decode(portraitPdf);
    const lText = new TextDecoder().decode(landscapePdf);
    expect(pText.startsWith('%PDF-1.4')).toBe(true);
    expect(pText.trim().endsWith('%%EOF')).toBe(true);
    expect(pText).toContain('/MediaBox [0 0 612 792]');
    expect(pText).toContain('Page 2 of 2');

    expect(lText).toContain('/MediaBox [0 0 792 612]');
  });

  it('sanitizes filenames cleanly per extension', () => {
    const fn = sanitizeExportFilename('Owner Income Statement (Synthetic)', 'Test Owner Alpha', 'xlsx');
    expect(fn).toMatch(/^owner-income-statement-synthetic-test-owner-alpha-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
