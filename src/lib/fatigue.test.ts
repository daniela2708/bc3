import { describe, expect, it } from 'vitest';
import { EVENTS, EVENTS_BY_PG, type PromoType } from '../data/promos';
import {
  belowFloor,
  daysSincePreviousPromo,
  DEPTH_FLOOR,
  EFFICIENCY,
  efficiency,
  efficiencyBand,
  FATIGUE,
  FATIGUE_INFO,
  fatigueCheck,
  fatigueReasons,
  floorText,
  promosInLast52Weeks,
} from './fatigue';

// A price group's events: [idx, start, end] (days). Another price group's event must never count.
const ev = (idx: number, start: number, end: number, pg = 1, type: PromoType = 'HB', depth = 0.3) => ({ idx, pg, type, start, end, depth });
type E = ReturnType<typeof ev>;
const LIST = [ev(0, 0, 6), ev(1, 100, 106), ev(2, 300, 313), ev(3, 340, 346), ev(4, 360, 366), ev(5, 380, 386), ev(9, 370, 376, 2)];
const at = (idx: number) => LIST.find((e) => e.idx === idx)!;
/** Every event gets the same Unit Lift %. */
const lift = (v: number | null): ((e: E) => number | null) => () => v;

describe('promo hygiene (Promo History): frequency, efficiency and discount floor', () => {
  it('counts the events of the same price group in the 52 weeks (364 days) before the start', () => {
    expect(promosInLast52Weeks(at(0), LIST)).toBe(0);
    expect(promosInLast52Weeks(at(1), LIST)).toBe(1);
    expect(promosInLast52Weeks(at(4), LIST)).toBe(4);
    expect(promosInLast52Weeks(at(5), LIST)).toBe(4);
  });

  it('days since the previous promo ended; null with no earlier promo; 0 when they overlap', () => {
    expect(daysSincePreviousPromo(at(0), LIST)).toBeNull();
    expect(daysSincePreviousPromo(at(1), LIST)).toBe(94);
    expect(daysSincePreviousPromo(at(3), LIST)).toBe(27);
    expect(daysSincePreviousPromo(ev(7, 310, 316), [...LIST, ev(7, 310, 316)])).toBe(0);
  });

  it('keeps the frequency rule (check C): 4 events in 13 weeks or under 28 days since the previous promo', () => {
    expect(FATIGUE).toEqual({ lookbackWeeks: 52, windowWeeks: 13, minEvents: 4, minDaysBetween: 28 });
    const any = lift(0.5);
    expect(fatigueCheck(at(1), LIST, any).frequent).toBe(false);
    expect(fatigueCheck(at(3), LIST, any)).toMatchObject({ frequent: true, byGap: true });
    const spaced = [ev(0, 0, 6), ev(1, 34, 40)];
    expect(fatigueCheck(spaced[1], spaced, any).frequent).toBe(false); // exactly 28 days
    const short = [ev(0, 0, 0), ev(1, 29, 29), ev(2, 58, 58), ev(3, 87, 87)];
    expect(fatigueCheck(short[3], short, any)).toMatchObject({ frequent: true, byCount: true, byGap: false, inWindow: 4 });
    expect(fatigueCheck(short[2], short, any).frequent).toBe(false);
  });

  it('efficiency (check D) = Unit Lift % ÷ Promo Depth %, e.g. +93 % units at 30 % off = 3.1', () => {
    expect(efficiency(0.93, 0.3)).toBeCloseTo(3.1, 10);
    expect(efficiency(2.15, 0.3)).toBeCloseTo(7.1667, 4);
    expect(efficiency(-0.1, 0.2)).toBeCloseTo(-0.5, 10);
    // Fails safely: no lift or no usable discount gives no efficiency.
    expect(efficiency(null, 0.3)).toBeNull();
    expect(efficiency(0.5, 0)).toBeNull();
    expect(efficiency(0.5, null)).toBeNull();
    expect(efficiency(Number.NaN, 0.3)).toBeNull();
  });

  it('calibrated efficiency thresholds per promo type; BOGO and Other use the TPR values (assumption)', () => {
    expect(EFFICIENCY.HB).toEqual({ watch: 3.1, flag: 1.8 });
    expect(EFFICIENCY.PL).toEqual({ watch: 2.0, flag: 1.1 });
    expect(EFFICIENCY.TPR).toEqual({ watch: 2.2, flag: 1.1 });
    expect(EFFICIENCY.BOGO).toEqual({ watch: 2.2, flag: 1.1, assumed: true });
    expect(EFFICIENCY.OTH).toEqual({ watch: 2.2, flag: 1.1, assumed: true });
    // Hot Buy: flag below 1.8, watch below 3.1.
    expect(efficiencyBand('HB', 1.79)).toBe('flag');
    expect(efficiencyBand('HB', 1.8)).toBe('watch');
    expect(efficiencyBand('HB', 3.09)).toBe('watch');
    expect(efficiencyBand('HB', 3.1)).toBe('ok');
    // Price Lock: flag below 1.1, watch below 2.0.
    expect(efficiencyBand('PL', 1.0)).toBe('flag');
    expect(efficiencyBand('PL', 1.5)).toBe('watch');
    expect(efficiencyBand('PL', 2.0)).toBe('ok');
    // TPR: flag below 1.1, watch below 2.2; the same efficiency is ok for a Price Lock but watch for a TPR.
    expect(efficiencyBand('TPR', 2.1)).toBe('watch');
    expect(efficiencyBand('PL', 2.1)).toBe('ok');
    expect(efficiencyBand('BOGO', 1.0)).toBe('flag');
    expect(efficiencyBand('OTH', 2.3)).toBe('ok');
    expect(efficiencyBand('HB', null)).toBeNull();
  });

  it('flags "Possible promo fatigue" only when promoted often AND efficiency in flag; "Watch" when in watch', () => {
    // Event 3: frequent (27-day gap), Hot Buy at 30 % off.
    expect(fatigueCheck(at(3), LIST, lift(0.45)).status).toBe('fatigue'); // 1.5 < 1.8
    expect(fatigueCheck(at(3), LIST, lift(0.75)).status).toBe('watch'); // 2.5: watch
    expect(fatigueCheck(at(3), LIST, lift(1.2)).status).toBeNull(); // 4.0: ok
    // Event 1: not frequent, so a flag-level efficiency alone shows nothing.
    const c = fatigueCheck(at(1), LIST, lift(0.1));
    expect(c.band).toBe('flag');
    expect(c.status).toBeNull();
    // Frequent with no lift data: nothing.
    expect(fatigueCheck(at(3), LIST, lift(null)).status).toBeNull();
    // A TPR with the same lift and depth is judged with the TPR thresholds: 0.45 / 0.3 = 1.5 → watch for a TPR.
    const tpr = [ev(0, 0, 6, 1, 'TPR'), ev(1, 20, 26, 1, 'TPR')];
    expect(fatigueCheck(tpr[1], tpr, lift(0.45)).status).toBe('watch');
  });

  it('the tooltip lists the rules met with the event values', () => {
    const c = fatigueCheck(at(3), LIST, lift(0.45));
    expect(fatigueReasons(c, 'HB')).toEqual([
      'Promoted often: 27 days since the previous promo (rule: under 28; window not yet calibrated).',
      'Low efficiency: 1.5 extra units (%) per discount point (Hot Buys: flag below 1.8).',
    ]);
    const bogo = [ev(0, 0, 6, 1, 'BOGO', 0.5), ev(1, 20, 26, 1, 'BOGO', 0.5)];
    expect(fatigueReasons(fatigueCheck(bogo[1], bogo, lift(0.8)), 'BOGO')[1]).toBe('Efficiency to watch: 1.6 extra units (%) per discount point (BOGOs: watch below 2.2, TPR values assumed).');
  });

  it('discount below floor (check A): Hot Buy under 15 %, every other type under 10 %', () => {
    expect(DEPTH_FLOOR).toEqual({ HB: 0.15, PL: 0.1, TPR: 0.1, BOGO: 0.1, OTH: 0.1 });
    expect(belowFloor({ type: 'HB', depth: 0.14 })).toBe(true);
    expect(belowFloor({ type: 'HB', depth: 0.15 })).toBe(false);
    expect(belowFloor({ type: 'TPR', depth: 0.12 })).toBe(false);
    expect(belowFloor({ type: 'PL', depth: 0.09 })).toBe(true);
    expect(belowFloor({ type: 'BOGO', depth: 0.1 })).toBe(false);
    expect(belowFloor({ type: 'HB', depth: Number.NaN })).toBe(false);
    expect(floorText({ type: 'PL', depth: 0.08 })).toBe('Promo Depth 8 % is below the 10 % floor for Price Locks.');
  });

  it('(i) text', () => {
    expect(FATIGUE_INFO).toBe('Thresholds from the Promo Hygiene Review (calibrated). The fatigue window is not yet calibrated. Not part of the Hot Buy Score.');
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
      }
    }
  });
});
