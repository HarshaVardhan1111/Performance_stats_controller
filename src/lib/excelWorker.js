// Promise wrapper around the Excel web worker.

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../worker/excel.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id);
    if (!task) return;
    if (data.kind === 'progress') {
      task.onProgress?.(data.message, data.level);
      return;
    }
    pending.delete(data.id);
    if (data.kind === 'error') task.reject(new Error(data.message));
    else task.resolve(data.result);
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'The Excel engine stopped unexpectedly. Please reload the page.');
    for (const task of pending.values()) task.reject(error);
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

let queue = Promise.resolve();

/** Runs one task in the worker. Tasks run one at a time, in order. */
export function runTask(type, payload, { onProgress, transfer = [] } = {}) {
  const task = queue.then(
    () =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onProgress });
        getWorker().postMessage({ id, type, payload }, transfer);
      }),
  );
  queue = task.catch(() => {});
  return task;
}

const MAX_BYTES = 60 * 1024 * 1024;

export async function readFile(file) {
  if (/\.(xls|xlsm|xlsb|csv)$/i.test(file.name)) throw new Error(`“${file.name}” is not an .xlsx file. Save it as Excel Workbook (.xlsx) and try again.`);
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Please choose an .xlsx Excel file.');
  if (file.size === 0) throw new Error(`“${file.name}” is empty.`);
  if (file.size > MAX_BYTES) throw new Error(`“${file.name}” is too large (over 60 MB) to process in the browser.`);
  return file.arrayBuffer();
}

export function downloadBuffer(buffer, fileName) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function updatedFileName(name) {
  const base = name.replace(/\.xlsx$/i, '').replace(/ \(updated(?: \d+)?\)$/, '');
  return `${base} (updated).xlsx`;
}

export const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked - not critical */
    }
  },
};
