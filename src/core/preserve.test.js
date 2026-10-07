import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { readPreservedParts, restoreParts } from './preserve.js';

const table = (ref, extra) => strToU8(`<table name="Mail" ref="${ref}" ${extra}></table>`);
const styles = (dxfs) => strToU8(`<styleSheet><cellXfs/>${dxfs}<tableStyles/></styleSheet>`);

const original = zipSync({
  'xl/tables/table1.xml': table('A1:B9', 'totalsRowShown="0" headerRowDxfId="1"'),
  'xl/styles.xml': styles('<dxfs count="2"><dxf/><dxf/></dxfs>'),
});

describe('restoreParts', () => {
  it('puts back tables and table formats that ExcelJS breaks', () => {
    const broken = zipSync({
      'xl/tables/table1.xml': table('A1:B9', 'totalsRowShown="1" headerRowCount="0"'),
      'xl/styles.xml': styles('<dxfs count="0"/>'),
    });
    const { bytes, restored } = restoreParts(broken, readPreservedParts(original));
    const files = unzipSync(bytes);
    expect(strFromU8(files['xl/tables/table1.xml'])).toContain('headerRowDxfId="1"');
    expect(strFromU8(files['xl/styles.xml'])).toContain('<dxfs count="2"><dxf/><dxf/></dxfs>');
    expect(restored).toEqual(['xl/tables/table1.xml', 'xl/styles.xml']);
  });

  it('leaves a table alone when its range changed', () => {
    const moved = zipSync({
      'xl/tables/table1.xml': table('A1:B12', 'totalsRowShown="1"'),
      'xl/styles.xml': styles('<dxfs count="0"/>'),
    });
    const { bytes } = restoreParts(moved, readPreservedParts(original));
    expect(strFromU8(unzipSync(bytes)['xl/tables/table1.xml'])).toContain('A1:B12');
  });
});
