// Runs all Excel work off the main thread so the page never freezes.
// The worker keeps no state: every task brings its own file bytes, so a crashed
// or restarted worker can never lose the user's file. Nothing is sent anywhere.

import ExcelJS from 'exceljs';
import { analyzeStats, applyChanges } from '../core/pipeline.js';
import { parseEmployeeList } from '../core/employees.js';
import { readPreservedParts, restoreParts } from '../core/preserve.js';

function checkSignature(buffer) {
  const b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (b[0] === 0x50 && b[1] === 0x4b) return; // "PK" = zip = .xlsx
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    throw new Error('This file is password-protected or an old .xls file. Open it in Excel, remove the password / save as .xlsx, and try again.');
  }
  throw new Error('This is not a valid .xlsx Excel file.');
}

async function open(buffer) {
  checkSignature(buffer);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    throw new Error(`Excel could not read this file (${err?.message || 'unknown error'}). It may be damaged — open it in Excel and save it again.`);
  }
  return wb;
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

const handlers = {
  async analyze({ buffer }, progress) {
    progress('Reading workbook…');
    return { result: analyzeStats(await open(buffer)) };
  },

  async parseEmployeeList({ buffer }) {
    return { result: parseEmployeeList(await open(buffer)) };
  },

  async apply({ buffer, changes }, progress) {
    progress('Opening stats file…');
    const wb = await open(buffer);
    const preserved = readPreservedParts(buffer);
    const summary = applyChanges(wb, changes, { log: progress });
    progress('Writing the updated file…');
    const written = await wb.xlsx.writeBuffer();
    const { bytes, restored } = restoreParts(written, preserved);
    if (restored.length) progress(`Kept Excel tables and formats intact (${restored.length} part(s))`);
    const out = toArrayBuffer(bytes);
    // Re-read the saved bytes: proves the output opens, and gives the true new layout.
    progress('Checking the saved file…');
    const analysis = analyzeStats(await open(out.slice(0)));
    if (!analysis.ok) throw new Error(`The saved file failed a check: ${analysis.error}`);
    return { result: { summary, analysis, buffer: out }, transfer: [out] };
  },
};

self.onmessage = async ({ data }) => {
  const { id, type, payload } = data;
  const progress = (message, level = 'info') => self.postMessage({ id, kind: 'progress', message, level });
  try {
    const handler = handlers[type];
    if (!handler) throw new Error(`Unknown task: ${type}`);
    const { result, transfer = [] } = await handler(payload, progress);
    self.postMessage({ id, kind: 'result', result }, transfer);
  } catch (err) {
    self.postMessage({ id, kind: 'error', message: err?.message || String(err) });
  }
};
