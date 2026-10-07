// One entry point used by the web worker: analyse a stats file, and apply all
// pending changes in a safe order (insert rows -> new employees -> monthly fill).

import { findTemplateSheet, listEmployeeSheets, readLayout, readMonthColumns } from './layout.js';
import { applyInsertions, findLayoutMismatches } from './insertRows.js';
import { createEmployeeSheets } from './employees.js';
import { applyMonthlyFill, fillTargets } from './monthlyFill.js';

export function analyzeStats(workbook) {
  const template = findTemplateSheet(workbook);
  if (!template) {
    return { ok: false, error: 'No "REF" template sheet found. This does not look like a Team Level Stats file.' };
  }
  const layout = readLayout(template);
  const employees = listEmployeeSheets(workbook, template);
  const employeeNames = new Set(employees.map((e) => e.sheetName));
  const mismatched = findLayoutMismatches(
    template,
    employees.map((e) => workbook.getWorksheet(e.sheetName)),
    layout.lastRow,
  ).map((ws) => ws.name);
  return {
    ok: true,
    templateName: template.name,
    layout,
    months: readMonthColumns(template),
    targets: fillTargets(layout),
    employees,
    otherSheets: workbook.worksheets.filter((ws) => ws !== template && !employeeNames.has(ws.name)).map((ws) => ws.name),
    mismatched,
    styleCols: Math.max(template.actualColumnCount, 1),
  };
}

/**
 * changes = {
 *   inserts:   [{ at, labels, color }],
 *   employees: [{ id, name }],
 *   fill:      { month, mappings } | null   (needs perfWorkbook + perfInfo)
 * }
 */
export function applyChanges(workbook, changes, { perfWorkbook, perfInfo, log = () => {} } = {}) {
  const template = findTemplateSheet(workbook);
  if (!template) throw new Error('No "REF" template sheet found.');
  const summary = { rowsAdded: 0, formulasUpdated: 0, sheetsCreated: [], employeesSkipped: [], cellsFilled: 0, missing: [], sheetsSkipped: [], fillSkipped: [] };

  let existing = listEmployeeSheets(workbook, template);

  if (changes.inserts?.length) {
    const layout = readLayout(template);
    const sheets = existing.map((e) => workbook.getWorksheet(e.sheetName));
    const bad = new Set(findLayoutMismatches(template, sheets, layout.lastRow));
    for (const ws of bad) log(`Skipped "${ws.name}" - its rows do not match REF`, 'warn');
    summary.sheetsSkipped = [...bad].map((ws) => ws.name);
    const targets = [template, ...sheets.filter((ws) => !bad.has(ws))];
    const res = applyInsertions(workbook, {
      inserts: changes.inserts,
      targets,
      styleCols: Math.max(template.actualColumnCount, 1),
      log,
    });
    summary.rowsAdded = res.rowsAdded;
    summary.formulasUpdated = res.formulasUpdated;
  }

  if (changes.employees?.length) {
    const res = createEmployeeSheets(workbook, { template, employees: changes.employees, existing, log });
    summary.sheetsCreated = res.created;
    summary.employeesSkipped = res.skipped;
    existing = listEmployeeSheets(workbook, template);
  }

  if (changes.fill && perfWorkbook && perfInfo) {
    const res = applyMonthlyFill({
      statsTemplate: template,
      employeeSheets: existing,
      statsWorkbook: workbook,
      perfWorkbook,
      perfInfo,
      mappings: changes.fill.mappings,
      month: changes.fill.month,
      log,
    });
    summary.cellsFilled = res.cells;
    summary.missing = res.missing;
    summary.fillSkipped = res.skipped;
  }

  workbook.calcProperties = { ...(workbook.calcProperties ?? {}), fullCalcOnLoad: true };
  return summary;
}
