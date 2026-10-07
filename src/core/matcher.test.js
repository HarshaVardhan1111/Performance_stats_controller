import { describe, it, expect } from 'vitest';
import { similarity, suggestTarget } from './matcher.js';

describe('matcher', () => {
  it('matches acronyms and shared words', () => {
    expect(similarity('AB', 'Alpha Beta Orders')).toBeGreaterThanOrEqual(0.8);
    expect(similarity('North Item copy QC', 'North Item Copy Trend')).toBeGreaterThanOrEqual(0.5);
    expect(similarity('Snapshot', 'Snapshot Placement Trend')).toBeGreaterThanOrEqual(0.5);
    expect(similarity('Foo', 'Bar Baz')).toBe(0);
  });
  it('returns null when nothing is close', () => {
    expect(suggestTarget('Unknown', [{ key: 'a', label: 'Alpha Trend' }])).toBeNull();
  });
});
