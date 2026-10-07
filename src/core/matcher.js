// Suggests which block a performance-file sheet belongs to, by name similarity.
// No names are stored in code; suggestions come only from the two files.

import { normKey } from './text.js';

const STOP = new Set(['trend', 'ticket', 'tickets', 'count', 'processed', 'orders', 'order', 'the', 'of', 'and', '&', '-']);

function words(text) {
  return normKey(text).replace(/[^a-z0-9 +]/g, ' ').split(/\s+/).filter(Boolean);
}

/** 0..1 similarity between a sheet name and a block title. */
export function similarity(sheetName, title) {
  const a = words(sheetName);
  const b = words(title);
  if (!a.length || !b.length) return 0;
  if (a.join(' ') === b.join(' ')) return 1;

  // Acronym: "AB" -> "Alpha Beta Orders", "XYZ" -> "XYZ Trend"
  const compact = a.join('');
  const initials = b.map((w) => w[0]).join('');
  if (a.length === 1 && compact.length >= 2 && (initials.startsWith(compact) || b[0] === compact)) return 0.8;

  const sa = new Set(a.filter((w) => !STOP.has(w)));
  const sb = new Set(b.filter((w) => !STOP.has(w)));
  if (!sa.size || !sb.size) return 0;
  let common = 0;
  for (const w of sa) if (sb.has(w)) common += 1;
  return common / Math.max(sa.size, sb.size);
}

/** Best target for a sheet name, or null if nothing is close enough. */
export function suggestTarget(sheetName, targets, minScore = 0.5) {
  let best = null;
  for (const t of targets) {
    if (t.kind === 'row') continue; // only suggest block starts and standalone rows
    const score = similarity(sheetName, t.label);
    if (score >= minScore && (!best || score > best.score)) best = { key: t.key, score };
  }
  return best;
}
