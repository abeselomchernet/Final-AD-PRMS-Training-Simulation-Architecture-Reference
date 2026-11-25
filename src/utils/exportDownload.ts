import { sanitizeHtml } from './sanitize';

export type ExportFileFormat = 'PDF' | 'Excel' | 'CSV';
export type PdfOrientation = 'portrait' | 'landscape';

export interface ExportDocumentInput {
  title: string;
  ownerName: string;
  columns: string[];
  rows: string[][];
  generatedAt?: string;
  includeMetadataHeader?: boolean;
  pdfOrientation?: PdfOrientation;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function createStoreZip(entries: { name: string; content: string | Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const dataBytes =
      typeof entry.content === 'string' ? encodeUtf8(entry.content) : entry.content;
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(localHeader.buffer);
    writeU32(lView, 0, 0x04034b50); // local file header signature
    writeU16(lView, 4, 20); // version needed
    writeU16(lView, 6, 0x0800); // UTF-8 filename flag
    writeU16(lView, 8, 0); // compression: store (0)
    writeU16(lView, 10, 0); // mod time
    writeU16(lView, 12, 0); // mod date
    writeU32(lView, 14, crc);
    writeU32(lView, 18, dataBytes.length);
    writeU32(lView, 22, dataBytes.length);
    writeU16(lView, 26, nameBytes.length);
    writeU16(lView, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralHeader.buffer);
    writeU32(cView, 0, 0x02014b50); // central file header signature
    writeU16(cView, 4, 20);
    writeU16(cView, 6, 20);
    writeU16(cView, 8, 0x0800);
    writeU16(cView, 10, 0);
    writeU16(cView, 12, 0);
    writeU16(cView, 14, 0);
    writeU32(cView, 16, crc);
    writeU32(cView, 20, dataBytes.length);
    writeU32(cView, 24, dataBytes.length);
    writeU16(cView, 28, nameBytes.length);
    writeU16(cView, 30, 0);
    writeU16(cView, 32, 0);
    writeU16(cView, 34, 0);
    writeU16(cView, 36, 0);
    writeU32(cView, 38, 0);
    writeU32(cView, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  writeU32(eView, 0, 0x06054b50);
  writeU16(eView, 4, 0);
  writeU16(eView, 6, 0);
  writeU16(eView, 8, entries.length);
  writeU16(eView, 10, entries.length);
  writeU32(eView, 12, centralSize);
  writeU32(eView, 16, offset);
  writeU16(eView, 20, 0);

  const totalSize = offset + centralSize + eocd.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  output.set(eocd, cursor);
  return output;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetters(colIndexZeroBased: number): string {
  let n = colIndexZeroBased + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function sanitizeRawFilename(rawName: string): string {
  const withoutControls = Array.from(String(rawName ?? ''))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  const cleaned = withoutControls
    .replace(/\.\.+/g, '.')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'ad-prms-export';
}

export function sanitizeExportFilename(title: string, ownerName: string, ext: 'pdf' | 'xlsx' | 'csv'): string {
  const slug = `${title}-${ownerName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const dateStamp = new Date().toISOString().slice(0, 10);
  return sanitizeRawFilename(`${slug || 'ad-prms-export'}-${dateStamp}.${ext}`);
}

export function buildCsvContent(doc: ExportDocumentInput): string {
  const escapeCsvCell = (raw: string) => {
    const str = String(raw ?? '');
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  const generatedAt = doc.generatedAt || new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (doc.includeMetadataHeader !== false) {
    lines.push([escapeCsvCell('AD-PRMS Synthetic Export'), escapeCsvCell(doc.title)].join(','));
    lines.push([escapeCsvCell('Owner Scope'), escapeCsvCell(doc.ownerName)].join(','));
    lines.push([escapeCsvCell('Generated At (UTC)'), escapeCsvCell(generatedAt)].join(','));
    lines.push(
      [
        escapeCsvCell('Disclaimer'),
        escapeCsvCell('SYNTHETIC DEMO DATA — NOT FOR PRODUCTION OR STATUTORY FILING USE'),
      ].join(',')
    );
    lines.push('');
  }

  lines.push(doc.columns.map(escapeCsvCell).join(','));
  for (const row of doc.rows) {
    lines.push(doc.columns.map((_, i) => escapeCsvCell(row[i] ?? '')).join(','));
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function buildXlsxUint8Array(doc: ExportDocumentInput): Uint8Array {
  const generatedAt = doc.generatedAt || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const sheetRows: { cells: string[]; styleIndex: number }[] = [];

  if (doc.includeMetadataHeader !== false) {
    sheetRows.push({
      cells: [`AD-PRMS Export: ${doc.title}`, `Owner: ${doc.ownerName}`],
      styleIndex: 1,
    });
    sheetRows.push({
      cells: [
        'SYNTHETIC DEMO DATA — NOT FOR PRODUCTION OR STATUTORY FILING USE',
        `Generated: ${generatedAt}`,
      ],
      styleIndex: 2,
    });
    sheetRows.push({ cells: [], styleIndex: 0 });
  }

  sheetRows.push({ cells: doc.columns, styleIndex: 1 });
  for (const row of doc.rows) {
    sheetRows.push({
      cells: doc.columns.map((_, idx) => String(row[idx] ?? '')),
      styleIndex: 0,
    });
  }

  const colCount = Math.max(doc.columns.length, 2);
  const colsXml = Array.from({ length: colCount }, (_, idx) => {
    const headerLen = (doc.columns[idx] || '').length;
    const maxDataLen = doc.rows.reduce(
      (max, r) => Math.max(max, String(r[idx] ?? '').length),
      headerLen
    );
    const width = Math.min(Math.max(maxDataLen + 4, 14), 46);
    return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  const rowsXml = sheetRows
    .map((r, rIdx) => {
      const rowNum = rIdx + 1;
      if (r.cells.length === 0) {
        return `<row r="${rowNum}"/>`;
      }
      const cellsXml = r.cells
        .map((val, cIdx) => {
          const ref = `${columnLetters(cIdx)}${rowNum}`;
          const styleAttr = r.styleIndex > 0 ? ` s="${r.styleIndex}"` : '';
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(
            String(val ?? '')
          )}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join('');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="AD-PRMS Export" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FF78350F"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0D1D30"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;

  return createStoreZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
  ]);
}

function toPdfWinAnsiText(raw: string): string {
  // Replace common Unicode punctuation with clean ASCII equivalents and strip unsupported glyphs
  const normalized = String(raw ?? '')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2192/g, '->')
    .replace(/\u00b7/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function clipText(raw: string, maxChars: number): string {
  const str = String(raw ?? '').trim();
  if (str.length <= maxChars) return str;
  if (maxChars <= 3) return str.slice(0, maxChars);
  return `${str.slice(0, maxChars - 2)}..`;
}

export function buildPdfUint8Array(doc: ExportDocumentInput): Uint8Array {
  const isLandscape = doc.pdfOrientation === 'landscape';
  const pageWidth = isLandscape ? 792 : 612;
  const pageHeight = isLandscape ? 612 : 792;
  const marginX = 36;
  const usableWidth = pageWidth - marginX * 2;
  const generatedAt = doc.generatedAt || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const colCount = Math.max(doc.columns.length, 1);
  const colWidth = usableWidth / colCount;
  const maxCharsPerCell = Math.max(8, Math.floor((colWidth - 8) / 5.1));

  const headerBottomY = pageHeight - 102;
  const footerTopY = 38;
  const rowHeight = 18;
  const rowsPerPage = Math.max(
    1,
    Math.floor((headerBottomY - 26 - footerTopY) / rowHeight)
  );

  const chunks: string[][][] = [];
  if (doc.rows.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < doc.rows.length; i += rowsPerPage) {
      chunks.push(doc.rows.slice(i, i + rowsPerPage));
    }
  }

  const totalPages = chunks.length;
  const pageStreams: string[] = chunks.map((pageRows, pageIndex) => {
    const ops: string[] = [];

    // Header Navy Bar
    ops.push('0.051 0.114 0.188 rg');
    ops.push(`${marginX} ${pageHeight - 64} ${usableWidth} 32 re f`);

    // Title in white
    ops.push('1 1 1 rg');
    ops.push('BT /F2 11 Tf');
    ops.push(`1 0 0 1 ${marginX + 10} ${pageHeight - 45} Tm`);
    ops.push(`(${toPdfWinAnsiText(clipText(`AD-PRMS: ${doc.title}`, 92))}) Tj ET`);

    // Metadata subtitle
    ops.push('0.20 0.25 0.33 rg');
    ops.push('BT /F1 8.5 Tf');
    ops.push(`1 0 0 1 ${marginX} ${pageHeight - 78} Tm`);
    ops.push(
      `(${toPdfWinAnsiText(
        `Owner: ${doc.ownerName} | Rows: ${doc.rows.length} | Generated: ${generatedAt}`
      )}) Tj ET`
    );

    if (doc.includeMetadataHeader !== false) {
      ops.push('0.71 0.15 0.15 rg');
      ops.push('BT /F2 8 Tf');
      ops.push(`1 0 0 1 ${marginX} ${pageHeight - 91} Tm`);
      ops.push(
        `(${toPdfWinAnsiText(
          'SYNTHETIC DEMO DATA - NOT FOR PRODUCTION OR STATUTORY FILING USE'
        )}) Tj ET`
      );
    }

    // Table header band
    const tableHeaderY = headerBottomY;
    ops.push('0.94 0.96 0.98 rg');
    ops.push(`${marginX} ${tableHeaderY - 16} ${usableWidth} 18 re f`);
    ops.push('0.82 0.85 0.90 RG 0.6 w');
    ops.push(`${marginX} ${tableHeaderY - 16} ${usableWidth} 18 re S`);

    ops.push('0.06 0.14 0.23 rg');
    doc.columns.forEach((col, cIdx) => {
      const cellX = marginX + cIdx * colWidth + 4;
      ops.push('BT /F2 8 Tf');
      ops.push(`1 0 0 1 ${cellX.toFixed(1)} ${(tableHeaderY - 10).toFixed(1)} Tm`);
      ops.push(`(${toPdfWinAnsiText(clipText(col, maxCharsPerCell))}) Tj ET`);
    });

    // Data rows
    pageRows.forEach((row, rIdx) => {
      const rowBottomY = tableHeaderY - 16 - (rIdx + 1) * rowHeight;
      if (rIdx % 2 === 1) {
        ops.push('0.975 0.98 0.99 rg');
        ops.push(`${marginX} ${rowBottomY} ${usableWidth} ${rowHeight} re f`);
      }
      ops.push('0.88 0.90 0.94 RG 0.4 w');
      ops.push(
        `${marginX} ${rowBottomY} m ${marginX + usableWidth} ${rowBottomY} l S`
      );
      ops.push('0.12 0.16 0.24 rg');
      doc.columns.forEach((_, cIdx) => {
        const cellX = marginX + cIdx * colWidth + 4;
        const val = clipText(row[cIdx] ?? '', maxCharsPerCell);
        ops.push('BT /F1 8 Tf');
        ops.push(`1 0 0 1 ${cellX.toFixed(1)} ${(rowBottomY + 5.5).toFixed(1)} Tm`);
        ops.push(`(${toPdfWinAnsiText(val)}) Tj ET`);
      });
    });

    if (pageRows.length === 0) {
      ops.push('0.40 0.45 0.55 rg');
      ops.push('BT /F1 9 Tf');
      ops.push(`1 0 0 1 ${marginX + 6} ${tableHeaderY - 34} Tm`);
      ops.push('(No rows available in current filter scope.) Tj ET');
    }

    // Footer
    ops.push('0.40 0.45 0.55 rg');
    ops.push('BT /F1 8 Tf');
    ops.push(`1 0 0 1 ${marginX} 22 Tm`);
    ops.push(`(Page ${pageIndex + 1} of ${totalPages} | AD-PRMS Prototype Simulation) Tj ET`);

    return ops.join('\n');
  });

  // Assemble PDF 1.4 objects
  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Font F1 (Helvetica), 4: Font F2 (Helvetica-Bold)
  const pageObjIds: number[] = [];
  let nextObjId = 5;
  for (let i = 0; i < pageStreams.length; i += 1) {
    pageObjIds.push(nextObjId);
    nextObjId += 2; // page + content stream
  }

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${
      pageObjIds.length
    } >>\nendobj`
  );
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj'
  );
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj'
  );

  pageStreams.forEach((stream, idx) => {
    const pageId = pageObjIds[idx];
    const contentId = pageId + 1;
    const streamBytesLen = encodeUtf8(stream).length;
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${streamBytesLen} >>\nstream\n${stream}\nendstream\nendobj`
    );
  });

  const header = '%PDF-1.4\n';
  let body = header;
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(encodeUtf8(body).length);
    body += `${obj}\n`;
  }

  const xrefOffset = encodeUtf8(body).length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encodeUtf8(body + xref + trailer);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  if (typeof URL.createObjectURL !== 'function') return;

  const safeFilename = sanitizeRawFilename(filename);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup failures
    }
  }, 1500);
}

export function downloadExportFile(
  format: ExportFileFormat,
  doc: ExportDocumentInput
): { filename: string; byteLength: number } {
  if (format === 'CSV') {
    const csv = buildCsvContent(doc);
    const bytes = encodeUtf8(csv);
    const filename = sanitizeExportFilename(doc.title, doc.ownerName, 'csv');
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    triggerBlobDownload(new Blob([buffer], { type: 'text/csv;charset=utf-8' }), filename);
    return { filename, byteLength: bytes.length };
  }

  if (format === 'Excel') {
    const xlsxBytes = buildXlsxUint8Array(doc);
    const filename = sanitizeExportFilename(doc.title, doc.ownerName, 'xlsx');
    const buffer = xlsxBytes.buffer.slice(
      xlsxBytes.byteOffset,
      xlsxBytes.byteOffset + xlsxBytes.byteLength
    ) as ArrayBuffer;
    triggerBlobDownload(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename
    );
    return { filename, byteLength: xlsxBytes.length };
  }

  const pdfBytes = buildPdfUint8Array(doc);
  const filename = sanitizeExportFilename(doc.title, doc.ownerName, 'pdf');
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  triggerBlobDownload(new Blob([buffer], { type: 'application/pdf' }), filename);
  return { filename, byteLength: pdfBytes.length };
}

export function printExportDocument(doc: ExportDocumentInput): void {
  if (typeof document === 'undefined') return;
  const generatedAt = doc.generatedAt || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const isLandscape = doc.pdfOrientation === 'landscape';

  const bodyMarkup = sanitizeHtml(`
  <div class="banner">
    <h1>AD-PRMS — ${escapeXml(doc.title)}</h1>
    <div class="meta">Owner: ${escapeXml(doc.ownerName)} · Rows: ${doc.rows.length} · Generated: ${escapeXml(generatedAt)}</div>
  </div>
  ${
    doc.includeMetadataHeader !== false
      ? '<div class="disclaimer">SYNTHETIC DEMO DATA — NOT FOR PRODUCTION OR STATUTORY FILING USE</div>'
      : ''
  }
  <table>
    <thead><tr>${doc.columns.map((c) => `<th>${escapeXml(c)}</th>`).join('')}</tr></thead>
    <tbody>${doc.rows
      .map(
        (r) =>
          `<tr>${doc.columns.map((_, idx) => `<td>${escapeXml(String(r[idx] ?? ''))}</td>`).join('')}</tr>`
      )
      .join('')}</tbody>
  </table>`);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(doc.title)}</title>
<style>
  @page { size: ${isLandscape ? 'landscape' : 'portrait'}; margin: 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Ethiopic", sans-serif; color: #0f172a; margin: 0; font-size: 11px; }
  .banner { background: #0d1d30; color: #ffffff; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; }
  .banner h1 { margin: 0; font-size: 14px; }
  .meta { font-size: 10px; color: #cbd5e1; margin-top: 3px; }
  .disclaimer { border: 1px solid #d97706; background: #fffbeb; color: #78350f; padding: 6px 10px; font-weight: 700; font-size: 10px; border-radius: 4px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 10px; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>${bodyMarkup}</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const docTarget = iframe.contentWindow?.document;
  if (docTarget) {
    docTarget.open();
    docTarget.write(html);
    docTarget.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Ignore print errors in headless environments
      }
      setTimeout(() => {
        iframe.remove();
      }, 1500);
    }, 150);
  } else {
    iframe.remove();
  }
}
