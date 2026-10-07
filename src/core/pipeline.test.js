import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { makeStatsBook, roundTrip } from './__fixtures__/statsBook.js';
import { analyzeStats, applyChanges } from './pipeline.js';
import { parseEmployeeList, validateNewEmployee } from './employees.js';
import { analyzePerformance } from './monthlyFill.js';
import { suggestTarget } from './matcher.js';

const colA = (ws, from, to) => Array.from({ length: to - from + 1 }, (_, i) => ws.getCell(from + i, 1).value);

describe('analyzeStats', () => {
  it('finds template, process blocks, other rows and employees from the file only', () => {
    const a = analyzeStats(makeStatsBook());
    expect(a.ok).toBe(true);
    expect(a.layout.groups.map((g) => [g.kind, g.title, g.startRow, g.endRow])).toEqual([
      ['process', 'Alpha Trend', 2, 5],
      ['process', 'Beta Trend', 6, 8],
      ['other', 'Usage %', 9, 9],
      ['other', 'Leave A', 10, 11],
      ['other', 'Score', 12, 12],
    ]);
    expect(a.employees).toEqual([
      { id: '10000001', sheetName: 'Test User One' },
      { id: '10000002', sheetName: 'Test User Two' },
    ]);
    expect(a.otherSheets).toEqual(['Sheet1']);
    expect(a.months[3]).toBe(4);
  });

  it('rejects a workbook without REF', () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data');
    expect(analyzeStats(wb).ok).toBe(false);
  });
});

describe('insert rows anywhere, any number', () => {
  it('inserts in REF and every employee sheet, shifts formulas everywhere', async () => {
    const wb = makeStatsBook();
    const labels = ['Gamma Count', 'Average', 'Team Average', 'Internal Errors', 'Internal Quality %',
      'External Errors', 'External Quality %', 'Clarification', 'Oversight', 'Oversight %', 'Error Cost $', 'Extra', 'More'];
    const summary = applyChanges(wb, { inserts: [{ at: 6, labels, color: '#ABCDEF' }] });
    expect(summary.rowsAdded).toBe(13);

    const out = await roundTrip(wb);
    for (const name of ['REF', 'Test User One', 'Test User Two']) {
      const ws = out.getWorksheet(name);
      expect(colA(ws, 5, 7)).toEqual(['Error Cost $', 'Gamma Count', 'Average']);
      expect(ws.getCell(19, 1).value).toBe('Beta Trend');
      expect(ws.getCell(6, 1).fill.fgColor.argb).toBe('FFABCDEF');
      expect(ws.getCell(6, 1).font.bold).toBe(true);
    }
    const one = out.getWorksheet('Test User One');
    expect(one.getCell('B20').value).toBe(50);
    expect(one.getCell('C3').value.formula).toBe('B20/B22');
    expect(out.getWorksheet('Sheet1').getCell('A2').value.formula).toBe("'Test User One'!B20");
    expect(out.getWorksheet('Test User One').getCell('A1').value).toBe('10000001');
  });

  it('keeps the order of two blocks added at the same place', async () => {
    const wb = makeStatsBook();
    applyChanges(wb, {
      inserts: [
        { at: 9, labels: ['First'], color: '#FFFFFF' },
        { at: 9, labels: ['Second'], color: '#FFFFFF' },
        { at: 2, labels: ['Top'], color: '#FFFFFF' },
      ],
    });
    const ref = (await roundTrip(wb)).getWorksheet('REF');
    expect(ref.getCell(2, 1).value).toBe('Top');
    expect(colA(ref, 10, 12)).toEqual(['First', 'Second', 'Usage %']);
  });

  it('skips sheets whose rows do not match REF', () => {
    const wb = makeStatsBook();
    wb.getWorksheet('Test User Two').getCell('A4').value = 'Something else';
    const logs = [];
    const s = applyChanges(wb, { inserts: [{ at: 6, labels: ['New'], color: '#FFFFFF' }] }, { log: (m) => logs.push(m) });
    expect(s.sheetsSkipped).toEqual(['Test User Two']);
    expect(wb.getWorksheet('Test User Two').getCell(6, 1).value).toBe('Beta Trend');
    expect(logs.join(' ')).toMatch(/Test User Two/);
  });
});

describe('new employees', () => {
  it('copies REF (with inserted rows) and places the sheet after the last employee', async () => {
    const wb = makeStatsBook();
    const s = applyChanges(wb, {
      inserts: [{ at: 9, labels: ['New Row'], color: '#FFFFFF' }],
      employees: [{ id: '10000003', name: 'Test User  Three' }, { id: '10000001', name: 'Dup' }],
    });
    expect(s.sheetsCreated).toEqual([{ id: '10000003', name: 'Test User Three', sheetName: 'Test User Three' }]);
    expect(s.employeesSkipped[0].reason).toMatch(/already has sheet/);
    const out = await roundTrip(wb);
    expect(out.worksheets.map((w) => w.name)).toEqual(['REF', 'Test User One', 'Test User Two', 'Test User Three', 'Sheet1']);
    const ws = out.getWorksheet('Test User Three');
    expect(ws.getCell('A1').value).toBe('10000003');
    expect(ws.getCell(9, 1).value).toBe('New Row');
    expect(ws.getCell(2, 1).font.bold).toBe(true);
    expect(ws.getColumn(1).width).toBe(30);
  });

  it('validates manual entries', () => {
    const existing = [{ id: '10000001', sheetName: 'Test User One' }];
    expect(validateNewEmployee({ id: 'abc', name: 'X' }, { existing })).toMatch(/digits/);
    expect(validateNewEmployee({ id: '10000001', name: 'X' }, { existing })).toMatch(/Test User One/);
    expect(validateNewEmployee({ id: '10000009', name: '' }, { existing })).toMatch(/Name/);
    expect(validateNewEmployee({ id: '10000009', name: 'Ok' }, { existing })).toBeNull();
  });

  it('reads an employee list with headers or plain columns', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRows([['Emp ID', 'Name'], [10000005, 'Five'], [10000005, 'Five again'], ['', 'blank'], [10000006, 'Six']]);
    expect(parseEmployeeList(wb).employees).toEqual([{ id: '10000005', name: 'Five' }, { id: '10000006', name: 'Six' }]);

    const plain = new ExcelJS.Workbook();
    plain.addWorksheet('x').addRows([[10000007, 'Seven']]);
    expect(parseEmployeeList(plain).employees).toEqual([{ id: '10000007', name: 'Seven' }]);
  });
});

describe('monthly fill', () => {
  function makePerfBook() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Beta QC');
    ws.addRows([
      ['Emp ID', 'Name', 'Count', 'Avg', 'Cost', 'Extra'],
      ['10000002', 'Test User Two', 12, 3.5, 7, 99],
      ['10000099', 'Not In Stats', 1, 1, 1, 1],
    ]);
    ws.getCell('C2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    const uti = wb.addWorksheet('Usage');
    uti.addRows([['Emp ID', 'Name', 'Usage'], ['10000001', 'Test User One', 0.8]]);
    return wb;
  }

  it('fills the chosen month by label, capped at the block size', async () => {
    const wb = makeStatsBook();
    const perf = makePerfBook();
    const perfInfo = analyzePerformance(perf);
    expect(perfInfo.sheets.map((s) => [s.name, s.headers.length])).toEqual([['Beta QC', 4], ['Usage', 1]]);

    const a = analyzeStats(wb);
    const beta = a.targets.find((t) => t.label === 'Beta Trend');
    const uti = a.targets.find((t) => t.label === 'Usage %');
    expect(suggestTarget('Beta QC', a.targets).key).toBe(beta.key);

    const s = applyChanges(
      wb,
      {
        inserts: [{ at: 2, labels: ['Shift everything'], color: '#FFFFFF' }],
        fill: { month: 8, mappings: { 'Beta QC': { key: beta.key }, Usage: { key: uti.key } } },
      },
      { perfWorkbook: perf, perfInfo },
    );
    expect(s.missing).toEqual([{ id: '10000099', name: 'Not In Stats' }]);
    const out = await roundTrip(wb);
    const two = out.getWorksheet('Test User Two');
    // Beta Trend moved from row 6 to 7; August is column I; block has 3 rows.
    expect([two.getCell('I7').value, two.getCell('I8').value, two.getCell('I9').value]).toEqual([12, 3.5, 7]);
    expect(two.getCell('I10').value).toBeNull(); // not past the block
    expect(two.getCell('I7').fill.fgColor.argb).toBe('FFFF0000');
    expect(out.getWorksheet('Test User One').getCell('I10').value).toBe(0.8);
  });

  it('still finds a block when new rows without "Error Cost" are inserted right above it', async () => {
    const wb = makeStatsBook();
    const perf = makePerfBook();
    const perfInfo = analyzePerformance(perf);
    const beta = analyzeStats(wb).targets.find((t) => t.label === 'Beta Trend');
    const s = applyChanges(
      wb,
      { inserts: [{ at: 6, labels: ['Loose row'], color: '#FFFFFF' }], fill: { month: 1, mappings: { 'Beta QC': { key: beta.key } } } },
      { perfWorkbook: perf, perfInfo },
    );
    expect(s.cellsFilled).toBe(3);
    const two = (await roundTrip(wb)).getWorksheet('Test User Two');
    expect([two.getCell('B7').value, two.getCell('B8').value, two.getCell('B9').value]).toEqual([12, 3.5, 7]);
  });
});
