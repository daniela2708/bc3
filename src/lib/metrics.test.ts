import { describe, expect, it } from 'vitest';
import { STORE_SHARE } from '../data/generate';
import { DEPTS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { STORES } from '../data/stores';
import { AS_OF_DAY } from '../data/calendar';
import { baselineWindow, cannGroup, derive, emptyAgg, eventAgg, POST_PROMO_WINDOW_DAYS, sumAggs, type EventCtx } from './metrics';

const ctx: EventCtx = { baselineWeeks: 4, level: 'category', itemMask: null, storeShare: null };
const close = (a: number | null, b: number | null) => {
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!).toBeCloseTo(b!, 4);
};

describe('every event is internally coherent', () => {
  for (const basis of ['net', 'gross'] as const) {
    it(`incremental, lift, margin and funding tie out (${basis})`, () => {
      for (const e of EVENTS) {
        const a = eventAgg(e, ctx);
        const m = derive(a, basis);
        close(m.incSales, m.sales - m.baseSales);
        if (m.baseSales > 0) close(m.salesLift, m.incSales! / m.baseSales);
        close(m.incGm, m.gm! - m.baseGm!);
        close(m.netGm, m.gm! + m.funding);
        close(m.netIncSales, m.incSales! + m.cannSales!);
        close(m.netIncGm, m.incGm! + m.cannGm! + m.funding);
        // Vendor funding is an internal input: every type counts, each allowance once.
        close(m.funding, a.fund.scan + a.fund.bill + a.fund.other);
        close(m.funding, a.invest * e.fundingRate);
        expect(m.funding).toBeLessThanOrEqual(a.invest + 1e-6);
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

describe('vendor funding is internal, not a KPI', () => {
  it('Metrics no longer expose Promo ROI, Vendor-Funded % or Weis-Funded Promo Cost $', () => {
    const m = derive(eventAgg(EVENTS[0], ctx), 'net') as unknown as Record<string, unknown>;
    for (const k of ['roi', 'vendorPct', 'weisCost', 'weisCostAll', 'fundingAll', 'fundingByType', 'invest']) expect(k in m).toBe(false);
  });
  it('a context with a funding-type restriction is ignored (all vendor funding counts)', () => {
    const mixed = EVENTS.find((e) => (e.fundingMix.scan ?? 0) > 0 && (e.fundingMix.bill ?? 0) > 0)!;
    const legacy = { ...ctx, fundingTypes: ['bill'] } as unknown as EventCtx;
    close(derive(eventAgg(mixed, legacy), 'net').funding, derive(eventAgg(mixed, ctx), 'net').funding);
  });
});

describe('Post-Promo Dip % (4-week window, level 2)', () => {
  it('uses a 28-day window', () => {
    expect(POST_PROMO_WINDOW_DAYS).toBe(28);
  });
  it('is null until the 28 days after the promo have passed, even when a week has', () => {
    const recent = EVENTS.filter((e) => e.end + 7 <= AS_OF_DAY && e.end + POST_PROMO_WINDOW_DAYS > AS_OF_DAY);
    expect(recent.length).toBeGreaterThan(0);
    for (const e of recent) {
      const a = eventAgg(e, ctx);
      expect(a.postN).toBe(0);
      expect(derive(a, 'net').dip).toEqual({ ea: null, lb: null });
    }
  });
  it('is measured once the window has passed, against 28 days of baseline', () => {
    const e = EVENTS.find((x) => x.end + POST_PROMO_WINDOW_DAYS <= AS_OF_DAY && x.end + POST_PROMO_WINDOW_DAYS + 7 > AS_OF_DAY)!;
    const a = eventAgg(e, ctx);
    expect(a.postN).toBe(1);
    const daily = (a.bUnits.ea + a.bUnits.lb) / a.promoDays;
    expect(a.postBase.ea + a.postBase.lb).toBeCloseTo(daily * POST_PROMO_WINDOW_DAYS, 4);
    expect(uomFirstOf(derive(a, 'net').dip)).not.toBeNull();
  });
  it('an empty selection has no dip', () => {
    expect(derive(sumAggs([]), 'net').dip).toEqual({ ea: null, lb: null });
  });
});

const uomFirstOf = (v: { ea: number | null; lb: number | null }) => v.ea ?? v.lb;
