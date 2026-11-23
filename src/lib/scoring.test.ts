import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE } from './filters';
import { getScope } from './selectors';
import { averageScore, hotBuyScores, resultsOf } from './hotBuyScore';
import { directionalPoints, salesPoints, SCORE_METRICS, scoreEvent, unitPoints, verdictCountText, verdictOf, type ScoreInput } from './scoring';

const D = 0.3;
const F = D / (1 - D); // 0.4286
const M = 2 * D; // 0.6
const POSITIVE = { basketLift: 0.1, catSalesLift: 0.05, catTripLift: 0.08, newToCat: 0.2, catUnitsLift: 0.04 };
const input = (v: Partial<ScoreInput>): ScoreInput => ({ salesLift: F, unitLift: M, ...POSITIVE, depth: D, ...v });

describe('Hot Buy Score: Weis Hot Buy Scoring Framework', () => {
  it('has the seven metrics and both weight sets add up to 100 %', () => {
    expect(SCORE_METRICS.map((m) => m.label)).toEqual(['Sales Lift', 'Unit Lift', 'Basket Lift', 'Cat. Sales Lift', 'Cat. Trip Lift', 'New-to-Category', 'Cat. Units']);
    expect(SCORE_METRICS.map((m) => m.weights.current)).toEqual([35, 25, 15, 5, 8, 7, 5]);
    expect(SCORE_METRICS.map((m) => m.weights.proposed)).toEqual([46.5, 31, 10, 2.5, 4, 3.5, 2.5]);
    expect(SCORE_METRICS.reduce((s, m) => s + m.weights.current, 0)).toBeCloseTo(100, 10);
    expect(SCORE_METRICS.reduce((s, m) => s + m.weights.proposed, 0)).toBeCloseTo(100, 10);
  });

  it('Sales Lift is scaled to the discount: d = 30 % gives the floor F = 0.4286', () => {
    expect(F).toBeCloseTo(0.4286, 4);
    expect(salesPoints(F, D)).toBeCloseTo(60, 10); // at the floor
    expect(salesPoints(1.5 * F, D)).toBeCloseTo(80, 10); // halfway to double
    expect(salesPoints(2 * F, D)).toBe(100); // at double
    expect(salesPoints(5, D)).toBe(100);
    expect(salesPoints(0.5 * F, D)).toBeCloseTo(30, 10); // below the floor
    expect(salesPoints(0, D)).toBe(0);
    expect(salesPoints(-0.2, D)).toBe(0); // never below 0
  });

  it('Unit Lift is scaled to the discount: d = 30 % gives the minimum M = 0.6', () => {
    expect(M).toBeCloseTo(0.6, 10);
    expect(unitPoints(M, D)).toBeCloseTo(60, 10); // at the minimum
    expect(unitPoints(2 * M, D)).toBeCloseTo(80, 10); // at double
    expect(unitPoints(3 * M, D)).toBe(100); // at triple
    expect(unitPoints(0.5 * M, D)).toBeCloseTo(30, 10); // below the minimum
    expect(unitPoints(-1, D)).toBe(0);
  });

  it('the other five metrics are directional: positive 100, zero or negative 0', () => {
    expect(directionalPoints(0.001)).toBe(100);
    expect(directionalPoints(0)).toBe(0);
    expect(directionalPoints(-0.05)).toBe(0);
    expect(directionalPoints(null)).toBe(0);
    expect(directionalPoints(Number.NaN)).toBe(0);
    const r = scoreEvent(input({ basketLift: 0, catSalesLift: -0.1 }));
    expect(r.parts.find((p) => p.id === 'basketLift')!.points).toBe(0);
    expect(r.parts.find((p) => p.id === 'catSalesLift')!.points).toBe(0);
    expect(r.parts.find((p) => p.id === 'catTripLift')!.points).toBe(100);
  });

  it('total = sum of points × weight, rounded; the two weight sets give different scores', () => {
    // Sales and Unit Lift at the floor (60 points each), every directional metric positive.
    const cur = scoreEvent(input({}), 'current');
    expect(cur.raw).toBeCloseTo(60 * 0.35 + 60 * 0.25 + 15 + 5 + 8 + 7 + 5, 10); // 76
    expect(cur.score).toBe(76);
    expect(cur.verdict.label).toBe('REFINE TACTIC');
    const prop = scoreEvent(input({}), 'proposed');
    expect(prop.raw).toBeCloseTo(60 * 0.465 + 60 * 0.31 + 10 + 2.5 + 4 + 3.5 + 2.5, 10); // 69
    expect(prop.score).toBe(69);
    expect(prop.verdict.label).toBe('RECONSIDER SLOT');
    for (const r of [cur, prop]) expect(r.parts.reduce((s, p) => s + p.contribution, 0)).toBeCloseTo(r.raw, 10);
    const best = scoreEvent(input({ salesLift: 2 * F, unitLift: 3 * M }));
    expect(best.score).toBe(100);
    expect(best.verdict.label).toBe('RE-EXECUTE');
  });

  it('verdict limits: 85 re-execute, 84 and 70 refine, 69 reconsider', () => {
    expect(verdictOf(100).label).toBe('RE-EXECUTE');
    expect(verdictOf(85).label).toBe('RE-EXECUTE');
    expect(verdictOf(84).label).toBe('REFINE TACTIC');
    expect(verdictOf(70).label).toBe('REFINE TACTIC');
    expect(verdictOf(69).label).toBe('RECONSIDER SLOT');
    expect(verdictOf(0).label).toBe('RECONSIDER SLOT');
    // The verdict follows the rounded score: 84.5 rounds to 85.
    const r = scoreEvent(input({ salesLift: F + (F * 8.5) / (40 * 0.35) }));
    expect(r.raw).toBeCloseTo(84.5, 10);
    expect(r.score).toBe(85);
    expect(r.verdict.id).toBe('reexecute');
  });

  it('fails safely: d = 0, no discount or missing values never throw and score 0 for the scaled metrics', () => {
    for (const depth of [0, null, 1, -0.1, Number.NaN]) {
      const r = scoreEvent(input({ depth }));
      expect(r.parts[0].points).toBe(0);
      expect(r.parts[1].points).toBe(0);
      expect(r.parts[0].note).toMatch(/No discount/);
      expect(r.score).toBe(40); // only the five directional metrics
      expect(Number.isFinite(r.raw)).toBe(true);
    }
    const none = scoreEvent({ salesLift: null, unitLift: null, basketLift: null, catSalesLift: null, catTripLift: null, newToCat: null, catUnitsLift: null, depth: D });
    expect(none.score).toBe(0);
    expect(none.parts.every((p) => p.points === 0 && p.note === 'No data: 0 points.')).toBe(true);
    expect(salesPoints(Number.POSITIVE_INFINITY, D)).toBe(0);
  });

  it('counts events per verdict', () => {
    const rs = [scoreEvent(input({ salesLift: 2 * F, unitLift: 3 * M })), scoreEvent(input({})), scoreEvent(input({ depth: 0 }))];
    expect(verdictCountText(rs)).toBe('1 Re-execute · 1 Refine · 1 Reconsider');
  });

  it('scores the Hot Buys of the default selection: whole numbers 0–100, other promo types skipped', () => {
    const scope = getScope({ ...DEFAULT_STATE, tab: 'hotbuy' });
    const scores = hotBuyScores(scope.events, scope.ctx);
    expect(scores.size).toBe(scope.events.length);
    for (const s of scores.values()) {
      expect(Number.isInteger(s.score) && s.score >= 0 && s.score <= 100).toBe(true);
      expect(s.verdict).toEqual(verdictOf(s.score));
      expect(s.parts).toHaveLength(7);
      expect(s.netIncGm).not.toBeUndefined();
    }
    const avg = averageScore(scores);
    expect(avg).not.toBeNull();
    expect(resultsOf(scores)).toHaveLength(scores.size);
    const other = getScope({ ...DEFAULT_STATE, tab: 'other' });
    expect(hotBuyScores(other.events, other.ctx).size).toBe(0);
  });

  it('uses the fixed 4-week pre-period: the Baseline window setting does not change the score; the weight set does', () => {
    const scope = getScope({ ...DEFAULT_STATE, tab: 'hotbuy' });
    const base = hotBuyScores(scope.events, scope.ctx);
    for (const bw of [2, 13, 52] as const) {
      const other = hotBuyScores(scope.events, { ...scope.ctx, baselineWeeks: bw });
      for (const [e, s] of base) expect(other.get(e)!.score).toBe(s.score);
    }
    const gross = hotBuyScores(scope.events, scope.ctx, 'current', 'gross');
    for (const [e, s] of base) expect(gross.get(e)!.score).toBe(s.score);
    const proposed = hotBuyScores(scope.events, scope.ctx, 'proposed');
    expect([...base].some(([e, s]) => proposed.get(e)!.raw !== s.raw)).toBe(true);
  });
});
