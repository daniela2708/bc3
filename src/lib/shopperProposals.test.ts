import { describe, expect, it } from 'vitest';
import { EVENTS } from '../data/promos';
import { DEFAULT_STATE } from './filters';
import { buildHeatmap, heatColor, MONTHS } from './heatmap';
import { eventAgg, type EventCtx } from './metrics';
import { getScope } from './selectors';
import { deriveShopper, eventShopper } from './shopper';
import { categorySummary, DEFAULT_PROPOSAL, hotBuyMonths, parseProposal, PROPOSALS } from './shopperProposals';

const ctx: EventCtx = { baselineWeeks: 'byType', level: 'sub', itemMask: null, storeShare: null };

describe('Promo Shopper Impact layout proposals', () => {
  it('three proposals, A by default; anything else falls back to A', () => {
    expect(PROPOSALS.map((p) => `${p.id} ${p.name}`)).toEqual(['A Category summary', 'B Event detail', 'C Executive snapshot']);
    expect(DEFAULT_PROPOSAL).toBe('A');
    expect(parseProposal('B')).toBe('B');
    expect(parseProposal('C')).toBe('C');
    expect(parseProposal('D')).toBe('A');
    expect(parseProposal(undefined)).toBe('A');
    expect(parseProposal('<script>')).toBe('A');
  });

  it('A: one row per category, every event counted once', () => {
    const scope = getScope({ ...DEFAULT_STATE, tab: 'shopper' });
    const rows = categorySummary(scope.events, scope.ctx);
    expect(new Set(rows.map((r) => r.cat)).size).toBe(rows.length);
    expect(rows.reduce((s, r) => s + r.events.length, 0)).toBe(scope.events.length);
    for (const r of rows) {
      expect(r.m.events).toBe(r.events.length);
      expect(r.m.buyers).toBeGreaterThan(0);
    }
  });

  it('A and B: lift vs. the previous week and last year, and the after window, are aggregates with guarded ratios', () => {
    const e = EVENTS.find((x) => x.type === 'HB' && x.start > 400 && x.end + 40 < 1000)!;
    const m = deriveShopper(eventShopper(e, ctx));
    expect(Number.isFinite(m.buyersVsPrev!)).toBe(true);
    expect(Number.isFinite(m.buyersVsLy!)).toBe(true);
    expect(m.afterBuyers!).toBeGreaterThan(0);
    expect(m.afterBasket!).toBeGreaterThan(0);
    const first = deriveShopper(eventShopper(EVENTS[0], ctx));
    expect(first.buyersVsLy).toBeNull();
  });

  it('C: Hot Buys only, grouped by the month their ad week starts, latest first', () => {
    const scope = getScope({ ...DEFAULT_STATE, tab: 'shopper' });
    const months = hotBuyMonths(scope.events);
    expect(months.length).toBeGreaterThan(0);
    for (const m of months) {
      expect(m.label).toMatch(/^[A-Z][a-z]+ \d{4}$/);
      for (const e of m.events) expect(EVENTS[e].type).toBe('HB');
    }
    const sorts = months.map((m) => Number(m.key.slice(3)) * 100 + Number(m.key.slice(0, 2)));
    expect([...sorts].sort((a, b) => b - a)).toEqual(sorts);
  });
});

describe('Promotion timing heat map', () => {
  const events = EVENTS.filter((e) => e.pg === EVENTS[0].pg).map((e) => e.idx);
  it('one row per price group, twelve months, empty months stay empty and counts add up', () => {
    const h = buildHeatmap(events, (e) => eventAgg(EVENTS[e], ctx), 'net', 'pg', 'lift');
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].cells).toHaveLength(MONTHS.length);
    expect(h.rows[0].cells.reduce((s, c) => s + c.n, 0)).toBe(events.length);
    for (const c of h.rows[0].cells) if (c.n === 0) expect(c.value).toBeNull();
  });
  it('Net Incremental GM $ is the average per event; colours are grey at zero and diverge by sign', () => {
    const one = buildHeatmap(events, (e) => eventAgg(EVENTS[e], ctx), 'net', 'cat', 'netIncGm');
    expect(one.maxAbs).toBeGreaterThan(0);
    expect(heatColor(0, 10)).toBe('rgb(238, 237, 232)');
    expect(heatColor(10, 10)).toBe('rgb(45, 99, 160)');
    expect(heatColor(-10, 10)).toBe('rgb(180, 82, 77)');
  });
});
