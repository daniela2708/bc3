import { describe, expect, it } from 'vitest';
import { EVENTS } from '../data/promos';
import { ALL_EVENTS, bridgeEvent, bridgeSteps, chartEvent, eventOptionLabel, eventOptions, filterOptions, SEARCHABLE_FROM, selectedInTable } from './eventPick';
import { DEFAULT_STATE, fromQuery, toQuery } from './filters';
import { derive, eventAgg, sumAggs, type EventCtx } from './metrics';

const ctx: EventCtx = { baselineWeeks: 4, level: 'sub', itemMask: null, storeShare: null };
const table = EVENTS.filter((e) => e.type === 'HB').slice(-15).map((e) => e.idx);
const sales = new Map(table.map((e) => [e, derive(eventAgg(EVENTS[e], ctx), 'net').sales]));
const salesOf = (e: number) => sales.get(e) ?? 0;
const top = [...table].sort((a, b) => salesOf(b) - salesOf(a))[0];

describe('bridge event', () => {
  it('defaults to "All events in the table"', () => {
    expect(bridgeEvent(DEFAULT_STATE.sel, table, null)).toBeNull();
    expect(eventOptions(table, true)[0]).toEqual({ value: ALL_EVENTS, label: `All events in the table (${table.length})` });
  });
  it('with All events, the bridge adds up every event of the table', () => {
    const aggs = table.map((e) => eventAgg(EVENTS[e], ctx));
    const all = bridgeSteps(derive(sumAggs(aggs), 'net'));
    const parts = aggs.map((a) => bridgeSteps(derive(a, 'net')));
    all.forEach((step, i) => expect(step.value).toBeCloseTo(parts.reduce((t, p) => t + p[i].value, 0), 4));
    expect(all.map((s) => s.label)).toEqual(['Promo item lift', 'Cannibalization', 'Net incremental', 'Rest of category', 'Category incremental']);
  });
});

describe('sync between the table and both Event dropdowns', () => {
  const e = table[3];
  it('a row click (or a pick in either dropdown) selects the event in both charts', () => {
    expect(bridgeEvent(e, table, null)).toBe(e);
    expect(chartEvent(e, table, salesOf)).toBe(e);
  });
  it('picking "All events" in the bridge keeps the sales chart on the selected event', () => {
    expect(bridgeEvent(e, table, e)).toBeNull();
    expect(chartEvent(e, table, salesOf)).toBe(e);
  });
  it('a new row click after "All events" switches the bridge to that event', () => {
    const f = table[5];
    expect(bridgeEvent(f, table, e)).toBe(f);
  });
  it('without a selection the sales chart shows the event with the highest sales', () => {
    expect(chartEvent(-1, table, salesOf)).toBe(top);
    expect(chartEvent(-1, [], salesOf)).toBe(-1);
  });
  it('when global filters drop the selected event, the bridge goes back to All and the chart to the top event', () => {
    const narrower = table.filter((x) => x !== e);
    expect(selectedInTable(e, narrower)).toBeNull();
    expect(bridgeEvent(e, narrower, null)).toBeNull();
    expect(chartEvent(e, narrower, salesOf)).toBe(chartEvent(-1, narrower, salesOf));
  });
  it('the selected event stays in the URL with the same strict validation', () => {
    expect(fromQuery(toQuery({ ...DEFAULT_STATE, sel: e }), EVENTS.length).sel).toBe(e);
    for (const bad of ['sel=abc', 'sel=-3', `sel=${EVENTS.length}`, 'sel=1e3', 'sel=%3Cscript%3E']) expect(fromQuery(bad, EVENTS.length).sel).toBe(-1);
  });
});

describe('Event dropdown options', () => {
  it('"Price group · Promo type · mm/dd/yy–mm/dd/yy", latest start first, no All option on the sales chart', () => {
    const opts = eventOptions(table, false);
    expect(opts).toHaveLength(table.length);
    for (const o of opts) expect(o.label).toMatch(/^.+ · (Hot Buy|TPR|BOGO|Price Lock|Other) · \d\d\/\d\d\/\d\d–\d\d\/\d\d\/\d\d$/);
    const starts = opts.map((o) => EVENTS[Number(o.value)].start);
    expect([...starts].sort((a, b) => b - a)).toEqual(starts);
    expect(opts.some((o) => o.value === ALL_EVENTS)).toBe(false);
    expect(eventOptionLabel(EVENTS[table[0]])).toContain(' · Hot Buy · ');
  });
  it('becomes searchable above 10 options and filters by price group or promo type, keeping All', () => {
    expect(SEARCHABLE_FROM).toBe(11);
    const opts = eventOptions(table, true);
    const name = opts[1].label.split(' · ')[0];
    const hits = filterOptions(opts, name.slice(0, 5).toUpperCase());
    expect(hits[0].value).toBe(ALL_EVENTS);
    expect(hits.slice(1).every((o) => o.label.toLowerCase().includes(name.slice(0, 5).toLowerCase()))).toBe(true);
    expect(filterOptions(opts, 'hot buy')).toHaveLength(opts.length);
    expect(filterOptions(opts, 'zzzz')).toEqual([opts[0]]);
  });
});
