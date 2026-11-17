import { describe, expect, it } from 'vitest';
import { STORE_SHARE } from '../data/generate';
import { DEPTS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { STORES } from '../data/stores';
import { baselineWindow, cannGroup, derive, emptyAgg, eventAgg, sumAggs, type EventCtx } from './metrics';

const ctx: EventCtx = { baselineWeeks: 4, level: 'category', itemMask: null, storeShare: null };
const close = (a: number | null, b: number | null) => {
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!).toBeCloseTo(b!, 4);
};

describe('every event is internally coherent', () => {
  for (const basis of ['net', 'gross'] as const) {
    it(`incremental, lift, margin, funding and ROI tie out (${basis})`, () => {
      for (const e of EVENTS) {
        const m = derive(eventAgg(e, ctx), basis);
        close(m.incSales, m.sales - m.baseSales);
        if (m.baseSales > 0) close(m.salesLift, m.incSales! / m.baseSales);
        close(m.incGm, m.gm! - m.baseGm!);
        close(m.netGm, m.gm! + m.funding);
        close(m.netIncSales, m.incSales! + m.cannSales!);
        close(m.netIncGm, m.incGm! + m.cannGm! + m.funding);
        close(m.weisCost, m.invest - m.funding);
        close(m.funding, m.fundingByType.scan + m.fundingByType.bill + m.fundingByType.other);
        if (m.weisCost! > 0.01) close(m.roi, m.netIncGm! / m.weisCost!);
        expect(m.funding).toBeLessThanOrEqual(m.invest + 1e-6);
        expect(m.net).toBeLessThan(m.gross);
      }
    });
  }
  it('SKU rows add up to the price group row', () => {
    for (const e of EVENTS.slice(0, 120)) {
      const total = eventAgg(e, ctx);
      const parts = sumAggs(PRICE_GROUPS[e.pg].items.map((i) => eventAgg(e, ctx, i)));
      expect(parts.gross).toBeCloseTo(total.gross, 2);
      expect(parts.invest).toBeCloseTo(total.invest, 2);
      expect(parts.units.ea + parts.units.lb).toBeCloseTo(total.units.ea + total.units.lb, 2);
      expect(parts.cGross).toBeNull();
    }
  });
  it('totals are ratios of totals, not averages of event rates', () => {
    const list = EVENTS.slice(0, 40).map((e) => eventAgg(e, ctx));
    const all = derive(sumAggs(list), 'net');
    const sales = list.reduce((a, x) => a + x.net, 0);
    const base = list.reduce((a, x) => a + x.bNet, 0);
    close(all.salesLift, (sales - base) / base);
  });
  it('an empty selection gives zeros and nulls, never NaN', () => {
    const m = derive(sumAggs([]), 'net');
    expect(m.sales).toBe(0);
    expect(m.salesLift).toBeNull();
    expect(m.gmPct).toBeNull();
    expect(m.roi).toBeNull();
    expect(m.unitLift).toEqual({ ea: null, lb: null });
    expect(m.yoy).toEqual({ abs: null, pct: null });
    expect(derive(emptyAgg(), 'gross').avgDepth).toBeNull();
  });
  it('never adds each and pounds', () => {
    const beef = EVENTS.find((e) => PRICE_GROUPS[e.pg].uom === 'lb')!;
    const cola = EVENTS.find((e) => PRICE_GROUPS[e.pg].uom === 'ea')!;
    const m = derive(sumAggs([eventAgg(beef, ctx), eventAgg(cola, ctx)]), 'net');
    expect(m.units.ea).toBeGreaterThan(0);
    expect(m.units.lb).toBeGreaterThan(0);
    expect(m.unitLift.ea).not.toBeNull();
    expect(m.unitLift.lb).not.toBeNull();
    expect(m.avgRetail).toEqual({ ea: null, lb: null });
  });
});

describe('baseline and cannibalization controls', () => {
  it('clips the baseline window to the start of the data and flags it', () => {
    expect(baselineWindow({ start: 60 }, 4)).toEqual({ from: 32, to: 59, days: 28, partial: false });
    expect(baselineWindow({ start: 60 }, 52)).toEqual({ from: 0, to: 59, days: 60, partial: true });
  });
  it('a longer baseline window changes the baseline', () => {
    const e = EVENTS[EVENTS.length - 1];
    expect(eventAgg(e, { ...ctx, baselineWeeks: 13 }).bNet).not.toBeCloseTo(eventAgg(e, ctx).bNet, 0);
  });
  it('cannibalization groups nest: brand-category ⊂ brand and ⊂ category, never the promoted items', () => {
    for (const e of EVENTS.slice(0, 200)) {
      const pg = PRICE_GROUPS[e.pg];
      const bc = cannGroup(e, 'brandcat');
      const b = new Set(cannGroup(e, 'brand'));
      const c = new Set(cannGroup(e, 'category'));
      for (const i of bc) {
        expect(b.has(i)).toBe(true);
        expect(c.has(i)).toBe(true);
      }
      for (const i of [...b, ...c]) expect(pg.items.includes(i)).toBe(false);
    }
  });
});

describe('store filter', () => {
  it('store shares add up to the chain in every department', () => {
    for (const d of DEPTS) expect(STORE_SHARE[d.idx].reduce((a, v) => a + v, 0)).toBeCloseTo(1, 9);
  });
  it('a store selection scales every dollar by its share', () => {
    const e = EVENTS[10];
    const share = new Float64Array(DEPTS.length).fill(0.25);
    const chain = eventAgg(e, ctx);
    const part = eventAgg(e, { ...ctx, storeShare: share });
    expect(part.gross).toBeCloseTo(chain.gross * 0.25, 4);
    expect(part.fund.scan).toBeCloseTo(chain.fund.scan * 0.25, 4);
    expect(STORES.length).toBe(200);
  });
});

describe('Funding Type filter', () => {
  const mixed = EVENTS.find((e) => (e.fundingMix.scan ?? 0) > 0 && (e.fundingMix.bill ?? 0) > 0)!;
  it('funding amounts count only the filtered type', () => {
    const all = derive(eventAgg(mixed, ctx), 'net');
    const bill = derive(eventAgg(mixed, { ...ctx, fundingTypes: ['bill'] }), 'net');
    expect(bill.funding).toBeCloseTo(all.fundingByType.bill, 6);
    expect(bill.funding).toBeLessThan(all.funding);
    expect(bill.fundingByType.scan).toBe(0);
    expect(bill.fundingByType.bill).toBeCloseTo(all.fundingByType.bill, 6);
    close(bill.vendorPct, bill.funding / bill.invest);
    close(bill.weisCost, bill.invest - bill.funding);
    expect(bill.weisCost!).toBeGreaterThan(all.weisCost!);
  });
  it('Net GM $, Net Incremental GM $ and Promo ROI keep all vendor funding (definition #3)', () => {
    const all = derive(eventAgg(mixed, ctx), 'net');
    const bill = derive(eventAgg(mixed, { ...ctx, fundingTypes: ['bill'] }), 'net');
    expect(bill.fundingAll).toBeCloseTo(all.funding, 6);
    close(bill.netGm, all.netGm);
    close(bill.netIncGm, all.netIncGm);
    expect(bill.roi).toBeCloseTo(all.roi!, 6);
    close(bill.weisCostAll, all.weisCost);
  });
  it('a type the event does not use gives zero funding and a fully Weis-funded cost', () => {
    const scanOnly = EVENTS.find((e) => e.fundingMix.scan === 1 && e.fundingRate > 0)!;
    const other = derive(eventAgg(scanOnly, { ...ctx, fundingTypes: ['other'] }), 'net');
    expect(other.funding).toBe(0);
    expect(other.vendorPct).toBe(0);
    close(other.weisCost, other.invest);
  });
  it('sums the filtered type across events (ratio of totals)', () => {
    const list = EVENTS.slice(0, 80);
    const f = derive(sumAggs(list.map((e) => eventAgg(e, { ...ctx, fundingTypes: ['scan'] }))), 'net');
    const parts = list.reduce((a, e) => a + derive(eventAgg(e, ctx), 'net').fundingByType.scan, 0);
    expect(f.funding).toBeCloseTo(parts, 4);
    expect(f.fundingByType.bill + f.fundingByType.other).toBe(0);
  });
});
