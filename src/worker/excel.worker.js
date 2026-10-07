// Runs all Excel work off the main thread so the page never freezes.
// Files stay in this browser tab - nothing is sent anywhere.

import ExcelJS from 'exceljs';
import { analyzeStats, applyChanges } from '../core/pipeline.js';
import { analyzePerformance } from '../core/monthlyFill.js';
import { parseEmployeeList } from '../core/employees.js';
import { readPreservedParts, restoreParts } from '../core/preserve.js';

let statsBuffer = null;
let perfBuffer = null;

async function open(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

const handlers = {
  async loadStats({ buffer }, progress) {
    progress('Reading workbook…');
    const result = analyzeStats(await open(buffer));
    if (result.ok) statsBuffer = buffer; // a bad file keeps the previous one usable
    return { result };
  },

  async loadPerformance({ buffer }, progress) {
    progress('Reading performance file…');
    const result = analyzePerformance(await open(buffer));
    perfBuffer = buffer;
    return { result };
  },

  async parseEmployeeList({ buffer }) {
    return { result: parseEmployeeList(await open(buffer)) };
  },

  async apply(changes, progress) {
    if (!statsBuffer) throw new Error('Load a Team Level Stats file first.');
    progress('Opening stats file…');
    const preserved = readPreservedParts(statsBuffer);
    const wb = await open(statsBuffer);
    let perfWorkbook;
    let perfInfo;
    if (changes.fill) {
      if (!perfBuffer) throw new Error('Load a performance file first.');
      progress('Opening performance file…');
      perfWorkbook = await open(perfBuffer);
      perfInfo = analyzePerformance(perfWorkbook);
    }
    const summary = applyChanges(wb, changes, { perfWorkbook, perfInfo, log: progress });
    progress('Writing the updated file…');
    const written = await wb.xlsx.writeBuffer();
    const { bytes, restored } = restoreParts(written, preserved);
    if (restored.length) progress(`Kept Excel tables and formats intact (${restored.length} part(s))`);
    const out = toArrayBuffer(bytes);
    statsBuffer = out.slice(0); // keep editing the updated file next time
    const analysis = analyzeStats(wb);
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
