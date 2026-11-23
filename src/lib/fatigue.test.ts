import { describe, expect, it } from 'vitest';
import { EVENTS, EVENTS_BY_PG, type PromoType } from '../data/promos';
import { daysSincePreviousPromo, FATIGUE, FATIGUE_CHIP, FATIGUE_INFO, fatigueCheck, fatigueReasons, liftDrop, previousRun, promosInLast52Weeks } from './fatigue';

// A price group's events: [idx, start, end] (days). Another price group's event must never count.
const ev = (idx: number, start: number, end: number, pg = 1, type: PromoType = 'HB') => ({ idx, pg, type, start, end });
type E = ReturnType<typeof ev>;
const LIST = [ev(0, 0, 6), ev(1, 100, 106), ev(2, 300, 313), ev(3, 340, 346), ev(4, 360, 366), ev(5, 380, 386), ev(9, 370, 376, 2)];
const at = (idx: number) => LIST.find((e) => e.idx === idx)!;
/** Unit Lift % by event index; events not listed have no lift. */
const lifts = (m: Record<number, number>) => (e: E) => m[e.idx] ?? null;
const day = (d: number) => `day ${d}`;

describe('promo fatigue (Promo History, illustrative)', () => {
  it('counts the events of the same price group in the 52 weeks (364 days) before the start', () => {
    expect(promosInLast52Weeks(at(0), LIST)).toBe(0);
    expect(promosInLast52Weeks(at(1), LIST)).toBe(1);
    expect(promosInLast52Weeks(at(4), LIST)).toBe(4);
    // Day 0 is 380 days before event 5: outside the look-back. Event 9 is another price group.
    expect(promosInLast52Weeks(at(5), LIST)).toBe(4);
  });

  it('days since the previous promo ended; null with no earlier promo; 0 when they overlap', () => {
    expect(daysSincePreviousPromo(at(0), LIST)).toBeNull();
    expect(daysSincePreviousPromo(at(1), LIST)).toBe(94);
    expect(daysSincePreviousPromo(at(3), LIST)).toBe(27);
    expect(daysSincePreviousPromo(ev(7, 310, 316), [...LIST, ev(7, 310, 316)])).toBe(0);
  });

  it('keeps the frequency rule: 4 events in 13 weeks or under 28 days since the previous promo', () => {
    expect(FATIGUE).toMatchObject({ windowWeeks: 13, minEvents: 4, minDaysBetween: 28, lookbackWeeks: 52, minUnitLift: 0.1, minLiftDrop: 0.3 });
    const none = lifts({});
    // 94 days gap, 2 events in 13 weeks: not frequent.
    expect(fatigueCheck(at(1), LIST, none).frequent).toBe(false);
    // 27 days since the previous promo: frequent by the gap.
    expect(fatigueCheck(at(3), LIST, none)).toMatchObject({ frequent: true, byGap: true });
    // Exactly 28 days and only 2 events in 13 weeks: not frequent (the gap must be under 28).
    const spaced = [ev(0, 0, 6), ev(1, 34, 40)];
    expect(daysSincePreviousPromo(spaced[1], spaced)).toBe(28);
    expect(fatigueCheck(spaced[1], spaced, none).frequent).toBe(false);
    // The count rule on its own (one-day events, 29 days apart): the 4th event within 13 weeks is frequent.
    const short = [ev(0, 0, 0), ev(1, 29, 29), ev(2, 58, 58), ev(3, 87, 87)];
    expect(fatigueCheck(short[3], short, none)).toMatchObject({ frequent: true, byCount: true, byGap: false, inWindow: 4 });
    // Only 3 within 13 weeks: not frequent.
    expect(fatigueCheck(short[2], short, none).frequent).toBe(false);
  });

  it('frequency alone does not flag', () => {
    // Event 3 is frequent (27-day gap) with a healthy, steady lift.
    const c = fatigueCheck(at(3), LIST, lifts({ 2: 0.5, 3: 0.48 }));
    expect(c.frequent).toBe(true);
    expect(c.weakResponse).toBe(false);
    expect(c.flagged).toBe(false);
  });

  it('a low lift alone does not flag', () => {
    // Event 1 has a 4 % lift but is not promoted often (94-day gap, 2 events in 13 weeks).
    const c = fatigueCheck(at(1), LIST, lifts({ 0: 0.05, 1: 0.04 }));
    expect(c.lowLift).toBe(true);
    expect(c.frequent).toBe(false);
    expect(c.flagged).toBe(false);
  });

  it('frequent and low lift together flag, and the reasons list the rules met with the values', () => {
    const c = fatigueCheck(at(3), LIST, lifts({ 2: 0.08, 3: 0.06 }));
    expect(c).toMatchObject({ frequent: true, lowLift: true, falling: false, flagged: true });
    expect(fatigueReasons(c, day)).toEqual(['Promoted often: 27 days since the previous promo (rule: under 28).', 'Low lift: Unit Lift % 6 % (rule: under 10 %).']);
  });

  it('frequent and falling lift together flag, even with a lift above 10 %', () => {
    const c = fatigueCheck(at(3), LIST, lifts({ 2: 0.5, 3: 0.3 }));
    expect(c.lowLift).toBe(false);
    expect(c.drop).toBeCloseTo(0.4, 10);
    expect(c).toMatchObject({ falling: true, flagged: true, previous: { start: 300, unitLift: 0.5 } });
    expect(fatigueReasons(c, day)).toEqual([
      'Promoted often: 27 days since the previous promo (rule: under 28).',
      'Falling lift: Unit Lift % 30 % vs. 50 % in the previous run (day 300), down 40 % (rule: 30 % or more).',
    ]);
  });

  it('computes the drop vs. the previous run of the same price group and promo type', () => {
    // Previous run = latest earlier event with the same price group AND promo type: a TPR in between is skipped,
    // and so is another price group's Hot Buy.
    const list = [ev(0, 0, 6), ev(1, 20, 26, 1, 'TPR'), ev(2, 30, 36, 2), ev(3, 40, 46)];
    expect(previousRun(list[3], list)?.idx).toBe(0);
    expect(previousRun(list[0], list)).toBeNull();
    expect(previousRun(list[1], list)).toBeNull();
    const c = fatigueCheck(list[3], list, lifts({ 0: 0.6, 1: 0.05, 2: 0.01, 3: 0.4 }));
    expect(c.drop).toBeCloseTo(1 / 3, 10);
    expect(c.falling).toBe(true);
    // (previous − current) / previous; exactly 30 % counts, 29 % does not.
    expect(liftDrop(0.35, 0.5)).toBeCloseTo(0.3, 10);
    expect(liftDrop(0.355, 0.5)).toBeCloseTo(0.29, 10);
    expect(fatigueCheck(ev(5, 40, 46), [ev(4, 0, 6), ev(5, 40, 46)], lifts({ 4: 0.5, 5: 0.35 })).falling).toBe(true);
    expect(fatigueCheck(ev(5, 40, 46), [ev(4, 0, 6), ev(5, 40, 46)], lifts({ 4: 0.5, 5: 0.355 })).falling).toBe(false);
    // A rising lift is a negative drop, never falling.
    expect(liftDrop(0.6, 0.4)).toBeCloseTo(-0.5, 10);
  });

  it('fails safely: no previous run, a missing lift or a previous lift at or below 0 give no drop', () => {
    expect(liftDrop(0.2, null)).toBeNull();
    expect(liftDrop(null, 0.5)).toBeNull();
    expect(liftDrop(0.2, 0)).toBeNull();
    expect(liftDrop(-0.1, -0.2)).toBeNull();
    expect(liftDrop(Number.NaN, 0.5)).toBeNull();
    expect(liftDrop(0.2, Number.POSITIVE_INFINITY)).toBeNull();
    // Frequent but no lift at all: not flagged.
    const c = fatigueCheck(at(3), LIST, lifts({}));
    expect(c).toMatchObject({ frequent: true, unitLift: null, drop: null, lowLift: false, falling: false, flagged: false });
    expect(fatigueReasons(c, day)).toEqual(['Promoted often: 27 days since the previous promo (rule: under 28).']);
  });

  it('chip and (i) texts', () => {
    expect(FATIGUE_CHIP).toBe('Definition pending · thresholds to align with Cognira promo fatigue and intensity');
    expect(FATIGUE_INFO).toBe(
      'Illustrative: flags items promoted often whose lift is low or falling. Cognira has promo fatigue and intensity calculations; thresholds to be aligned. Not part of the Hot Buy Score.',
    );
  });

  it('works on the generated events: counts are whole numbers ≥ 0 and the first event of a price group has no previous promo', () => {
    const firsts = new Set<number>();
    const pgList = (pg: number) => EVENTS_BY_PG[pg].map((i) => EVENTS[i]);
    for (const e of EVENTS) {
      const n = promosInLast52Weeks(e, pgList(e.pg));
      expect(Number.isInteger(n) && n >= 0).toBe(true);
      if (!firsts.has(e.pg)) {
        firsts.add(e.pg);
        expect(daysSincePreviousPromo(e, pgList(e.pg))).toBeNull();
        expect(previousRun(e, pgList(e.pg))).toBeNull();
      }
    }
  });
});
