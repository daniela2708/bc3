import { describe, expect, it } from 'vitest';
import { AD_WEEK, AD_WEEK_RULE, AS_OF_DAY, adWeekEnd, adWeekOfDay, adWeekStart, dayFromYMD, LAST_COMPLETE_AD_WEEK, snapToAdWeekStart, weekday } from '../data/calendar';
import { baselineWeeksFor, effectiveBaseline, PROPOSED_BASELINE_BY_TYPE, viewBaselineDefault } from './baseline';
import { EVENTS } from '../data/promos';
import { ITEMS } from '../data/products';
import { BASE_TIME, DEFAULT_STATE, fromQuery, NOT_IN_VIEW, offReason, periodControlLabel, rangeHint, resolveTime, ROLLING_OPTS, rollingLabel, TABS, toQuery, usesFilter, type FilterState } from './filters';
import { getScope, itemMaskOf, storeShareOf } from './selectors';

const state = (patch: Partial<FilterState>): FilterState => ({ ...structuredClone(DEFAULT_STATE), ...patch });

describe('ad weeks', () => {
  it('run Thursday to Wednesday', () => {
    const thu = dayFromYMD(2026, 11, 5);
    expect(weekday(thu)).toBe(4);
    expect(snapToAdWeekStart(dayFromYMD(2026, 11, 11))).toBe(thu);
    expect(snapToAdWeekStart(dayFromYMD(2026, 11, 12))).toBe(dayFromYMD(2026, 11, 12));
    expect(adWeekOfDay(thu)).toBe(adWeekOfDay(thu + 6));
    expect(adWeekOfDay(thu + 7)).toBe(adWeekOfDay(thu) + 1);
  });
  it('the last complete ad week ends on or before the as-of date', () => {
    expect(adWeekStart(LAST_COMPLETE_AD_WEEK) + 6).toBeLessThanOrEqual(AS_OF_DAY);
    expect(adWeekStart(LAST_COMPLETE_AD_WEEK + 1) + 6).toBeGreaterThan(AS_OF_DAY);
  });
  it('the Ad week filter resolves to one Thursday–Wednesday week', () => {
    const r = resolveTime({ ...BASE_TIME, mode: 'fiscal', grain: 'adweek', adWeek: dayFromYMD(2026, 10, 10) });
    expect(weekday(r.start)).toBe(4);
    expect(r.end - r.start).toBe(6);
  });
});

describe('time resolution', () => {
  it('rolling spans count complete ad weeks', () => {
    const r = resolveTime({ ...BASE_TIME, mode: 'rolling', rolling: 13 });
    expect(r.end - r.start + 1).toBe(13 * 7);
  });
  it('Period control: "Last N weeks" options and "Promotions starting …" text; never "Span"', () => {
    expect(ROLLING_OPTS.map(rollingLabel)).toEqual(['Last 6 weeks', 'Last 13 weeks', 'Last 26 weeks', 'Last 52 weeks']);
    expect(periodControlLabel('rolling')).toBe('Period');
    expect(periodControlLabel('todate')).toBe('Period');
    expect(periodControlLabel('fiscal')).toBe('Grain');
    for (const m of ['todate', 'rolling', 'fiscal', 'custom', 'all'] as const) expect(periodControlLabel(m)).not.toMatch(/span/i);
    const rolling = resolveTime({ ...BASE_TIME, mode: 'rolling', rolling: 13 });
    expect(rolling.name).toBe('Last 13 weeks');
    expect(rangeHint('rolling', rolling)).toBe('Promotions starting 08/13/26–11/11/26 (last complete ad week)');
    const custom = resolveTime({ ...BASE_TIME, mode: 'custom', from: dayFromYMD(2026, 1, 1), to: dayFromYMD(2026, 3, 31) });
    expect(rangeHint('custom', custom)).toBe('Promotions starting 01/01/26–03/31/26');
    const day = resolveTime({ ...BASE_TIME, mode: 'todate', toDate: 'day' });
    expect(rangeHint('todate', day)).toBe('Promotions starting 11/15/26');
    for (const m of ['todate', 'fiscal', 'all'] as const) expect(rangeHint(m, resolveTime({ ...BASE_TIME, mode: m }))).toMatch(/^Promotions starting \d\d\/\d\d\/\d\d(–\d\d\/\d\d\/\d\d)?$/);
  });
  it('custom ranges are clamped and ordered', () => {
    const r = resolveTime({ ...BASE_TIME, mode: 'custom', from: AS_OF_DAY + 500, to: -50 });
    expect(r.start).toBe(0);
    expect(r.end).toBe(AS_OF_DAY);
  });
  it('Holiday periods apply on Promo History only', () => {
    const t = { ...BASE_TIME, mode: 'fiscal' as const, grain: 'holiday' as const, fy: 2025, holiday: 'july4' as const };
    expect(resolveTime(t, 'history').name).toContain('July 4');
    expect(resolveTime(t, 'hotbuy').name).toMatch(/^P\d+ FY2025$/);
  });
});

describe('URL state', () => {
  it('round-trips the filters', () => {
    const s = state({ tab: 'history', dept: 0, cat: 0, item: 1, vb: 'v:2', promoType: 'TPR', baseline: 13, level: 'brand', basis: 'gross', time: { ...BASE_TIME, mode: 'custom', from: 100, to: 400 } });
    const back = fromQuery(toQuery(s), EVENTS.length);
    expect(back).toMatchObject({ tab: 'history', dept: 0, cat: 0, item: 1, vb: 'v:2', promoType: 'TPR', baseline: 13, level: 'brand', basis: 'gross' });
    expect(back.time).toMatchObject({ mode: 'custom', from: 100, to: 400 });
  });
  it('falls back to defaults for invalid, out-of-range or hostile values', () => {
    const s = fromQuery('tab=<script>&dept=999&bw=5&lv=x&sb=x&ev=-4&sku=1%27OR1&vb=v:999&pt=ZZ&from=2026-02-30&tm=custom&cols=a:%3Cb%3E', EVENTS.length);
    expect(s.tab).toBe('hotbuy');
    expect(s.dept).toBe(-1);
    expect(s.baseline).toBeNull();
    expect(s.level).toBe('sub');
    expect(s.basis).toBe('net');
    expect(s.event).toBe(-1);
    expect(s.item).toBe(-1);
    expect(s.vb).toBe('');
    expect(s.promoType).toBe('all');
    expect(s.cols.a).toEqual([]);
    expect(fromQuery('x'.repeat(3000), EVENTS.length)).toEqual(DEFAULT_STATE);
  });
  it('six tabs without Promo Funding (#2); tab=funding opens the default tab and funding filters are ignored', () => {
    expect(TABS.map((t) => t.id)).toEqual(['hotbuy', 'other', 'post', 'history', 'shopper', 'trend']);
    expect(TABS.map((t) => t.label)).toEqual(['Hot Buy Performance', 'Other Promo Performance', 'Post-Promo Trend', 'Promo History', 'Promo Shopper Impact', 'Promo Run Trend']);
    expect(fromQuery('tab=funding', EVENTS.length)).toEqual(DEFAULT_STATE);
    expect(fromQuery('tab=funding&fu=bill&funding=scan', EVENTS.length)).toEqual(DEFAULT_STATE);
    const s = fromQuery('tab=other&fu=bill&fundingType=other', EVENTS.length);
    expect(s).toEqual({ ...DEFAULT_STATE, tab: 'other' });
    expect('funding' in s).toBe(false);
    expect(toQuery(s)).not.toMatch(/(^|&)(fu|funding)=/);
    expect(usesFilter('history', 'funding' as never)).toBe(false);
  });
  it('keeps the view default out of the URL and round-trips a chosen baseline and the Subcategory level', () => {
    expect(toQuery(DEFAULT_STATE)).not.toMatch(/(^|&)(bw|lv)=/);
    expect(fromQuery('tab=other', EVENTS.length).baseline).toBeNull();
    expect(fromQuery('bw=8', EVENTS.length).baseline).toBe(8);
    expect(fromQuery('bw=funding', EVENTS.length).baseline).toBeNull();
    expect(fromQuery('lv=sub', EVENTS.length).level).toBe('sub');
    expect(fromQuery('lv=category', EVENTS.length).level).toBe('category');
    expect(fromQuery(toQuery(state({ level: 'category' })), EVENTS.length).level).toBe('category');
  });
  it('rejects tab=funding and its variants (default tab); funding stays rejected everywhere else in the URL', () => {
    expect(fromQuery('tab=funding', EVENTS.length).tab).toBe('hotbuy');
    for (const q of ['tab=funding', 'tab=Funding', 'tab=funding2', 'tab=%20funding', 'tab=funding;x', 'lv=funding', 'sb=funding', 'bw=funding']) {
      const s = fromQuery(q, EVENTS.length);
      if (q.startsWith('tab=')) expect(s.tab).toBe('hotbuy');
      expect(toQuery(s)).not.toMatch(/(^|&)(lv|sb|bw)=funding/);
      expect(toQuery(s)).not.toMatch(/(^|&)(ft|fu)=/);
    }
    expect(toQuery(fromQuery('tab=funding&ft=scan', EVENTS.length))).toBe('tab=hotbuy');
    // A valid tab still opens after an invalid one is rejected.
    expect(fromQuery('tab=history', EVENTS.length).tab).toBe('history');
  });
  it('greys out a filter the workbook does not list for the view', () => {
    expect(offReason('shopper', 'vb')).toBe(NOT_IN_VIEW);
    expect(offReason('hotbuy', 'vb')).toBeUndefined();
  });
  it('round-trips the Proposed weights and ignores any other value', () => {
    expect(fromQuery('sw=proposed', EVENTS.length).weights).toBe('proposed');
    expect(toQuery(fromQuery('sw=proposed', EVENTS.length))).toMatch(/(^|&)sw=proposed/);
    for (const q of ['sw=Proposed', 'sw=current', 'sw=proposed2', 'sw=%3Cx%3E', 'sw=']) expect(fromQuery(q, EVENTS.length).weights).toBe('current');
    expect(toQuery(DEFAULT_STATE)).not.toMatch(/(^|&)sw=/);
  });
  it('never puts a pasted UPC list in the URL', () => {
    expect(toQuery(state({ codes: [1, 2, 3] }))).not.toMatch(/codes|upc/);
  });
});

describe('baseline default per view (#4)', () => {
  it('Hot Buy Performance 4 weeks, Other Promo Performance 13, the other views by promo type', () => {
    expect(viewBaselineDefault('hotbuy')).toBe(4);
    expect(viewBaselineDefault('other')).toBe(13);
    for (const tab of ['post', 'history', 'shopper', 'trend'] as const) expect(viewBaselineDefault(tab)).toBe('byType');
    expect(PROPOSED_BASELINE_BY_TYPE).toEqual({ HB: 4, TPR: 13, BOGO: 13, PL: 13, OTH: 13 });
  });
  it('the scope uses the view default until the user picks a window, and the pick wins in every view', () => {
    expect(getScope(state({ tab: 'hotbuy' })).ctx.baselineWeeks).toBe(4);
    expect(getScope(state({ tab: 'other' })).ctx.baselineWeeks).toBe(13);
    expect(getScope(state({ tab: 'trend' })).ctx.baselineWeeks).toBe('byType');
    expect(getScope(state({ tab: 'shopper' })).ctx.baselineWeeks).toBe('byType');
    for (const tab of TABS.map((t) => t.id)) expect(getScope(state({ tab, baseline: 52 })).ctx.baselineWeeks).toBe(52);
    expect(effectiveBaseline('history', null)).toBe('byType');
    expect(baselineWeeksFor('BOGO', 'byType')).toBe(13);
    expect(baselineWeeksFor('HB', 'byType')).toBe(4);
    expect(baselineWeeksFor('HB', 2)).toBe(2);
  });
});

describe('ad week rule', () => {
  it('lives in one place and defaults to Thursday to Wednesday', () => {
    expect(AD_WEEK).toEqual({ START_WEEKDAY: 4, DAYS: 7 });
    expect(AD_WEEK_RULE).toBe('Thursday to Wednesday');
    expect(adWeekEnd(10) - adWeekStart(10)).toBe(AD_WEEK.DAYS - 1);
    expect(weekday(adWeekStart(10))).toBe(AD_WEEK.START_WEEKDAY);
  });
});

describe('scope', () => {
  it('filters a view does not use are ignored', () => {
    expect(usesFilter('shopper', 'vb')).toBe(false);
    expect(itemMaskOf(state({ tab: 'shopper', vb: 'v:0' }))).toBeNull();
    expect(storeShareOf(state({ tab: 'other', region: 1 }))).toBeNull();
    expect(storeShareOf(state({ tab: 'hotbuy', region: 1 }))).not.toBeNull();
  });
  it('Hot Buy Performance shows Hot Buys only; Other Promo Performance everything else', () => {
    const all = { time: { ...BASE_TIME, mode: 'all' as const } };
    expect(getScope(state({ tab: 'hotbuy', ...all })).events.every((e) => EVENTS[e].type === 'HB')).toBe(true);
    expect(getScope(state({ tab: 'other', ...all, promoType: 'HB' })).events.every((e) => EVENTS[e].type !== 'HB')).toBe(true);
  });
  it('events are included when they start in the range', () => {
    const r = { ...BASE_TIME, mode: 'custom' as const, from: dayFromYMD(2026, 1, 1), to: dayFromYMD(2026, 3, 31) };
    for (const e of getScope(state({ tab: 'other', time: r })).events) {
      expect(EVENTS[e].start).toBeGreaterThanOrEqual(r.from);
      expect(EVENTS[e].start).toBeLessThanOrEqual(r.to);
    }
  });
  it('a pasted list keeps only events whose price group holds a pasted item', () => {
    const item = ITEMS[0];
    const sc = getScope(state({ tab: 'other', codes: [item.idx], time: { ...BASE_TIME, mode: 'all' } }));
    expect(sc.events.length).toBeGreaterThan(0);
    expect(sc.events.every((e) => EVENTS[e].pg === item.pg)).toBe(true);
    expect(sc.itemFiltered).toBe(true);
  });
  it('a funding filter no longer narrows the events', () => {
    const all = { time: { ...BASE_TIME, mode: 'all' as const } };
    const legacy = { ...state({ tab: 'hotbuy', ...all }), funding: 'bill' } as unknown as FilterState;
    expect(getScope(legacy).events).toEqual(getScope(state({ tab: 'hotbuy', ...all })).events);
  });
  it('an empty pasted list filters nothing', () => {
    expect(itemMaskOf(state({ codes: [] }))).toBeNull();
  });
});
