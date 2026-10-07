// A tiny fake Team Level Stats workbook for tests. Fake names and IDs only.
import ExcelJS from 'exceljs';

export const LABELS = [
  'Alpha Trend', 'Average orders', 'Internal Errors', 'Error Cost $', //  2-5
  'Beta Trend', 'Average orders', 'Error Cost $', //                    6-8
  'Usage %', 'Leave A', 'Leave B', 'Score', //  9-12
];
const FILLS = ['FF999999', 'FF999999', 'FF999999', 'FF999999', 'FF93C47D', 'FF93C47D', 'FF93C47D', 'FFF4B084', null, null, 'FFC6E0B4'];

function fillSheet(ws, a1) {
  ws.getCell('A1').value = a1;
  for (let m = 0; m < 12; m += 1) ws.getCell(1, m + 2).value = new Date(Date.UTC(2026, m, 25));
  LABELS.forEach((label, i) => {
    const cell = ws.getCell(i + 2, 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
    if (FILLS[i]) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILLS[i] } };
  });
  ws.getColumn(1).width = 30;
}

export function makeStatsBook() {
  const wb = new ExcelJS.Workbook();
  fillSheet(wb.addWorksheet('REF'), null);
  const one = wb.addWorksheet('Test User One');
  fillSheet(one, '10000001');
  one.getCell('B7').value = 50;
  one.getCell('B9').value = 0.5;
  one.getCell('C3').value = { formula: 'B7/B9' }; // points below an insert at row 6
  const two = wb.addWorksheet('Test User Two');
  fillSheet(two, '10000002');
  const list = wb.addWorksheet('Sheet1');
  list.getCell('A1').value = 'empID';
  list.getCell('A2').value = { formula: "'Test User One'!B7" };
  return wb;
}

export async function roundTrip(wb) {
  const buf = await wb.xlsx.writeBuffer();
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(buf);
  return out;
}
