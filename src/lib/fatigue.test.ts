import { describe, expect, it } from 'vitest';
import { EVENTS, EVENTS_BY_PG } from '../data/promos';
import { daysSincePreviousPromo, FATIGUE, promosInLast52Weeks, promotedOften } from './fatigue';

// A price group's events: [idx, start, end] (days). Another price group's event must never count.
const ev = (idx: number, start: number, end: number, pg = 1) => ({ idx, pg, start, end });
const LIST = [ev(0, 0, 6), ev(1, 100, 106), ev(2, 300, 313), ev(3, 340, 346), ev(4, 360, 366), ev(5, 380, 386), ev(9, 370, 376, 2)];
const at = (idx: number) => LIST.find((e) => e.idx === idx)!;

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

  it('flags "Promoted often" at 4 events in 13 weeks or under 28 days since the previous promo', () => {
    expect(FATIGUE).toMatchObject({ windowWeeks: 13, minEvents: 4, minDaysBetween: 28, lookbackWeeks: 52 });
    // 94 days gap, 2 events in 13 weeks: not flagged.
    expect(promotedOften(at(1), LIST)).toBe(false);
    // 27 days since the previous promo: flagged by the gap.
    expect(promotedOften(at(3), LIST)).toBe(true);
    // Exactly 28 days and only 2 events in 13 weeks: not flagged (the gap must be under 28).
    const spaced = [ev(0, 0, 6), ev(1, 34, 40)];
    expect(daysSincePreviousPromo(spaced[1], spaced)).toBe(28);
    expect(promotedOften(spaced[1], spaced)).toBe(false);
    // The count rule on its own (one-day events, 29 days apart): the 4th event within 13 weeks is flagged.
    const short = [ev(0, 0, 0), ev(1, 29, 29), ev(2, 58, 58), ev(3, 87, 87)];
    expect(daysSincePreviousPromo(short[3], short)).toBe(29);
    expect(promotedOften(short[3], short)).toBe(true);
    // Only 3 within 13 weeks: not flagged.
    expect(promotedOften(short[2], short)).toBe(false);
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
