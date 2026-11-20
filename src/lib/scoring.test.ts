import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE } from './filters';
import { getScope } from './selectors';
import { averageScore, hotBuyScores } from './hotBuyScore';
import { percentileRanks, SCORE_CRITERIA, scoreEvents, type ScoreInput } from './scoring';

const input = (v: Partial<ScoreInput>): ScoreInput => ({ unitLift: 0.5, netIncGm: 1000, catImpact: 500, cannRate: 0.2, newToCat: 0.1, ...v });

describe('Hot Buy Score (illustrative)', () => {
  it('weights add up to 100 % and every criterion has a description', () => {
    expect(SCORE_CRITERIA.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(SCORE_CRITERIA.map((c) => [c.id, c.weight])).toEqual([
      ['unitLift', 25],
      ['netIncGm', 30],
      ['catImpact', 20],
      ['cannRate', 15],
      ['newToCat', 10],
    ]);
    for (const c of SCORE_CRITERIA) expect(c.description.length).toBeGreaterThan(10);
  });

  it('percentile ranks: worst 0, best 1, ties share the midrank, nulls stay null', () => {
    expect(percentileRanks([10, 30, 20])).toEqual([0, 1, 0.5]);
    expect(percentileRanks([5, 5, 9])).toEqual([0.25, 0.25, 1]);
    expect(percentileRanks([3, null, 7])).toEqual([0, null, 1]);
    expect(percentileRanks([4])).toEqual([null]);
  });

  it('scores stay between 0 and 100: the best event on every criterion gets 100, the worst 0', () => {
    const best = input({ unitLift: 2, netIncGm: 9000, catImpact: 4000, cannRate: 0, newToCat: 0.3 });
    const worst = input({ unitLift: 0, netIncGm: -9000, catImpact: -4000, cannRate: 0.9, newToCat: 0 });
    const [b, w, m] = scoreEvents([best, worst, input({})]);
    expect(b.score).toBeCloseTo(100);
    expect(w.score).toBeCloseTo(0);
    expect(m.score).toBeGreaterThan(0);
    expect(m.score).toBeLessThan(100);
  });

  it('lower Cannibalization Rate % scores more points', () => {
    const [low, high] = scoreEvents([input({ cannRate: 0.1 }), input({ cannRate: 0.6 })]);
    expect(low.parts.find((p) => p.id === 'cannRate')!.points).toBe(15);
    expect(high.parts.find((p) => p.id === 'cannRate')!.points).toBe(0);
  });

  it('a missing value or a single event gets half the weight (neutral), never NaN', () => {
    const [one] = scoreEvents([input({})]);
    expect(one.score).toBe(50);
    const [, gap] = scoreEvents([input({}), input({ cannRate: null })]);
    expect(gap.parts.find((p) => p.id === 'cannRate')!.points).toBe(7.5);
    expect(Number.isFinite(gap.score)).toBe(true);
  });

  it('the breakdown is consistent: points = rank × weight and they add up to the score', () => {
    const results = scoreEvents([input({}), input({ unitLift: 1.2, netIncGm: -50 }), input({ catImpact: -300, newToCat: 0.4 }), input({ cannRate: 0.05 })]);
    for (const r of results) {
      expect(r.parts.map((p) => p.id)).toEqual(SCORE_CRITERIA.map((c) => c.id));
      for (const p of r.parts) {
        expect(p.points).toBeCloseTo(p.rank * p.weight);
        expect(p.points).toBeGreaterThanOrEqual(0);
        expect(p.points).toBeLessThanOrEqual(p.weight);
      }
      expect(r.parts.reduce((s, p) => s + p.points, 0)).toBeCloseTo(r.score);
    }
  });

  it('scores the Hot Buys of the default selection between 0 and 100 and skips other promo types', () => {
    const scope = getScope({ ...DEFAULT_STATE, tab: 'hotbuy' });
    const scores = hotBuyScores(scope.events, scope.ctx, 'net');
    expect(scores.size).toBe(scope.events.length);
    for (const s of scores.values()) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
    const avg = averageScore(scores);
    expect(avg).not.toBeNull();
    expect(avg!).toBeGreaterThan(0);
    expect(avg!).toBeLessThan(100);
    const other = getScope({ ...DEFAULT_STATE, tab: 'other' });
    expect(hotBuyScores(other.events, other.ctx, 'net').size).toBe(0);
  });
});
