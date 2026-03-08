export interface TableData {
  headers: string[];
  rows: string[][];
  aligns: ('left' | 'center' | 'right' | 'none')[];
}

/**
 * Parse a Markdown table string into structured TableData.
 * Returns null if the string is not a valid Markdown table.
 */
export function parseMarkdownTable(text: string): TableData | null {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return null;

  // Check all lines start/end with |
  const isTable = lines.every((l) => l.trim().startsWith('|'));
  if (!isTable) return null;

  const parseLine = (line: string): string[] => {
    const trimmed = line.trim();
    // Remove leading and trailing |
    const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const final = inner.endsWith('|') ? inner.slice(0, -1) : inner;
    return final.split('|').map((c) => c.trim());
  };

  const headers = parseLine(lines[0]);
  if (headers.length === 0) return null;

  // Parse alignment row
  const alignCells = parseLine(lines[1]);
  const aligns: TableData['aligns'] = alignCells.map((cell) => {
    const c = cell.replace(/\s/g, '');
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    if (c.startsWith(':')) return 'left';
    return 'none';
  });

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    // Pad or truncate to header length
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }

  return { headers, rows, aligns };
}

/**
 * Generate a formatted Markdown table string from TableData.
 */
export function generateMarkdownTable(data: TableData): string {
  const { headers, rows, aligns } = data;
  const colCount = headers.length;

  // Calculate column widths
  const widths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      if (row[i] && row[i].length > max) max = row[i].length;
    }
    return Math.max(max, 3); // minimum 3 for ---
  });

  const pad = (text: string, width: number, align: string): string => {
    const diff = width - text.length;
    if (diff <= 0) return text;
    if (align === 'center') {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return ' '.repeat(left) + text + ' '.repeat(right);
    }
    if (align === 'right') return ' '.repeat(diff) + text;
    return text + ' '.repeat(diff);
  };

  const formatRow = (cells: string[]): string => {
    const formatted = cells.map((cell, i) =>
      pad(cell, widths[i], aligns[i] || 'none')
    );
    return '| ' + formatted.join(' | ') + ' |';
  };

  // Header
  const headerLine = formatRow(headers);

  // Alignment row
  const alignLine =
    '| ' +
    Array.from({ length: colCount }, (_, i) => {
      const w = widths[i];
      const a = aligns[i] || 'none';
      const dashes = '-'.repeat(w);
      if (a === 'center') return ':' + dashes.slice(1, -1) + ':';
      if (a === 'right') return dashes.slice(0, -1) + ':';
      if (a === 'left') return ':' + dashes.slice(1);
      return dashes;
    }).join(' | ') +
    ' |';

  // Data rows
  const dataLines = rows.map((row) => formatRow(row));

  return [headerLine, alignLine, ...dataLines].join('\n');
}

/**
 * Create an empty table with given dimensions.
 */
export function createEmptyTable(rowCount: number, colCount: number): string {
  const headers = Array.from({ length: colCount }, (_, i) => `列${i + 1}`);
  const aligns: TableData['aligns'] = Array(colCount).fill('none');
  const rows = Array.from({ length: rowCount }, () =>
    Array(colCount).fill('')
  );
  return generateMarkdownTable({ headers, rows, aligns });
}
