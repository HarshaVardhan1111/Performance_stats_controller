// Inserts new rows (for example a new process block) at any position
// in the template and every employee sheet, keeping styles and formulas right.

import { deepClone, normKey } from './text.js';
import { expandSharedFormulas, shiftWorkbookFormulas } from './formulas.js';
import { labelKeys } from './layout.js';

export function hexToArgb(hex) {
  const clean = String(hex || '').replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(clean) ? `FF${clean}` : null;
}

/** Sheets whose column A differs from the template are unsafe to change. */
export function findLayoutMismatches(template, sheets, lastRow) {
  const expected = labelKeys(template, lastRow);
  return sheets.filter((ws) => {
    const actual = labelKeys(ws, lastRow);
    return actual.some((k, i) => k !== expected[i]);
  });
}

function insertIntoSheet(ws, { at, labels, color, styleCols }) {
  // Style comes from the row above (or the row being pushed down at the very top).
  const source = ws.getRow(at > 2 ? at - 1 : at);
  const styles = [];
  for (let c = 1; c <= styleCols; c += 1) styles[c] = deepClone(source.getCell(c).style) ?? {};
  const height = source.height;

  ws.spliceRows(at, 0, ...labels.map((label) => [label]));

  const argb = hexToArgb(color);
  labels.forEach((_, i) => {
    const row = ws.getRow(at + i);
    if (height) row.height = height;
    for (let c = 1; c <= styleCols; c += 1) {
      const cell = row.getCell(c);
      const style = deepClone(styles[c]);
      if (c > 1) delete style.numFmt; // new rows start as General
      cell.style = style;
      if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
  });
}

/**
 * inserts: [{ at, labels: string[], color: '#RRGGBB' }] - `at` is a row number
 * in the ORIGINAL layout (new rows go above that row).
 * targets: worksheets to change (template + employee sheets).
 */
export function applyInsertions(workbook, { inserts, targets, styleCols, log = () => {} }) {
  if (!inserts.length) return { rowsAdded: 0, formulasUpdated: 0 };
  expandSharedFormulas(workbook);
  const affected = new Set(targets.map((ws) => normKey(ws.name)));

  // Bottom-up so earlier row numbers stay valid. Same position: last-added first,
  // so the block added first ends up on top.
  const ordered = inserts
    .map((ins, order) => ({ ...ins, order }))
    .sort((a, b) => b.at - a.at || b.order - a.order);

  let formulasUpdated = 0;
  let rowsAdded = 0;
  for (const ins of ordered) {
    const labels = ins.labels.map((l) => String(l ?? '').trim());
    if (!labels.length) continue;
    formulasUpdated += shiftWorkbookFormulas(workbook, { at: ins.at, count: labels.length, affected });
    for (const ws of targets) insertIntoSheet(ws, { at: ins.at, labels, color: ins.color, styleCols });
    rowsAdded += labels.length;
    log(`Inserted ${labels.length} row(s) "${labels[0]}" above row ${ins.at} in ${targets.length} sheet(s)`, 'success');
  }
  return { rowsAdded, formulasUpdated };
}
