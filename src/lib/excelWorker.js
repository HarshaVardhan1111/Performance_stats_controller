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

export function runTask(type, payload, { onProgress, transfer = [] } = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, type, payload }, transfer);
  });
}

export async function readFile(file) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Please choose an .xlsx Excel file.');
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
