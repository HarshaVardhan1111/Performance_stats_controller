// Small helpers for reading text out of Excel cells safely.

const ODD_SPACES = /[   ​]/g;

/** Trim, turn non-breaking spaces into normal spaces, collapse repeats. */
export function cleanText(value) {
  return String(value ?? '')
    .replace(ODD_SPACES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Case-insensitive comparison key. */
export function normKey(value) {
  return cleanText(value).toLowerCase();
}

/** Display text of an ExcelJS cell value (rich text, formulas, links, dates). */
export function valueText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return cleanText(value);
  if (Array.isArray(value.richText)) return cleanText(value.richText.map((p) => p.text).join(''));
  if ('result' in value) return valueText(value.result);
  if ('text' in value) return cleanText(value.text);
  if ('error' in value) return '';
  return '';
}

/** Employee IDs are digits only; we keep them as strings. */
export function normalizeId(value) {
  const text = valueText(value).replace(/\.0+$/, '');
  return /^\d+$/.test(text) ? text : '';
}

/** Excel sheet names: max 31 chars, none of []:*?/\ and not blank. */
export function safeSheetName(name) {
  const cleaned = cleanText(name).replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').replace(/^'+|'+$/g, '').trim();
  return cleaned.slice(0, 31).trim();
}

export function deepClone(obj) {
  return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
}
