// ExcelJS rebuilds the whole .xlsx from its own model, and that model loses two
// things Excel cares about (Excel then shows a "Removed Records" repair prompt):
//   - xl/tables/*.xml: header/totals flags are flipped and fake filter buttons added
//   - the <dxfs> block in xl/styles.xml: emptied, but tables point into it by index
// So after ExcelJS writes, we copy those parts back from the original file.
// A table is only restored when its range is unchanged, so it still fits its data.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const DXFS = /<dxfs count="\d+">[\s\S]*?<\/dxfs>|<dxfs count="0"\s*\/>/;
const EMPTY_DXFS = /<dxfs count="0"\s*\/>/;

const bytesOf = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data));
const attr = (xml, name) => xml.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

export function readPreservedParts(originalData) {
  const files = unzipSync(bytesOf(originalData));
  const tables = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith('xl/tables/') && path.endsWith('.xml')) {
      const xml = strFromU8(bytes);
      tables[attr(xml, 'name') ?? path] = { xml, ref: attr(xml, 'ref') };
    }
  }
  const dxfs = files['xl/styles.xml'] ? strFromU8(files['xl/styles.xml']).match(DXFS)?.[0] ?? null : null;
  return { tables, dxfs };
}

export function restoreParts(outputData, preserved) {
  const files = unzipSync(bytesOf(outputData));
  const restored = [];

  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith('xl/tables/') || !path.endsWith('.xml')) continue;
    const xml = strFromU8(bytes);
    const original = preserved.tables[attr(xml, 'name') ?? path];
    if (original && original.ref === attr(xml, 'ref')) {
      files[path] = strToU8(original.xml);
      restored.push(path);
    }
  }

  // Only refill dxfs if ExcelJS emptied them; if it wrote its own, indices differ.
  const styles = files['xl/styles.xml'] && strFromU8(files['xl/styles.xml']);
  if (preserved.dxfs && styles && EMPTY_DXFS.test(styles) && !EMPTY_DXFS.test(preserved.dxfs)) {
    files['xl/styles.xml'] = strToU8(styles.replace(EMPTY_DXFS, preserved.dxfs));
    restored.push('xl/styles.xml');
  }

  return { bytes: restored.length ? zipSync(files, { level: 6 }) : bytesOf(outputData), restored };
}
