import { describe, expect, it } from 'vitest';
import { AD_WEEK, AS_OF_DAY, weekday } from '../data/calendar';
import { EVENTS } from '../data/promos';
import { dailySeries, POST_PROMO_WINDOW_DAYS, type EventCtx } from './metrics';
import { defaultGranularity, promoSeries, promoWindows, seriesTable, SALES_COLUMNS, weeklyBuckets } from './series';

const ctx: EventCtx = { baselineWeeks: 'byType', level: 'sub', itemMask: null, storeShare: null };
const multiWeek = EVENTS.find((e) => e.type === 'TPR' && e.adWeeks >= 3 && e.start > 200 && e.end + POST_PROMO_WINDOW_DAYS < AS_OF_DAY)!;
const hotBuy = EVENTS.find((e) => e.type === 'HB' && e.start > 200 && e.end + POST_PROMO_WINDOW_DAYS < AS_OF_DAY)!;

describe('default granularity', () => {
  it('Weekly for events longer than one ad week, Daily for one-week events', () => {
    expect(defaultGranularity({ adWeeks: 1 })).toBe('daily');
    expect(defaultGranularity({ adWeeks: 2 })).toBe('weekly');
    for (const e of EVENTS) expect(defaultGranularity(e)).toBe(e.adWeeks > 1 ? 'weekly' : 'daily');
    expect(defaultGranularity(hotBuy)).toBe('daily');
    expect(defaultGranularity(multiWeek)).toBe('weekly');
  });
});

describe('windows', () => {
  it('After lasts 28 days (POST_PROMO_WINDOW_DAYS) and stops at the as-of date', () => {
    expect(POST_PROMO_WINDOW_DAYS).toBe(28);
    const w = promoWindows(multiWeek, ctx);
    expect(w.after.to - w.after.from + 1).toBe(28);
    expect(w.after.from).toBe(multiWeek.end + 1);
    const recent = EVENTS.filter((e) => e.end + POST_PROMO_WINDOW_DAYS > AS_OF_DAY).at(-1)!;
    expect(promoWindows(recent, ctx).after.to).toBe(AS_OF_DAY);
  });
  it('the Baseline window is the event baseline: 4 weeks for Hot Buys, 13 for the other types, or the user choice', () => {
    expect(promoWindows(hotBuy, ctx).baseline.weeks).toBe(4);
    expect(promoWindows(multiWeek, ctx).baseline.weeks).toBe(13);
    expect(promoWindows(multiWeek, { baselineWeeks: 8 }).baseline.weeks).toBe(8);
    const w = promoWindows(hotBuy, ctx);
    expect(w.baseline.to - w.baseline.from + 1).toBe(28);
  });
});

describe('weekly series', () => {
  const sr = promoSeries(multiWeek, ctx, 'weekly', 'net');
  const daily = dailySeries(multiWeek, ctx, sr.windows.baseline.from, sr.windows.after.to);
  it('sums each ad week, aligned to the event start (first day of an ad week)', () => {
    for (const p of sr.points) {
      expect(weekday(p.from)).toBe(AD_WEEK.START_WEEKDAY);
      expect(Math.abs((p.from - multiWeek.start) % AD_WEEK.DAYS)).toBe(0);
      const sum = daily.days.filter((d) => d.day >= p.from && d.day <= p.from + AD_WEEK.DAYS - 1).reduce((a, d) => a + d.net, 0);
      expect(p.actual).toBeCloseTo(sum, 6);
    }
  });
  it('starts at the Baseline window and has Baseline, Promo and After weeks', () => {
    expect(sr.points[0].from).toBe(sr.windows.baseline.from);
    expect(sr.points.filter((p) => p.phase === 'baseline')).toHaveLength(13);
    expect(sr.points.filter((p) => p.phase === 'promo')).toHaveLength(multiWeek.adWeeks);
    expect(sr.points.filter((p) => p.phase === 'after')).toHaveLength(4);
  });
  it('weekly baseline = baseline daily average × 7 for full weeks', () => {
    expect(sr.baselinePerWeek).toBeCloseTo(sr.baselinePerDay * 7, 9);
    for (const p of sr.points.filter((x) => !x.partial)) expect(p.baseline).toBeCloseTo(sr.baselinePerDay * 7, 9);
  });
  it('scales the baseline of a partial week to its days and flags it', () => {
    const b = weeklyBuckets(
      [0, 1, 2, 7, 8, 9, 10, 11, 12, 13].map((day) => ({ day, value: 10 })),
      0,
      5,
    );
    expect(b).toEqual([
      { from: 0, days: 3, total: 30, baseline: 15 },
      { from: 7, days: 7, total: 70, baseline: 35 },
    ]);
    const recent = EVENTS.filter((e) => e.adWeeks > 1 && e.end < AS_OF_DAY && e.end + POST_PROMO_WINDOW_DAYS > AS_OF_DAY && (AS_OF_DAY - e.end) % 7 !== 0).at(-1);
    if (recent) {
      const rs = promoSeries(recent, ctx, 'weekly', 'net');
      const last = rs.points.at(-1)!;
      expect(last.partial).toBe(true);
      expect(last.days).toBeLessThan(7);
      expect(last.baseline).toBeCloseTo(rs.baselinePerDay * last.days, 9);
      expect(seriesTable(rs, SALES_COLUMNS).rows.at(-1)![2]).toBe(`${last.days} of 7 (partial)`);
    }
  });
  it('table view: Week, Phase, Days, Sales $, Baseline $, Difference $, with partial weeks marked', () => {
    const t = seriesTable(sr, SALES_COLUMNS);
    expect(t.head).toEqual(['Week', 'Phase', 'Days', 'Sales $', 'Baseline $', 'Difference $']);
    expect(t.rows).toHaveLength(sr.points.length);
    for (const r of t.rows) expect(['Baseline', 'Promo', 'After']).toContain(r[1]);
    for (const r of t.rows) expect(Math.abs(Number(r[5]) - (Number(r[3]) - Number(r[4])))).toBeLessThanOrEqual(1);
  });
});

describe('daily series', () => {
  it('a Hot Buy shows its whole 4-week baseline, the promo days and 28 days after', () => {
    const sr = promoSeries(hotBuy, ctx, 'daily', 'net');
    expect(sr.points[0].from).toBe(hotBuy.start - 28);
    expect(sr.points.filter((p) => p.phase === 'after')).toHaveLength(28);
    expect(sr.baselineShownWeeks).toBe(4);
    expect(seriesTable(sr, SALES_COLUMNS).head[0]).toBe('Day');
  });
  it('a baseline window longer than 8 weeks shows only its last 4 weeks in Daily', () => {
    const sr = promoSeries(multiWeek, ctx, 'daily', 'net');
    expect(sr.windows.baseline.weeks).toBe(13);
    expect(sr.baselineShownWeeks).toBe(4);
    expect(sr.points[0].from).toBe(multiWeek.start - 28);
    expect(promoSeries(multiWeek, { ...ctx, baselineWeeks: 8 }, 'daily', 'net').baselineShownWeeks).toBe(8);
  });
});
