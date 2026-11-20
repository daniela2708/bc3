/**
 * Promo window series for the "vs. baseline" charts (Hot Buy / Other Promo Performance, Post-Promo Trend).
 * Presentation only: it reads the same daily cubes and baseline as the KPIs (dailySeries) and changes no KPI.
 *
 *  - Three windows: Baseline (the N weeks of the event's baseline window), Promo, and After (POST_PROMO_WINDOW_DAYS,
 *    4 weeks, cut at the as-of date).
 *  - Daily: one point per day against the baseline daily average. When the baseline window is longer than 8 weeks,
 *    only its last 4 weeks are drawn.
 *  - Weekly: one point per ad week (AD_WEEK rule in calendar.ts), aligned to the event start (events start on the
 *    first day of an ad week). Each point is the week total against the weekly baseline (daily average × 7). A week
 *    with fewer days (start of the data, data cut-off) is partial and its baseline is scaled to the days it has.
 */
import { AD_WEEK, AS_OF_DAY, shortDay } from '../data/calendar';
import type { PromoEvent } from '../data/promos';
import { baselineWindow, dailySeries, eventBaselineWeeks, POST_PROMO_WINDOW_DAYS, type EventCtx } from './metrics';

export type Granularity = 'daily' | 'weekly';
export type Phase = 'baseline' | 'promo' | 'after';
export type SeriesKey = 'net' | 'gross' | 'units';

export const PHASE_LABEL: Record<Phase, string> = { baseline: 'Baseline', promo: 'Promo', after: 'After' };

/** In Daily, a baseline window longer than this many weeks shows only its last DAILY_BASELINE_SHOWN_WEEKS weeks. */
export const DAILY_BASELINE_MAX_WEEKS = 8;
export const DAILY_BASELINE_SHOWN_WEEKS = 4;

/** Weekly for events longer than one ad week (TPR, price lock, BOGO, other); Daily for one-week events (Hot Buys). */
export function defaultGranularity(e: Pick<PromoEvent, 'adWeeks'>): Granularity {
  return e.adWeeks > 1 ? 'weekly' : 'daily';
}

export interface PromoWindows {
  baseline: { from: number; to: number; weeks: number; partial: boolean };
  promo: { from: number; to: number };
  /** Empty (from > to) when the promo ended on the as-of date. */
  after: { from: number; to: number };
}

/** The three windows of an event: its baseline window, the promo days and the 4 weeks after (to the as-of date). */
export function promoWindows(e: Pick<PromoEvent, 'start' | 'end' | 'type'>, ctx: Pick<EventCtx, 'baselineWeeks'>): PromoWindows {
  const weeks = eventBaselineWeeks(e, ctx);
  const bw = baselineWindow(e, weeks);
  return {
    baseline: { from: bw.from, to: bw.to, weeks, partial: bw.partial },
    promo: { from: e.start, to: Math.min(e.end, AS_OF_DAY) },
    after: { from: e.end + 1, to: Math.min(e.end + POST_PROMO_WINDOW_DAYS, AS_OF_DAY) },
  };
}

export interface SeriesPoint {
  /** Axis label: the day, or the first day of the week ("Wk of 09/17/26"). */
  x: string;
  /** First and last day covered by the point. */
  from: number;
  to: number;
  phase: Phase;
  /** Days with data in the point (1 for daily; 1–7 for weekly). */
  days: number;
  /** A weekly point with fewer than 7 days of data; its baseline is scaled to those days. */
  partial: boolean;
  actual: number;
  baseline: number;
  diff: number;
}

export interface PromoSeries {
  granularity: Granularity;
  windows: PromoWindows;
  points: SeriesPoint[];
  /** Baseline per day and per full week (daily average × 7). */
  baselinePerDay: number;
  baselinePerWeek: number;
  /** Daily view of a long baseline window: only its last weeks are drawn. */
  baselineShownWeeks: number;
}

const phaseOf = (day: number, w: PromoWindows): Phase => (day < w.promo.from ? 'baseline' : day <= w.promo.to ? 'promo' : 'after');

/** Sums a daily series into ad weeks aligned to `anchor` (the event start), each scaled to the days it has. */
export function weeklyBuckets(days: { day: number; value: number }[], anchor: number, perDay: number): { from: number; days: number; total: number; baseline: number }[] {
  const out = new Map<number, { from: number; days: number; total: number; baseline: number }>();
  for (const d of days) {
    const k = Math.floor((d.day - anchor) / AD_WEEK.DAYS);
    const b = out.get(k) ?? { from: anchor + k * AD_WEEK.DAYS, days: 0, total: 0, baseline: 0 };
    b.days += 1;
    b.total += d.value;
    b.baseline = perDay * b.days;
    out.set(k, b);
  }
  return [...out.values()].sort((a, b) => a.from - b.from);
}

export function promoSeries(e: PromoEvent, ctx: EventCtx, granularity: Granularity, key: SeriesKey): PromoSeries {
  const w = promoWindows(e, ctx);
  const longDaily = granularity === 'daily' && w.baseline.weeks > DAILY_BASELINE_MAX_WEEKS;
  const from = longDaily ? Math.max(w.baseline.from, e.start - DAILY_BASELINE_SHOWN_WEEKS * AD_WEEK.DAYS) : w.baseline.from;
  const to = Math.max(w.promo.to, w.after.to);
  const s = dailySeries(e, ctx, from, to);
  const perDay = s.baseline[key];
  const shownWeeks = longDaily ? Math.round((e.start - from) / AD_WEEK.DAYS) : w.baseline.weeks;
  const base = { granularity, windows: w, baselinePerDay: perDay, baselinePerWeek: perDay * AD_WEEK.DAYS, baselineShownWeeks: shownWeeks };

  if (granularity === 'daily') {
    const points = s.days.map((d): SeriesPoint => ({ x: shortDay(d.day), from: d.day, to: d.day, phase: phaseOf(d.day, w), days: 1, partial: false, actual: d[key], baseline: perDay, diff: d[key] - perDay }));
    return { ...base, points };
  }
  const buckets = weeklyBuckets(
    s.days.map((d) => ({ day: d.day, value: d[key] })),
    e.start,
    perDay,
  );
  const points = buckets.map((b): SeriesPoint => ({
    x: `Wk of ${shortDay(b.from)}`,
    from: b.from,
    to: b.from + AD_WEEK.DAYS - 1,
    phase: phaseOf(b.from, w),
    days: b.days,
    partial: b.days < AD_WEEK.DAYS,
    actual: b.total,
    baseline: b.baseline,
    diff: b.total - b.baseline,
  }));
  return { ...base, points };
}

/** Column names of the table view: "Sales $" → Baseline $ / Difference $; "Units" → Baseline units / Difference. */
export interface SeriesColumns {
  value: string;
  baseline: string;
  diff: string;
}
export const SALES_COLUMNS: SeriesColumns = { value: 'Sales $', baseline: 'Baseline $', diff: 'Difference $' };
export const UNITS_COLUMNS: SeriesColumns = { value: 'Units', baseline: 'Baseline units', diff: 'Difference' };

/** Rows for the chart's table view and Excel export: Week (or Day), Phase, Days, value, Baseline, Difference. */
export function seriesTable(sr: PromoSeries, cols: SeriesColumns) {
  return {
    head: [sr.granularity === 'weekly' ? 'Week' : 'Day', 'Phase', 'Days', cols.value, cols.baseline, cols.diff],
    rows: sr.points.map((p) => [p.x, PHASE_LABEL[p.phase], p.partial ? `${p.days} of ${AD_WEEK.DAYS} (partial)` : p.days, Math.round(p.actual), Math.round(p.baseline), Math.round(p.diff)]),
  };
}
