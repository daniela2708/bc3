import { describe, expect, it } from 'vitest';
import { LIFT_THRESHOLDS, liftBand, liftLegend } from './thresholds';

describe('lift colour thresholds (Promo Run Trend, illustrative)', () => {
  it('green at or above 30 %, amber from 10 % to under 30 %, red below 10 %', () => {
    expect(LIFT_THRESHOLDS).toEqual({ good: 0.3, watch: 0.1 });
    expect(liftBand(0.3)).toBe('good');
    expect(liftBand(1.25)).toBe('good');
    expect(liftBand(0.2999)).toBe('watch');
    expect(liftBand(0.1)).toBe('watch');
    expect(liftBand(0.0999)).toBe('low');
    expect(liftBand(-0.2)).toBe('low');
  });
  it('no value, no band', () => {
    expect(liftBand(null)).toBeNull();
    expect(liftBand(undefined)).toBeNull();
    expect(liftBand(Number.NaN)).toBeNull();
  });
  it('follows other thresholds when they change, and the legend says them', () => {
    expect(liftBand(0.25, { good: 0.2, watch: 0.05 })).toBe('good');
    expect(liftLegend().map((l) => l.text)).toEqual(['High ≥ 30 %', 'Medium 10 %–30 %', 'Low < 10 %']);
  });
});
