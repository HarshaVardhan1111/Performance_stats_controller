// Creates sheets for new employees by copying the template (REF) sheet.

import { cleanText, normKey, normalizeId, safeSheetName, valueText } from './text.js';
import { copyWorksheet } from './sheetCopy.js';

function uniqueName(base, taken) {
  let name = base;
  for (let n = 2; taken.has(normKey(name)); n += 1) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length).trim() + suffix;
  }
  return name;
}

/** Checks one manual entry against existing sheets and pending entries. */
export function validateNewEmployee({ id, name }, { existing, pending = [] }) {
  const cleanId = normalizeId(id);
  if (!cleanId) return 'Emp ID must be digits only';
  if (!cleanText(name)) return 'Name is required';
  const hit = existing.find((e) => e.id === cleanId);
  if (hit) return `ID already has sheet "${hit.sheetName}"`;
  if (pending.some((e) => e.id === cleanId)) return 'ID is already in the list';
  return null;
}

/**
 * employees: [{ id, name }]. Skips IDs that already have a sheet.
 * New sheets are placed right after the last existing employee sheet.
 */
export function createEmployeeSheets(workbook, { template, employees, existing, log = () => {} }) {
  const existingIds = new Map(existing.map((e) => [e.id, e.sheetName]));
  const taken = new Set(workbook.worksheets.map((ws) => normKey(ws.name)));
  const created = [];
  const skipped = [];

  for (const emp of employees) {
    const id = normalizeId(emp.id);
    const name = cleanText(emp.name);
    if (!id || !name) {
      skipped.push({ ...emp, reason: 'missing ID or name' });
      continue;
    }
    if (existingIds.has(id)) {
      skipped.push({ id, name, reason: `already has sheet "${existingIds.get(id)}"` });
      log(`Skipped ${name} (${id}) - already has sheet "${existingIds.get(id)}"`, 'warn');
      continue;
    }
    const sheetName = uniqueName(safeSheetName(name) || id, taken);
    const ws = workbook.addWorksheet(sheetName);
    copyWorksheet(template, ws);
    const a1 = template.getCell('A1');
    ws.getCell('A1').value = typeof a1.value === 'number' ? Number(id) : id;
    taken.add(normKey(sheetName));
    existingIds.set(id, sheetName);
    created.push({ id, name, sheetName });
    log(`Created sheet "${sheetName}" for ${id}`, 'success');
  }

  if (created.length) reorderAfterLastEmployee(workbook, existing, created);
  return { created, skipped };
}

function reorderAfterLastEmployee(workbook, existing, created) {
  const sheets = workbook.worksheets; // sorted by orderNo
  const createdNames = new Set(created.map((c) => c.sheetName));
  const others = sheets.filter((ws) => !createdNames.has(ws.name));
  const lastEmployeeName = existing[existing.length - 1]?.sheetName;
  const idx = others.findIndex((ws) => ws.name === lastEmployeeName);
  const insertAt = idx === -1 ? others.length : idx + 1;
  const newOnes = sheets.filter((ws) => createdNames.has(ws.name));
  const ordered = [...others.slice(0, insertAt), ...newOnes, ...others.slice(insertAt)];
  ordered.forEach((ws, i) => {
    ws.orderNo = i + 1;
  });
}

/**
 * Reads an employee list workbook: finds "Emp ID" / "Name" headers,
 * or falls back to column A = ID, column B = name.
 */
export function parseEmployeeList(workbook) {
  for (const ws of workbook.worksheets) {
    let idCol = null;
    let nameCol = null;
    let headerRow = 0;
    for (let r = 1; r <= Math.min(10, ws.rowCount) && !idCol; r += 1) {
      ws.getRow(r).eachCell((cell, c) => {
        const k = normKey(valueText(cell.value)).replace(/[\s_.-]/g, '');
        if (!idCol && /^(emp|employee)?(id|no|number|code)$/.test(k)) idCol = c;
        if (!nameCol && /name$/.test(k)) nameCol = c;
      });
      if (idCol) headerRow = r;
    }
    if (!idCol) {
      idCol = 1;
      nameCol = 2;
    }
    if (!nameCol) nameCol = idCol + 1;

    const employees = [];
    const seen = new Set();
    for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const id = normalizeId(row.getCell(idCol).value);
      const name = cleanText(valueText(row.getCell(nameCol).value));
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      employees.push({ id, name });
    }
    if (employees.length) return { sheetName: ws.name, employees };
  }
  return { sheetName: null, employees: [] };
}
