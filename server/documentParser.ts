import path from 'node:path';
import JSZip from 'jszip';

export type ParsedDocumentResult =
  | {
      kind: 'multimodal';
      mimeType: string;
      base64Data: string;
      formatLabel: string;
    }
  | {
      kind: 'text';
      text: string;
      formatLabel: string;
      truncated: boolean;
      metadataSummary?: string;
    };

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_UNCOMPRESSED_ZIP_BYTES = 25 * 1024 * 1024; // 25 MB decompression cap
const MAX_EXTRACTED_CHARS = 120_000;
const MAX_SPREADSHEET_ROWS_PER_SHEET = 600;

export const SUPPORTED_EXTENSIONS = new Set([
  // PDF
  '.pdf',
  // Spreadsheets
  '.xlsx',
  '.xlsm',
  '.xls',
  '.ods',
  '.csv',
  '.tsv',
  // Images / Receipts / Screenshots
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.bmp',
  // Bank & Accounting Exports
  '.ofx',
  '.qfx',
  '.qif',
  '.mt940',
  '.sta',
  // Word & Text Documents
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
  '.md',
  '.json',
  '.xml',
  '.html',
  '.htm',
]);

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
};

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) {
    return { text, truncated: false };
  }
  return {
    text:
      text.slice(0, MAX_EXTRACTED_CHARS) +
      '\n\n[Note: Remaining rows/text were truncated due to document length.]',
    truncated: true,
  };
}

async function readZipEntrySafely(
  zip: JSZip,
  entryPath: string,
  budget: { remainingBytes: number }
): Promise<string | null> {
  const file = zip.file(entryPath);
  if (!file) return null;
  const buf = await file.async('nodebuffer');
  budget.remainingBytes -= buf.byteLength;
  if (budget.remainingBytes < 0) {
    throw new Error('Archive exceeds maximum safe uncompressed size.');
  }
  return buf.toString('utf8');
}

function columnLettersToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
}

function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  // Excel epoch starts 1899-12-30 (accounting for 1900 leap year bug)
  const utcMs = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseXlsxDateStyleIndices(stylesXml: string | null): Set<number> {
  const dateStyleIndices = new Set<number>();
  if (!stylesXml) return dateStyleIndices;

  // Built-in Excel date numFmtIds
  const dateNumFmtIds = new Set<number>([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

  // Custom numFmts
  const numFmtRegex = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"[^>]*\/?>/gi;
  let nfMatch: RegExpExecArray | null;
  while ((nfMatch = numFmtRegex.exec(stylesXml)) !== null) {
    const id = Number.parseInt(nfMatch[1], 10);
    const code = nfMatch[2].toLowerCase();
    if (
      /[ymd]/.test(code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')) &&
      !code.includes('#') &&
      !code.includes('0.00')
    ) {
      dateNumFmtIds.add(id);
    }
  }

  const cellXfsMatch = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/i);
  if (!cellXfsMatch) return dateStyleIndices;

  const xfRegex = /<xf\b([^>]*)(?:\/>|>[\s\S]*?<\/xf>)/gi;
  let xfMatch: RegExpExecArray | null;
  let styleIdx = 0;
  while ((xfMatch = xfRegex.exec(cellXfsMatch[1])) !== null) {
    const attrs = xfMatch[1];
    const numFmtMatch = attrs.match(/numFmtId="(\d+)"/i);
    if (numFmtMatch) {
      const id = Number.parseInt(numFmtMatch[1], 10);
      if (dateNumFmtIds.has(id)) {
        dateStyleIndices.add(styleIdx);
      }
    }
    styleIdx++;
  }

  return dateStyleIndices;
}

async function parseXlsxBuffer(buffer: Buffer): Promise<{ text: string; sheetCount: number }> {
  const zip = await JSZip.loadAsync(buffer);
  const budget = { remainingBytes: MAX_UNCOMPRESSED_ZIP_BYTES };

  // 1. Parse shared strings
  const sharedStrings: string[] = [];
  const sstXml = await readZipEntrySafely(zip, 'xl/sharedStrings.xml', budget);
  if (sstXml) {
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(sstXml)) !== null) {
      const tMatches = siMatch[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi);
      let combined = '';
      for (const m of tMatches) {
        combined += decodeXmlEntities(m[1]);
      }
      sharedStrings.push(combined.replace(/\s+/g, ' ').trim());
    }
  }

  // 2. Parse styles for date formatting detection
  const stylesXml = await readZipEntrySafely(zip, 'xl/styles.xml', budget);
  const dateStyleIndices = parseXlsxDateStyleIndices(stylesXml);

  // 3. Resolve sheet names and paths
  const sheetTargets: { name: string; path: string }[] = [];
  const workbookXml = await readZipEntrySafely(zip, 'xl/workbook.xml', budget);
  const relsXml = await readZipEntrySafely(zip, 'xl/_rels/workbook.xml.rels', budget);

  const relMap = new Map<string, string>();
  if (relsXml) {
    const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/gi;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = relRegex.exec(relsXml)) !== null) {
      const rawTarget = rMatch[2].replace(/^\/+/, '');
      const normalized = rawTarget.startsWith('xl/') ? rawTarget : `xl/${rawTarget}`;
      relMap.set(rMatch[1], normalized);
    }
  }

  if (workbookXml) {
    const sheetRegex = /<sheet\b([^>]*)\/?>/gi;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sheetRegex.exec(workbookXml)) !== null) {
      const attrs = sMatch[1];
      const nameMatch = attrs.match(/name="([^"]+)"/i);
      const rIdMatch = attrs.match(/r:id="([^"]+)"/i);
      const target = rIdMatch ? relMap.get(rIdMatch[1]) : undefined;
      if (target) {
        sheetTargets.push({
          name: decodeXmlEntities(nameMatch ? nameMatch[1] : `Sheet ${sheetTargets.length + 1}`),
          path: target,
        });
      }
    }
  }

  // Fallback: discover worksheets directly in zip
  if (sheetTargets.length === 0) {
    const discovered = Object.keys(zip.files)
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
      .sort();
    discovered.forEach((p, idx) => sheetTargets.push({ name: `Sheet ${idx + 1}`, path: p }));
  }

  if (sheetTargets.length === 0) {
    throw new Error('No worksheets found inside this spreadsheet file.');
  }

  const sheetSections: string[] = [];

  for (const sheet of sheetTargets) {
    const xml = await readZipEntrySafely(zip, sheet.path, budget);
    if (!xml) continue;

    const rows: string[] = [];
    const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
    let rowMatch: RegExpExecArray | null;

    while (
      (rowMatch = rowRegex.exec(xml)) !== null &&
      rows.length < MAX_SPREADSHEET_ROWS_PER_SHEET
    ) {
      const cells: string[] = [];
      const cellRegex = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/gi;
      let cellMatch: RegExpExecArray | null;
      let fallbackCol = 0;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const attrs = cellMatch[1];
        const body = cellMatch[2] ?? '';

        const refMatch = attrs.match(/\br="([A-Z]+)\d+"/i);
        const colIndex = refMatch ? columnLettersToIndex(refMatch[1].toUpperCase()) : fallbackCol;
        fallbackCol = colIndex + 1;

        const typeMatch = attrs.match(/\bt="([^"]+)"/i);
        const cellType = typeMatch ? typeMatch[1] : '';
        const styleMatch = attrs.match(/\bs="(\d+)"/i);
        const styleIdx = styleMatch ? Number.parseInt(styleMatch[1], 10) : -1;

        let value = '';
        if (cellType === 'inlineStr') {
          const tMatches = body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi);
          for (const tm of tMatches) value += decodeXmlEntities(tm[1]);
        } else {
          const vMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
          const rawVal = vMatch ? decodeXmlEntities(vMatch[1]).trim() : '';
          if (cellType === 's') {
            const idx = Number.parseInt(rawVal, 10);
            value = Number.isFinite(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
          } else if (cellType === 'b') {
            value = rawVal === '1' ? 'TRUE' : 'FALSE';
          } else if (cellType === 'str' || cellType === 'e') {
            value = rawVal;
          } else if (rawVal !== '' && dateStyleIndices.has(styleIdx)) {
            const serial = Number.parseFloat(rawVal);
            value = excelSerialToIsoDate(serial) ?? rawVal;
          } else {
            value = rawVal;
          }
        }

        if (colIndex < 40) {
          while (cells.length < colIndex) cells.push('');
          cells[colIndex] = value.replace(/\s+/g, ' ').trim();
        }
      }

      if (cells.some((c) => c !== '')) {
        rows.push(cells.join(' | '));
      }
    }

    if (rows.length > 0) {
      sheetSections.push(`=== Worksheet: ${sheet.name} (${rows.length} rows) ===\n${rows.join('\n')}`);
    }
  }

  return {
    text: sheetSections.join('\n\n'),
    sheetCount: sheetSections.length,
  };
}

async function parseOdsBuffer(buffer: Buffer): Promise<{ text: string; sheetCount: number }> {
  const zip = await JSZip.loadAsync(buffer);
  const budget = { remainingBytes: MAX_UNCOMPRESSED_ZIP_BYTES };
  const contentXml = await readZipEntrySafely(zip, 'content.xml', budget);
  if (!contentXml) {
    throw new Error('Could not read content.xml from OpenDocument spreadsheet.');
  }

  const sheetSections: string[] = [];
  const tableRegex = /<table:table\b([^>]*)>([\s\S]*?)<\/table:table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(contentXml)) !== null) {
    const nameMatch = tableMatch[1].match(/table:name="([^"]+)"/i);
    const sheetName = decodeXmlEntities(
      nameMatch ? nameMatch[1] : `Sheet ${sheetSections.length + 1}`
    );

    const rows: string[] = [];
    const rowRegex = /<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/gi;
    let rowMatch: RegExpExecArray | null;

    while (
      (rowMatch = rowRegex.exec(tableMatch[2])) !== null &&
      rows.length < MAX_SPREADSHEET_ROWS_PER_SHEET
    ) {
      const cells: string[] = [];
      const cellRegex = /<table:table-cell\b([^>]*)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null && cells.length < 40) {
        const attrs = cellMatch[1];
        const body = cellMatch[2] ?? '';
        const repeatMatch = attrs.match(/table:number-columns-repeated="(\d+)"/i);
        const repeat = Math.min(20, repeatMatch ? Number.parseInt(repeatMatch[1], 10) : 1);

        let textVal = '';
        const pMatches = body.matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/gi);
        const parts: string[] = [];
        for (const pm of pMatches) {
          parts.push(decodeXmlEntities(pm[1].replace(/<[^>]+>/g, '')).trim());
        }
        textVal = parts.filter(Boolean).join(' ');

        if (!textVal) {
          const dateVal = attrs.match(/office:date-value="([^"]+)"/i);
          const numVal = attrs.match(/office:value="([^"]+)"/i);
          textVal = dateVal?.[1] ?? numVal?.[1] ?? '';
        }

        for (let i = 0; i < repeat && cells.length < 40; i++) {
          cells.push(textVal);
        }
      }

      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      if (cells.some((c) => c !== '')) {
        rows.push(cells.join(' | '));
      }
    }

    if (rows.length > 0) {
      sheetSections.push(`=== Worksheet: ${sheetName} (${rows.length} rows) ===\n${rows.join('\n')}`);
    }
  }

  return {
    text: sheetSections.join('\n\n'),
    sheetCount: sheetSections.length,
  };
}

/**
 * Lightweight legacy Excel (.xls BIFF8 / OLE2) text & numeric record extractor.
 * Extracts printable strings and numeric cells cleanly without external vulnerable CJS parsers.
 */
function parseLegacyXlsBuffer(buffer: Buffer): string {
  // Check if the .xls file is actually HTML/TSV/XML disguised with a .xls extension (very common for bank exports!)
  const head = buffer.subarray(0, 512).toString('utf8').trimStart();
  if (
    head.startsWith('<html') ||
    head.startsWith('<!DOCTYPE') ||
    head.startsWith('<table') ||
    head.startsWith('<?xml')
  ) {
    return stripHtmlToTableText(buffer.toString('utf8'));
  }
  if (/^[\x20-\x7E\t\r\n,;"'-]{32,}/.test(head)) {
    return formatDelimitedText(buffer.toString('utf8'));
  }

  // Extract BIFF8 records directly if OLE2 or raw BIFF stream
  const cellMap = new Map<number, Map<number, string>>();
  const sstStrings: string[] = [];

  const setCell = (row: number, col: number, val: string) => {
    if (row < 0 || row > 5000 || col < 0 || col > 40) return;
    let rowMap = cellMap.get(row);
    if (!rowMap) {
      rowMap = new Map<number, string>();
      cellMap.set(row, rowMap);
    }
    rowMap.set(col, val);
  };

  const decodeRk = (rk: number): number => {
    const isMultiplied = (rk & 0x01) !== 0;
    const isInt = (rk & 0x02) !== 0;
    let val: number;
    if (isInt) {
      val = rk >> 2;
    } else {
      const tmp = Buffer.alloc(8);
      tmp.writeUInt32LE((rk & 0xfffffffc) >>> 0, 4);
      val = tmp.readDoubleLE(0);
    }
    return isMultiplied ? val / 100 : val;
  };

  // Scan for BIFF8 records (type + length) across the binary stream
  // Works reliably for standard single-stream BIFF8 workbooks
  const biffStart = buffer.indexOf(Buffer.from([0x09, 0x08, 0x10, 0x00]));
  if (biffStart >= 0) {
    let offset = biffStart;
    while (offset + 4 <= buffer.length) {
      const recType = buffer.readUInt16LE(offset);
      const recLen = buffer.readUInt16LE(offset + 2);
      const dataStart = offset + 4;
      const dataEnd = dataStart + recLen;
      if (dataEnd > buffer.length) break;

      if (recType === 0x00fc && recLen >= 8) {
        // SST (Shared String Table)
        let p = dataStart + 8;
        while (p + 3 <= dataEnd && sstStrings.length < 5000) {
          const charCount = buffer.readUInt16LE(p);
          const flags = buffer.readUInt8(p + 2);
          p += 3;
          const isUtf16 = (flags & 0x01) !== 0;
          const hasExt = (flags & 0x04) !== 0;
          const hasRich = (flags & 0x08) !== 0;
          let richRuns = 0;
          let extLen = 0;
          if (hasRich && p + 2 <= dataEnd) {
            richRuns = buffer.readUInt16LE(p);
            p += 2;
          }
          if (hasExt && p + 4 <= dataEnd) {
            extLen = buffer.readUInt32LE(p);
            p += 4;
          }
          const byteLen = isUtf16 ? charCount * 2 : charCount;
          if (p + byteLen > dataEnd) break;
          const str = isUtf16
            ? buffer.subarray(p, p + byteLen).toString('utf16le')
            : buffer.subarray(p, p + byteLen).toString('latin1');
          sstStrings.push(str.replace(/\s+/g, ' ').trim());
          p += byteLen + richRuns * 4 + extLen;
        }
      } else if (recType === 0x00fd && recLen >= 10) {
        // LABELSST
        const row = buffer.readUInt16LE(dataStart);
        const col = buffer.readUInt16LE(dataStart + 2);
        const sstIdx = buffer.readUInt32LE(dataStart + 6);
        if (sstStrings[sstIdx] !== undefined) {
          setCell(row, col, sstStrings[sstIdx]);
        }
      } else if (recType === 0x0204 && recLen >= 8) {
        // LABEL
        const row = buffer.readUInt16LE(dataStart);
        const col = buffer.readUInt16LE(dataStart + 2);
        const len = buffer.readUInt16LE(dataStart + 6);
        if (dataStart + 8 + len <= dataEnd) {
          setCell(row, col, buffer.subarray(dataStart + 8, dataStart + 8 + len).toString('latin1').trim());
        }
      } else if (recType === 0x0203 && recLen >= 14) {
        // NUMBER (IEEE 754 float64)
        const row = buffer.readUInt16LE(dataStart);
        const col = buffer.readUInt16LE(dataStart + 2);
        const num = buffer.readDoubleLE(dataStart + 6);
        if (Number.isFinite(num)) {
          setCell(row, col, Number(num.toFixed(4)).toString());
        }
      } else if (recType === 0x027e && recLen >= 10) {
        // RK
        const row = buffer.readUInt16LE(dataStart);
        const col = buffer.readUInt16LE(dataStart + 2);
        const num = decodeRk(buffer.readInt32LE(dataStart + 6));
        if (Number.isFinite(num)) {
          setCell(row, col, Number(num.toFixed(4)).toString());
        }
      } else if (recType === 0x00bd && recLen >= 10) {
        // MULRK
        const row = buffer.readUInt16LE(dataStart);
        const firstCol = buffer.readUInt16LE(dataStart + 2);
        const lastCol = buffer.readUInt16LE(dataEnd - 2);
        let p = dataStart + 4;
        for (let col = firstCol; col <= lastCol && p + 6 <= dataEnd - 2; col++) {
          const num = decodeRk(buffer.readInt32LE(p + 2));
          if (Number.isFinite(num)) {
            setCell(row, col, Number(num.toFixed(4)).toString());
          }
          p += 6;
        }
      }

      offset = dataEnd;
    }
  }

  if (cellMap.size > 0) {
    const sortedRows = [...cellMap.keys()].sort((a, b) => a - b).slice(0, MAX_SPREADSHEET_ROWS_PER_SHEET);
    const lines = sortedRows.map((r) => {
      const cols = cellMap.get(r)!;
      const maxCol = Math.max(...cols.keys());
      const vals: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        vals.push(cols.get(c) ?? '');
      }
      return vals.join(' | ');
    });
    return `=== Legacy Excel (.xls) Extracted Rows ===\n${lines.join('\n')}`;
  }

  // Fallback: extract printable ASCII/UTF-16 sequences for Gemini to interpret
  const asciiChunks = buffer
    .toString('latin1')
    .match(/[A-Za-z0-9$.,:/()\- ]{4,}/g);
  return (asciiChunks ?? []).slice(0, 1500).join('\n');
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function formatDelimitedText(raw: string, forcedDelimiter?: string): string {
  const cleaned = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return '';

  let delimiter = forcedDelimiter;
  if (!delimiter) {
    const sample = rawLines.slice(0, 10).join('\n');
    const candidates = [',', '\t', ';', '|'];
    delimiter = candidates.reduce((best, curr) => {
      const bestCount = sample.split(best).length;
      const currCount = sample.split(curr).length;
      return currCount > bestCount ? curr : best;
    }, ',');
  }

  const parsedLines = rawLines
    .slice(0, MAX_SPREADSHEET_ROWS_PER_SHEET)
    .map((line) => parseDelimitedLine(line, delimiter).join(' | '));
  return parsedLines.join('\n');
}

async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const budget = { remainingBytes: MAX_UNCOMPRESSED_ZIP_BYTES };
  const docXml = await readZipEntrySafely(zip, 'word/document.xml', budget);
  if (!docXml) {
    throw new Error('Could not read word/document.xml from DOCX file.');
  }

  // Preserve table cell boundaries and paragraph breaks
  const withSeparators = docXml
    .replace(/<\/w:tc>/gi, ' | ')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:tab\b[^>]*\/>/gi, '\t');

  const stripped = decodeXmlEntities(withSeparators.replace(/<[^>]+>/g, ''));
  return stripped
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function parseOdtBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const budget = { remainingBytes: MAX_UNCOMPRESSED_ZIP_BYTES };
  const contentXml = await readZipEntrySafely(zip, 'content.xml', budget);
  if (!contentXml) {
    throw new Error('Could not read content.xml from ODT file.');
  }

  const withSeparators = contentXml
    .replace(/<\/table:table-cell>/gi, ' | ')
    .replace(/<\/table:table-row>/gi, '\n')
    .replace(/<\/text:p>/gi, '\n')
    .replace(/<\/text:h>/gi, '\n');

  const stripped = decodeXmlEntities(withSeparators.replace(/<[^>]+>/g, ''));
  return stripped
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function parseOfxQfxText(raw: string): string {
  const txnBlocks = raw.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi);
  if (!txnBlocks || txnBlocks.length === 0) {
    return raw;
  }

  const getTag = (block: string, tag: string): string => {
    const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
    return match ? decodeXmlEntities(match[1].trim()) : '';
  };

  const rows: string[] = ['Date | Type | Amount | Name | Memo'];
  for (const block of txnBlocks.slice(0, MAX_SPREADSHEET_ROWS_PER_SHEET)) {
    const rawDate = getTag(block, 'DTPOSTED');
    const formattedDate =
      rawDate.length >= 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    const type = getTag(block, 'TRNTYPE');
    const amount = getTag(block, 'TRNAMT');
    const name = getTag(block, 'NAME');
    const memo = getTag(block, 'MEMO');
    rows.push(`${formattedDate} | ${type} | ${amount} | ${name} | ${memo}`);
  }
  return rows.join('\n');
}

function parseQifText(raw: string): string {
  const entries = raw.split(/\r?\n\^\r?\n?/);
  const rows: string[] = ['Date | Amount | Payee | Category | Memo'];
  for (const entry of entries.slice(0, MAX_SPREADSHEET_ROWS_PER_SHEET)) {
    const lines = entry.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let date = '';
    let amount = '';
    let payee = '';
    let category = '';
    let memo = '';
    for (const line of lines) {
      const code = line[0];
      const val = line.slice(1).trim();
      if (code === 'D') date = val;
      else if (code === 'T' || code === 'U') amount = val;
      else if (code === 'P') payee = val;
      else if (code === 'L') category = val;
      else if (code === 'M') memo = val;
    }
    if (amount || payee) {
      rows.push(`${date} | ${amount} | ${payee} | ${category} | ${memo}`);
    }
  }
  return rows.length > 1 ? rows.join('\n') : raw;
}

function stripRtfToText(raw: string): string {
  return raw
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, ' | ')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function stripHtmlToTableText(raw: string): string {
  const withoutScripts = raw
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const structured = withoutScripts
    .replace(/<\/(?:td|th)>/gi, ' | ')
    .replace(/<\/(?:tr|p|div|li|h[1-6]|br)>/gi, '\n');
  return decodeXmlEntities(structured.replace(/<[^>]+>/g, ''))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export async function parseUploadedDocument(
  buffer: Buffer,
  originalName: string,
  declaredMimeType: string
): Promise<ParsedDocumentResult> {
  const ext = path.extname(originalName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file type "${ext || 'unknown'}". Supported formats include PDF, XLSX, XLS, ODS, CSV, TSV, PNG, JPG, WebP, HEIC, OFX, QFX, QIF, DOCX, ODT, RTF, TXT, JSON, XML, and HTML.`
    );
  }

  // 1. Native PDF multimodal
  if (ext === '.pdf') {
    return {
      kind: 'multimodal',
      mimeType: 'application/pdf',
      base64Data: buffer.toString('base64'),
      formatLabel: 'PDF Document',
    };
  }

  // 2. Native Image / Receipt / Screenshot multimodal
  if (IMAGE_MIME_BY_EXT[ext]) {
    const mimeType = IMAGE_MIME_BY_EXT[ext] || declaredMimeType || 'image/png';
    return {
      kind: 'multimodal',
      mimeType,
      base64Data: buffer.toString('base64'),
      formatLabel: `Image (${ext.slice(1).toUpperCase()})`,
    };
  }

  // 3. Modern Excel spreadsheets (.xlsx, .xlsm)
  if (ext === '.xlsx' || ext === '.xlsm') {
    const parsed = await parseXlsxBuffer(buffer);
    if (!parsed.text.trim()) {
      throw new Error('The uploaded spreadsheet appears to be empty.');
    }
    const { text, truncated } = truncateText(parsed.text);
    return {
      kind: 'text',
      text,
      formatLabel: `Excel Spreadsheet (${ext.slice(1).toUpperCase()})`,
      truncated,
      metadataSummary: `${parsed.sheetCount} ${parsed.sheetCount === 1 ? 'worksheet' : 'worksheets'}`,
    };
  }

  // 4. OpenDocument spreadsheets (.ods)
  if (ext === '.ods') {
    const parsed = await parseOdsBuffer(buffer);
    if (!parsed.text.trim()) {
      throw new Error('The uploaded ODS spreadsheet appears to be empty.');
    }
    const { text, truncated } = truncateText(parsed.text);
    return {
      kind: 'text',
      text,
      formatLabel: 'OpenDocument Spreadsheet (ODS)',
      truncated,
      metadataSummary: `${parsed.sheetCount} ${parsed.sheetCount === 1 ? 'worksheet' : 'worksheets'}`,
    };
  }

  // 5. Legacy Excel spreadsheets (.xls)
  if (ext === '.xls') {
    const extracted = parseLegacyXlsBuffer(buffer);
    if (!extracted.trim()) {
      throw new Error('Could not extract readable rows from this .xls file.');
    }
    const { text, truncated } = truncateText(extracted);
    return {
      kind: 'text',
      text,
      formatLabel: 'Legacy Excel Spreadsheet (XLS)',
      truncated,
    };
  }

  // 6. CSV / TSV spreadsheets
  if (ext === '.csv' || ext === '.tsv') {
    const formatted = formatDelimitedText(
      buffer.toString('utf8'),
      ext === '.tsv' ? '\t' : undefined
    );
    if (!formatted.trim()) {
      throw new Error('The uploaded spreadsheet file is empty.');
    }
    const { text, truncated } = truncateText(formatted);
    return {
      kind: 'text',
      text,
      formatLabel: ext === '.tsv' ? 'TSV Spreadsheet' : 'CSV Spreadsheet',
      truncated,
    };
  }

  // 7. Word / OpenDocument text documents
  if (ext === '.docx') {
    const extracted = await parseDocxBuffer(buffer);
    if (!extracted.trim()) {
      throw new Error('The uploaded Word document contains no readable text.');
    }
    const { text, truncated } = truncateText(extracted);
    return {
      kind: 'text',
      text,
      formatLabel: 'Word Document (DOCX)',
      truncated,
    };
  }

  if (ext === '.odt') {
    const extracted = await parseOdtBuffer(buffer);
    if (!extracted.trim()) {
      throw new Error('The uploaded ODT document contains no readable text.');
    }
    const { text, truncated } = truncateText(extracted);
    return {
      kind: 'text',
      text,
      formatLabel: 'OpenDocument Text (ODT)',
      truncated,
    };
  }

  // 8. Bank / Accounting exports (OFX, QFX, QIF, MT940)
  const rawUtf8 = buffer.toString('utf8');

  if (ext === '.ofx' || ext === '.qfx') {
    const formatted = parseOfxQfxText(rawUtf8);
    const { text, truncated } = truncateText(formatted);
    return {
      kind: 'text',
      text,
      formatLabel: `Bank Export (${ext.slice(1).toUpperCase()})`,
      truncated,
    };
  }

  if (ext === '.qif') {
    const formatted = parseQifText(rawUtf8);
    const { text, truncated } = truncateText(formatted);
    return {
      kind: 'text',
      text,
      formatLabel: 'Quicken Export (QIF)',
      truncated,
    };
  }

  if (ext === '.rtf') {
    const stripped = stripRtfToText(rawUtf8);
    const { text, truncated } = truncateText(stripped);
    return {
      kind: 'text',
      text,
      formatLabel: 'Rich Text Document (RTF)',
      truncated,
    };
  }

  if (ext === '.html' || ext === '.htm') {
    const stripped = stripHtmlToTableText(rawUtf8);
    const { text, truncated } = truncateText(stripped);
    return {
      kind: 'text',
      text,
      formatLabel: 'HTML Statement',
      truncated,
    };
  }

  // 9. Plain text, JSON, XML, Markdown, MT940/STA
  if (!rawUtf8.trim()) {
    throw new Error('The uploaded file is empty.');
  }
  const { text, truncated } = truncateText(rawUtf8);
  return {
    kind: 'text',
    text,
    formatLabel: `${ext.slice(1).toUpperCase()} Financial File`,
    truncated,
  };
}
