// Reads the structure of the template (REF) sheet: rows, process blocks, months.
// Nothing here knows any process name - everything comes from the file.

import { cleanText, normKey, normalizeId, valueText } from './text.js';

const BLOCK_END = /^error cost/; // every process block ends with an "Error Cost $" row

export function findTemplateSheet(workbook) {
  return workbook.worksheets.find((ws) => normKey(ws.name) === 'ref') ?? null;
}

/** Employee sheets are the ones with a numeric Emp ID in A1. */
export function listEmployeeSheets(workbook, template) {
  return workbook.worksheets
    .filter((ws) => ws !== template)
    .map((ws) => ({ id: normalizeId(ws.getCell('A1').value), sheetName: ws.name }))
    .filter((e) => e.id);
}

export function cellFillHex(cell) {
  const argb = cell.fill?.type === 'pattern' ? cell.fill.fgColor?.argb : undefined;
  return typeof argb === 'string' && argb.length === 8 ? `#${argb.slice(2).toUpperCase()}` : null;
}

/** Last row that has a label in column A. */
export function lastLabelRow(ws) {
  for (let r = ws.rowCount; r >= 1; r -= 1) {
    if (cleanText(valueText(ws.getCell(r, 1).value))) return r;
  }
  return 1;
}

/** Column A labels from row 2 down, as comparison keys. */
export function labelKeys(ws, lastRow) {
  const keys = [];
  for (let r = 2; r <= lastRow; r += 1) keys.push(normKey(valueText(ws.getCell(r, 1).value)));
  return keys;
}

/** Month number (1-12) -> column number, from the dates in row 1. */
export function readMonthColumns(ws) {
  const months = {};
  ws.getRow(1).eachCell((cell, col) => {
    const v = cell.value instanceof Date ? cell.value : cell.value?.result instanceof Date ? cell.value.result : null;
    if (v && !months[v.getUTCMonth() + 1]) months[v.getUTCMonth() + 1] = col;
  });
  for (let m = 1; m <= 12; m += 1) if (!months[m]) months[m] = m + 1; // B = Jan fallback
  return months;
}

/**
 * Rows + groups. A "process" group runs until an "Error Cost" row.
 * Rows after the last process (single summary rows) are grouped by fill colour.
 */
export function readLayout(ws) {
  const lastRow = lastLabelRow(ws);
  const rows = [];
  for (let r = 2; r <= lastRow; r += 1) {
    const cell = ws.getCell(r, 1);
    rows.push({ row: r, label: cleanText(valueText(cell.value)), fill: cellFillHex(cell) });
  }

  const groups = [];
  let current = [];
  const close = (kind) => {
    if (!current.length) return;
    groups.push({
      kind,
      title: current[0].label || `Row ${current[0].row}`,
      fill: current[0].fill,
      startRow: current[0].row,
      endRow: current[current.length - 1].row,
      rows: current,
    });
    current = [];
  };

  for (const row of rows) {
    current.push(row);
    if (BLOCK_END.test(normKey(row.label))) close('process');
  }
  // Leftover rows: split by colour so separate items stay separate.
  const leftover = current;
  current = [];
  for (const row of leftover) {
    if (current.length && current[current.length - 1].fill !== row.fill) close('other');
    current.push(row);
  }
  close('other');

  // Stable keys (title + occurrence) so pending changes survive re-analysis.
  const seen = {};
  for (const g of groups) {
    const k = normKey(g.title);
    seen[k] = (seen[k] ?? 0) + 1;
    g.key = seen[k] > 1 ? `${k}#${seen[k]}` : k;
  }
  return { lastRow, rows, groups, colorPalette: [...new Set(rows.map((r) => r.fill).filter(Boolean))] };
}

/** Key for a single row: label + occurrence number among equal labels. */
export function rowKeys(rows) {
  const seen = {};
  return rows.map((r) => {
    const k = normKey(r.label);
    seen[k] = (seen[k] ?? 0) + 1;
    return { ...r, key: `${k}@${seen[k]}` };
  });
}
