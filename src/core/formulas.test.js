import { describe, it, expect } from 'vitest';
import { shiftFormulaRows } from './formulas.js';

const affected = new Set(['emp a', 'ref']);
const shift = (f, own = 'Emp A') => shiftFormulaRows(f, { at: 10, count: 3, ownSheet: own, affected });

describe('shiftFormulaRows', () => {
  it('moves refs at or below the insert row', () => {
    expect(shift('M20/C20')).toBe('M23/C23');
    expect(shift('A10+A9')).toBe('A13+A9');
  });
  it('keeps $ markers and shifts absolute rows too', () => {
    expect(shift('$B$12*B$2')).toBe('$B$15*B$2');
  });
  it('grows ranges that span the insert', () => {
    expect(shift('SUM(B5:B15)')).toBe('SUM(B5:B18)');
  });
  it('respects sheet names, quoted and unquoted', () => {
    expect(shift("'Emp A'!B12+Other!B12")).toBe("'Emp A'!B15+Other!B12");
    expect(shift('REF!B11:C12')).toBe('REF!B14:C15');
    expect(shift('B12', 'Other')).toBe('B12');
  });
  it('uses the first sheet for the second half of a range', () => {
    expect(shift('SUM(Other!A11:A12)')).toBe('SUM(Other!A11:A12)');
  });
  it('ignores function names, strings and numbers', () => {
    expect(shift('LOG10(B12)&"A12"')).toBe('LOG10(B15)&"A12"');
    expect(shift('1E10+B12')).toBe('1E10+B15');
  });
});
