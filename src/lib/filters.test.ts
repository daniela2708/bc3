import { describe, expect, it } from 'vitest';
import { AS_OF_DAY, adWeekOfDay, adWeekStart, dayFromYMD, LAST_COMPLETE_AD_WEEK, snapToThursday, weekday } from '../data/calendar';
import { EVENTS } from '../data/promos';
import { ITEMS } from '../data/products';
import { BASE_TIME, DEFAULT_STATE, fromQuery, resolveTime, TABS, toQuery, usesFilter, type FilterState } from './filters';
import { getScope, itemMaskOf, storeShareOf } from './selectors';

const state = (patch: Partial<FilterState>): FilterState => ({ ...structuredClone(DEFAULT_STATE), ...patch });

describe('ad weeks', () => {
  it('run Thursday to Wednesday', () => {
    const thu = dayFromYMD(2026, 11, 5);
    expect(weekday(thu)).toBe(4);
    expect(snapToThursday(dayFromYMD(2026, 11, 11))).toBe(thu);
    expect(snapToThursday(dayFromYMD(2026, 11, 12))).toBe(dayFromYMD(2026, 11, 12));
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
    expect(s.baseline).toBe(4);
    expect(s.level).toBe('category');
    expect(s.basis).toBe('net');
    expect(s.event).toBe(-1);
    expect(s.item).toBe(-1);
    expect(s.vb).toBe('');
    expect(s.promoType).toBe('all');
    expect(s.cols.a).toEqual([]);
    expect(fromQuery('x'.repeat(3000), EVENTS.length)).toEqual(DEFAULT_STATE);
  });
  it('Promo Funding is gone: tab=funding and funding filters fall back to the defaults', () => {
    expect(TABS.map((t) => t.id)).toEqual(['hotbuy', 'other', 'trend', 'history', 'shopper']);
    expect(fromQuery('tab=funding', EVENTS.length)).toEqual(DEFAULT_STATE);
    expect(fromQuery('tab=funding&fu=bill&funding=scan', EVENTS.length)).toEqual(DEFAULT_STATE);
    const s = fromQuery('tab=other&fu=bill&fundingType=other', EVENTS.length);
    expect(s).toEqual({ ...DEFAULT_STATE, tab: 'other' });
    expect('funding' in s).toBe(false);
    expect(toQuery(s)).not.toMatch(/(^|&)(fu|funding)=/);
    expect(usesFilter('history', 'funding' as never)).toBe(false);
  });
  it('never puts a pasted UPC list in the URL', () => {
    expect(toQuery(state({ codes: [1, 2, 3] }))).not.toMatch(/codes|upc/);
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
