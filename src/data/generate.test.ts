import { describe, expect, it } from 'vitest';
import { derive, eventAgg, type EventCtx } from '../lib/metrics';
import { isValidGtin } from '../lib/upc';
import { AS_OF_DAY, weekday } from './calendar';
import { getModel, rangeSum } from './generate';
import { ITEMS, pgByName, PRICE_GROUPS } from './products';
import { EVENTS, PROMO_TYPES } from './promos';

const ctx: EventCtx = { baselineWeeks: 4, level: 'category', itemMask: null, storeShare: null };
const runsOf = (pg: string, type: string) => EVENTS.filter((e) => e.pg === pgByName(pg).idx && e.type === type);

describe('product master', () => {
  it('has unique SKU Numbers and UPCs, valid check digits, and PLUs for random-weight items', () => {
    expect(new Set(ITEMS.map((i) => i.sku)).size).toBe(ITEMS.length);
    const upcs = ITEMS.map((i) => i.upc).filter((u): u is string => !!u);
    expect(new Set(upcs).size).toBe(upcs.length);
    for (const u of upcs) expect(isValidGtin(u)).toBe(true);
    for (const i of ITEMS.filter((x) => x.uom === 'lb')) expect(i.plu).toMatch(/^\d{4,5}$/);
  });
  it('keeps one unit of measure per price group', () => {
    for (const pg of PRICE_GROUPS) expect(new Set(pg.items.map((i) => ITEMS[i].uom)).size).toBe(1);
  });
  it('keeps Clorox Clean-Up and Clorox Wipes as separate price groups', () => {
    expect(pgByName('Clorox Clean-Up').idx).not.toBe(pgByName('Clorox Disinfecting Wipes').idx);
    expect(pgByName('Clorox Clean-Up').brand).toBe(pgByName('Clorox Disinfecting Wipes').brand);
  });
  it('has a price group with seasonal and everyday items', () => {
    const mm = pgByName("M&M's Sharing Size").items.map((i) => ITEMS[i]);
    expect(mm.some((i) => i.season)).toBe(true);
    expect(mm.some((i) => !i.season)).toBe(true);
  });
});

describe('promo event master', () => {
  it('covers every promo type and more than two years of history', () => {
    for (const t of PROMO_TYPES) expect(EVENTS.filter((e) => e.type === t.id).length).toBeGreaterThan(10);
    expect(AS_OF_DAY - Math.min(...EVENTS.map((e) => e.start))).toBeGreaterThan(730);
  });
  it('runs every event Thursday to Wednesday, ended by the as-of date, with the approved durations', () => {
    for (const e of EVENTS) {
      expect(weekday(e.start)).toBe(4);
      expect(weekday(e.end)).toBe(3);
      expect(e.end).toBeLessThanOrEqual(AS_OF_DAY);
      expect(e.end - e.start + 1).toBe(e.adWeeks * 7);
      if (e.type === 'HB') expect(e.adWeeks).toBe(1);
      if (e.type === 'TPR') expect(e.adWeeks >= 1 && e.adWeeks <= 8).toBe(true);
      if (e.type === 'PL') expect(e.adWeeks >= 4 && e.adWeeks <= 13).toBe(true);
      expect(e.depth).toBeGreaterThan(0);
      expect(e.fundingRate).toBeGreaterThanOrEqual(0);
      expect(e.fundingRate).toBeLessThanOrEqual(1);
    }
  });
  it('never overlaps two events of the same price group, and ids are unique', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    for (const pg of PRICE_GROUPS) {
      const list = EVENTS.filter((e) => e.pg === pg.idx).sort((a, b) => a.start - b.start);
      for (let k = 1; k < list.length; k++) expect(list[k].start).toBeGreaterThan(list[k - 1].end);
    }
  });
  it('includes good and bad cases', () => {
    const m = EVENTS.map((e) => derive(eventAgg(e, ctx), 'net'));
    const neg = m.filter((x) => (x.netIncGm ?? 0) < 0).length;
    expect(neg / m.length).toBeGreaterThan(0.15);
    expect(neg / m.length).toBeLessThan(0.6);
  });
});

describe('planted demo stories', () => {
  it('Cheerios Hot Buy: run nine times, trending down and below last year in FY2026', () => {
    const runs = runsOf('Cheerios Family Size', 'HB').map((e) => derive(eventAgg(e, ctx), 'net'));
    expect(runs.length).toBe(9);
    const avg = (xs: typeof runs) => xs.reduce((a, x) => a + x.salesLift!, 0) / xs.length;
    expect(avg(runs.slice(6))).toBeLessThan(avg(runs.slice(3, 6)));
    expect(avg(runs.slice(3, 6))).toBeLessThan(avg(runs.slice(0, 3)));
    for (const r of runs.slice(6)) expect(r.yoy.pct!).toBeLessThan(0);
  });
  it('Coca-Cola 2 L Hot Buy: high lift, high cannibalization, negative net incremental GM', () => {
    for (const e of runsOf('Coca-Cola 2 L', 'HB').filter((x) => x.planted)) {
      const m = derive(eventAgg(e, ctx), 'net');
      expect(m.salesLift!).toBeGreaterThan(1);
      expect(m.cannRate.ea!).toBeGreaterThan(0.2);
      expect(m.netIncGm!).toBeLessThan(0);
    }
  });
  it('Chobani BOGO: units up, sales and incremental GM down', () => {
    const m = derive(eventAgg(runsOf('Chobani Greek Yogurt 5.3 oz', 'BOGO').find((e) => e.planted)!, ctx), 'net');
    expect(m.unitLift.ea!).toBeGreaterThan(0.3);
    expect(m.salesLift!).toBeLessThan(0);
    expect(m.incGm!).toBeLessThan(0);
  });
  it('Tide Hot Buy: fully funded by scan-downs on a DC item, so the funding is in the cost (#15) and not added again (#7)', () => {
    const e = runsOf('Tide Liquid Detergent 92 oz', 'HB').find((x) => x.planted)!;
    const a = eventAgg(e, ctx);
    const m = derive(a, 'net');
    expect(PRICE_GROUPS[e.pg].source).toBe('DC');
    expect(a.fund.scan).toBeCloseTo(a.invest, 6);
    expect(m.funding).toBe(0);
    expect(m.netGm).toBe(m.gm);
    expect(m.incGm!).toBeGreaterThan(0);
    expect(m.netIncGm!).toBeGreaterThan(0);
  });
  it('Coca-Cola 2 L is delivered direct to store (DSD), so its scan-downs are added in Net GM $', () => {
    const e = runsOf('Coca-Cola 2 L', 'HB').find((x) => x.planted)!;
    const a = eventAgg(e, ctx);
    const m = derive(a, 'net');
    expect(PRICE_GROUPS[e.pg].source).toBe('DSD');
    expect(m.funding).toBeCloseTo(a.fund.scan + a.fund.bill + a.fund.other, 6);
    expect(m.netGm! - m.gm!).toBeCloseTo(m.funding, 6);
  });
  it('Bounty Hot Buy: pantry loading in the 4 weeks after the promo', () => {
    for (const e of runsOf('Bounty Select-A-Size 6 Double Rolls', 'HB').filter((x) => x.planted)) expect(derive(eventAgg(e, ctx), 'net').dip.ea!).toBeLessThan(-0.3);
  });
  it("M&M's October Hot Buy: the Halloween item drives the price group", () => {
    const e = runsOf("M&M's Sharing Size", 'HB').find((x) => x.planted && x.start > 900)!;
    const halloween = ITEMS.find((i) => i.name.includes('Halloween'))!.idx;
    const share = eventAgg(e, ctx, halloween).net / eventAgg(e, ctx).net;
    expect(share).toBeGreaterThan(0.4);
  });
  it('Ground beef Hot Buys sell by the pound', () => {
    const runs = runsOf('Ground Beef 80/20 Family Pack', 'HB');
    expect(runs.length).toBeGreaterThanOrEqual(4);
    const m = derive(eventAgg(runs[0], ctx), 'net');
    expect(m.units.lb).toBeGreaterThan(0);
    expect(m.units.ea).toBe(0);
  });
  it('Clorox Wipes Hot Buy cannibalizes Clean-Up at brand level', () => {
    const e = runsOf('Clorox Disinfecting Wipes', 'HB').find((x) => x.planted)!;
    expect(derive(eventAgg(e, { ...ctx, level: 'brand' }), 'net').cannRate.ea!).toBeGreaterThan(0);
  });
  it('Ragú TPR lifts Barilla pasta (halo in the same category)', () => {
    const e = runsOf('Ragú Pasta Sauce 24 oz', 'TPR').find((x) => x.planted)!;
    const m = getModel();
    const days = e.end - e.start + 1;
    for (const i of pgByName('Barilla Pasta 16 oz').items) {
      const during = rangeSum(m.units, i, e.start, e.end);
      const base = (rangeSum(m.units, i, e.start - 28, e.start - 1) / 28) * days;
      expect(during / base - 1).toBeGreaterThan(0.08);
    }
  });
  it('Weis Quality Water Price Lock: own brand, no vendor funding, so Net GM $ equals Promo GM $', () => {
    const e = runsOf('Weis Quality Water 24 pk 16.9 oz', 'PL').find((x) => x.planted)!;
    const a = eventAgg(e, ctx);
    const m = derive(a, 'net');
    expect(e.adWeeks).toBeGreaterThanOrEqual(4);
    expect(a.invest).toBeGreaterThan(0);
    expect(m.funding).toBe(0);
    expect(m.netGm).toBe(m.gm);
  });
});
