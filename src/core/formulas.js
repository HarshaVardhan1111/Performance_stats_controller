// Keeps formulas pointing at the right cells after rows are inserted.
// ExcelJS moves cells but never rewrites formula text, so we do it here.

import { normKey } from './text.js';

const SHEET_PREFIX = /^(?:'((?:[^']|'')+)'|([A-Za-z_À-￿][\w.À-￿]*))!/;
const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/;
const BLOCKED_BEFORE = /[\w.$'À-￿]/;
const BLOCKED_AFTER = /[\w(]/;

/**
 * Shift row numbers in a formula after `count` rows were inserted at row `at`
 * in every sheet listed in `affected` (a Set of normKey(sheetName)).
 * `ownSheet` is the sheet the formula lives in (for refs without a sheet name).
 */
export function shiftFormulaRows(formula, { at, count, ownSheet, affected }) {
  let out = '';
  let i = 0;
  let lastSheet = null; // sheet of the previous ref, for the 2nd half of A1:B2
  let lastEnd = -1;

  while (i < formula.length) {
    const ch = formula[i];

    // Skip string literals ("" is an escaped quote).
    if (ch === '"') {
      let j = i + 1;
      while (j < formula.length) {
        if (formula[j] === '"' && formula[j + 1] === '"') j += 2;
        else if (formula[j] === '"') break;
        else j += 1;
      }
      out += formula.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    const prev = i > 0 ? formula[i - 1] : '';
    if (!prev || !BLOCKED_BEFORE.test(prev)) {
      const rest = formula.slice(i);
      const sheetMatch = rest.match(SHEET_PREFIX);
      const afterSheet = sheetMatch ? rest.slice(sheetMatch[0].length) : rest;
      const cellMatch = afterSheet.match(CELL);
      if (cellMatch) {
        const end = i + (sheetMatch ? sheetMatch[0].length : 0) + cellMatch[0].length;
        const next = formula[end] ?? '';
        if (!BLOCKED_AFTER.test(next)) {
          let sheet;
          if (sheetMatch) sheet = (sheetMatch[1] ?? sheetMatch[2]).replace(/''/g, "'");
          else if (prev === ':' && lastEnd === i - 1 && lastSheet !== null) sheet = lastSheet;
          else sheet = ownSheet;

          const [, colAbs, col, rowAbs, rowText] = cellMatch;
          let row = Number(rowText);
          if (affected.has(normKey(sheet)) && row >= at) row += count;

          out += (sheetMatch ? sheetMatch[0] : '') + colAbs + col + rowAbs + row;
          lastSheet = sheet;
          lastEnd = end;
          i = end;
          continue;
        }
      }
    }

    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Turn shared formulas into normal ones. Shared formulas point at a "master"
 * cell by address, which breaks as soon as rows move.
 */
export function expandSharedFormulas(workbook) {
  workbook.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (!v || typeof v !== 'object') return;
        if (v.sharedFormula) {
          const formula = cell.formula; // ExcelJS translates it from the master
          cell.value = formula ? { formula, result: v.result } : v.result ?? null;
        } else if (v.formula && (v.shareType || v.ref)) {
          cell.value = { formula: v.formula, result: v.result };
        }
      });
    });
  });
}

/** Rewrite every formula in the workbook for an insert of `count` rows at `at`. */
export function shiftWorkbookFormulas(workbook, { at, count, affected }) {
  let changed = 0;
  workbook.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (!v || typeof v !== 'object' || typeof v.formula !== 'string') return;
        const formula = shiftFormulaRows(v.formula, { at, count, ownSheet: ws.name, affected });
        if (formula !== v.formula) {
          // Drop the cached result; Excel recalculates on open.
          cell.value = { formula };
          changed += 1;
        }
      });
    });
  });
  return changed;
}
