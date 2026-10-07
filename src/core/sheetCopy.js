// Copies the template sheet into a new sheet: values, styles, sizes, merges, view.

import { deepClone } from './text.js';

export function copyWorksheet(src, dest) {
  src.columns?.forEach((col, i) => {
    const d = dest.getColumn(i + 1);
    if (col.width) d.width = col.width;
    if (col.hidden) d.hidden = true;
    if (col.style && Object.keys(col.style).length) d.style = deepClone(col.style);
  });

  src.eachRow({ includeEmpty: true }, (srcRow, r) => {
    const destRow = dest.getRow(r);
    if (srcRow.height) destRow.height = srcRow.height;
    if (srcRow.hidden) destRow.hidden = true;
    srcRow.eachCell({ includeEmpty: true }, (srcCell, c) => {
      const destCell = destRow.getCell(c);
      const v = srcCell.value;
      destCell.value = v && typeof v === 'object' && !(v instanceof Date) ? deepClone(v) : v;
      destCell.style = deepClone(srcCell.style) ?? {};
    });
  });

  for (const range of Object.keys(src._merges ?? {})) {
    try {
      dest.mergeCells(src._merges[range].range ?? range);
    } catch {
      /* overlapping merge - skip */
    }
  }

  if (src.views?.length) dest.views = deepClone(src.views);
  if (src.properties) Object.assign(dest.properties, deepClone(src.properties));
  if (src.pageSetup) Object.assign(dest.pageSetup, deepClone(src.pageSetup));
}
