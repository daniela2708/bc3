import { describe, expect, it } from 'vitest';
import { moneyAxis, niceTicks, volumeAxis } from './format';

describe('chart axes', () => {
  it('round ticks from zero: steps of 1, 2, 2.5 or 5 × 10^k', () => {
    expect(niceTicks(0, 128_000)).toEqual([0, 50_000, 100_000, 150_000]);
    expect(niceTicks(0, 1_310_000)).toEqual([0, 500_000, 1_000_000, 1_500_000]);
    expect(niceTicks(-300, 900)).toEqual([-500, 0, 500, 1000]);
    expect(niceTicks(0, 0)).toEqual([0, 1]);
  });
  it('axis labels have no leftover ".0"', () => {
    expect(moneyAxis(260_000)).toBe('$260K');
    expect(moneyAxis(1_500_000)).toBe('$1.5M');
    expect(moneyAxis(20_000_000)).toBe('$20M');
    expect(moneyAxis(-50_000)).toBe('−$50K');
    expect(moneyAxis(950)).toBe('$950');
    expect(volumeAxis(12_000, 'lb')).toBe('12K lb');
    expect(volumeAxis(3_600, 'ea')).toBe('3,600 ea');
  });
});
