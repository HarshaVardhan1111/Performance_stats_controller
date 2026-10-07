// Monthly fill (the old "Stats Automate"): copies each employee's numbers from the
// performance file into the right rows and month column of their stats sheet.
// Rows are found by label, never by fixed row numbers.

import { cleanText, deepClone, normKey, normalizeId, valueText } from './text.js';
import { readLayout, rowKeys } from './layout.js';

/** Describe the performance workbook: one entry per sheet with an "Emp ID" column. */
export function analyzePerformance(workbook) {
  const sheets = [];
  for (const ws of workbook.worksheets) {
    let empIdCol = null;
    let nameCol = null;
    let lastHeaderCol = 0;
    ws.getRow(1).eachCell((cell, c) => {
      const k = normKey(valueText(cell.value)).replace(/[\s_.-]/g, '');
      if (!k) return;
      lastHeaderCol = Math.max(lastHeaderCol, c);
      if (!empIdCol && /^(emp|employee)id$/.test(k)) empIdCol = c;
      if (!nameCol && /name$/.test(k)) nameCol = c;
    });
    if (!empIdCol) continue;

    const firstMetricCol = Math.max(3, empIdCol + 1, nameCol ? nameCol + 1 : 0);
    const headers = [];
    for (let c = firstMetricCol; c <= lastHeaderCol; c += 1) headers.push(cleanText(valueText(ws.getCell(1, c).value)));

    const people = [];
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const id = normalizeId(ws.getCell(r, empIdCol).value);
      if (id) people.push({ id, name: nameCol ? cleanText(valueText(ws.getCell(r, nameCol).value)) : '' });
    }
    sheets.push({ name: ws.name, empIdCol, nameCol, firstMetricCol, headers, people });
  }
  return { sheets };
}

/**
 * Every row a mapping can point to, with `span` = the most rows that may be
 * written from it (up to the end of its block). `kind` decides what the picker
 * shows: 'process' (block start), 'other' (rows after the blocks) or 'row'
 * (inside a block - still resolvable, so a block that got merged with newly
 * inserted rows is never lost).
 */
export function fillTargets(layout) {
  const keyed = new Map(rowKeys(layout.rows).map((r) => [r.row, r]));
  const targets = [];
  for (const g of layout.groups) {
    for (const row of g.rows) {
      const kind = g.kind === 'other' ? 'other' : row.row === g.startRow ? 'process' : 'row';
      targets.push({
        key: keyed.get(row.row).key,
        label: kind === 'process' ? g.title : row.label,
        row: row.row,
        span: g.endRow - row.row + 1,
        kind,
        fill: row.fill,
      });
    }
  }
  return targets;
}

/**
 * mappings: { [perfSheetName]: { key, count } } - key from fillTargets().
 * month: 1-12. Copies value + formatting, like the original tool.
 */
export function applyMonthlyFill({ statsTemplate, employeeSheets, statsWorkbook, perfWorkbook, perfInfo, mappings, month, log = () => {} }) {
  const layout = readLayout(statsTemplate);
  const targets = new Map(fillTargets(layout).map((t) => [t.key, t]));
  const monthCol = readMonthColumnsSafe(statsTemplate, month);
  const sheetsById = new Map(employeeSheets.map((e) => [e.id, statsWorkbook.getWorksheet(e.sheetName)]));

  let cells = 0;
  const missing = new Map();
  const skipped = [];
  for (const info of perfInfo.sheets) {
    const m = mappings[info.name];
    if (!m?.key) continue;
    const target = targets.get(m.key);
    if (!target) {
      log(`"${info.name}": target row not found in the stats file - skipped`, 'warn');
      skipped.push(info.name);
      continue;
    }
    const count = Math.max(0, Math.min(m.count ?? info.headers.length, target.span, info.headers.length));
    const src = perfWorkbook.getWorksheet(info.name);
    let filled = 0;
    for (let r = 2; r <= src.rowCount; r += 1) {
      const srcRow = src.getRow(r);
      const id = normalizeId(srcRow.getCell(info.empIdCol).value);
      if (!id) continue;
      const dest = sheetsById.get(id);
      if (!dest) {
        missing.set(id, info.nameCol ? cleanText(valueText(srcRow.getCell(info.nameCol).value)) : '');
        continue;
      }
      for (let k = 0; k < count; k += 1) {
        const s = srcRow.getCell(info.firstMetricCol + k);
        const d = dest.getCell(target.row + k, monthCol);
        const v = s.value;
        d.value = v && typeof v === 'object' && 'formula' in v ? v.result ?? null : deepClone(v);
        d.style = deepClone(s.style) ?? {};
        cells += 1;
      }
      filled += 1;
    }
    log(`"${info.name}" -> "${target.label}": ${filled} employee(s), ${count} row(s) each`, 'success');
  }
  if (missing.size) log(`${missing.size} Emp ID(s) in the performance file have no sheet`, 'warn');
  return { cells, skipped, missing: [...missing].map(([id, name]) => ({ id, name })) };
}

function readMonthColumnsSafe(ws, month) {
  let col = null;
  ws.getRow(1).eachCell((cell, c) => {
    const v = cell.value instanceof Date ? cell.value : null;
    if (!col && v && v.getUTCMonth() + 1 === month) col = c;
  });
  return col ?? month + 1;
}
