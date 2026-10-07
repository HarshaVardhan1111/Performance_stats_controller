// One entry point used by the web worker: analyse a stats file, and apply all
// pending changes in a safe order (insert rows -> new employee sheets).

import { findTemplateSheet, listEmployeeSheets, readLayout } from './layout.js';
import { applyInsertions, splitByLayout } from './insertRows.js';
import { createEmployeeSheets } from './employees.js';

/**
 * Which sheets get inserted rows: REF plus every sheet whose column A matches
 * REF (with or without an Emp ID). Employee sheets that differ are reported.
 */
function planTargets(workbook, template, lastRow) {
  const others = workbook.worksheets.filter((ws) => ws !== template);
  const { matching, different } = splitByLayout(template, others, lastRow);
  const employees = listEmployeeSheets(workbook, template);
  const employeeNames = new Set(employees.map((e) => e.sheetName));
  const matchingNames = new Set(matching.map((ws) => ws.name));
  return {
    employees,
    matching,
    mismatched: different.filter((ws) => employeeNames.has(ws.name)).map((ws) => ws.name),
    noIdSheets: matching.filter((ws) => !employeeNames.has(ws.name)).map((ws) => ws.name),
    otherSheets: others.filter((ws) => !matchingNames.has(ws.name) && !employeeNames.has(ws.name)).map((ws) => ws.name),
  };
}

export function analyzeStats(workbook) {
  const template = findTemplateSheet(workbook);
  if (!template) {
    return { ok: false, error: 'No "REF" template sheet found. This does not look like a Team Level Stats file.' };
  }
  const layout = readLayout(template);
  if (!layout.rows.length) {
    return { ok: false, error: 'The REF sheet has no row labels in column A.' };
  }
  const plan = planTargets(workbook, template, layout.lastRow);
  return {
    ok: true,
    templateName: template.name,
    layout,
    employees: plan.employees,
    mismatched: plan.mismatched,
    noIdSheets: plan.noIdSheets,
    otherSheets: plan.otherSheets,
    targetCount: plan.matching.length + 1,
  };
}

/**
 * changes = {
 *   inserts:   [{ at, labels, color }],   // `at` = row number in the current REF
 *   employees: [{ id, name }],
 * }
 */
export function applyChanges(workbook, changes, { log = () => {} } = {}) {
  const template = findTemplateSheet(workbook);
  if (!template) throw new Error('No "REF" template sheet found.');
  const summary = { rowsAdded: 0, formulasUpdated: 0, sheetsCreated: [], employeesSkipped: [], sheetsSkipped: [] };

  if (changes.inserts?.length) {
    const layout = readLayout(template);
    const plan = planTargets(workbook, template, layout.lastRow);
    for (const name of plan.mismatched) log(`Skipped "${name}" - its rows do not match REF`, 'warn');
    summary.sheetsSkipped = plan.mismatched;
    const res = applyInsertions(workbook, {
      inserts: changes.inserts,
      targets: [template, ...plan.matching],
      styleCols: Math.max(template.actualColumnCount, 1),
      log,
    });
    summary.rowsAdded = res.rowsAdded;
    summary.formulasUpdated = res.formulasUpdated;
  }

  if (changes.employees?.length) {
    const existing = listEmployeeSheets(workbook, template);
    const res = createEmployeeSheets(workbook, { template, employees: changes.employees, existing, log });
    summary.sheetsCreated = res.created;
    summary.employeesSkipped = res.skipped;
  }

  workbook.calcProperties = { ...(workbook.calcProperties ?? {}), fullCalcOnLoad: true };
  return summary;
}
