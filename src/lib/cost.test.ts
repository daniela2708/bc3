import { describe, expect, it } from 'vitest';
import { DSD_VENDORS, ITEMS, PRICE_GROUPS, VENDORS } from '../data/products';
import { EVENTS } from '../data/promos';
import { netGmFunding, promoCost, scanDownsInCost, type VendorAllowances } from './cost';
import { derive, eventAgg, type EventCtx } from './metrics';

const ctx: EventCtx = { baselineWeeks: 'byType', level: 'sub', itemMask: null, storeShare: null };
const allowances: VendorAllowances = { scan: 100, bill: 40, other: 10 };

describe('supply source (DC / DSD)', () => {
  it('every price group and item has one, from the vendor', () => {
    for (const pg of PRICE_GROUPS) {
      expect(pg.source).toBe(DSD_VENDORS.has(VENDORS[pg.vendor]) ? 'DSD' : 'DC');
      for (const i of pg.items) expect(ITEMS[i].source).toBe(pg.source);
    }
    expect(PRICE_GROUPS.some((p) => p.source === 'DC')).toBe(true);
    expect(PRICE_GROUPS.some((p) => p.source === 'DSD')).toBe(true);
  });
});

describe('cost basis (#15)', () => {
  it('DC: average cost minus scan-downs; DSD: replacement cost', () => {
    expect(promoCost('DC', 1000, 100)).toBe(900);
    expect(promoCost('DSD', 1000, 100)).toBe(1000);
    expect(scanDownsInCost('DC', allowances)).toBe(100);
    expect(scanDownsInCost('DSD', allowances)).toBe(0);
  });
  it('ignores missing or non-finite scan-downs instead of corrupting the cost', () => {
    expect(promoCost('DC', 1000, Number.NaN)).toBe(1000);
    expect(promoCost('DC', 1000, Number.POSITIVE_INFINITY)).toBe(1000);
  });
});

describe('vendor funding added by Net GM $ (#7)', () => {
  it('never applies a bill-back to a DC item', () => {
    expect(netGmFunding('DC', { scan: 0, bill: 500, other: 0 })).toBe(0);
    expect(netGmFunding('DC', allowances)).toBe(10);
    expect(netGmFunding('DSD', { scan: 0, bill: 500, other: 0 })).toBe(500);
  });
  it('never adds slotting or lump sums, for DC or DSD', () => {
    const withSlotting: VendorAllowances = { ...allowances, slotting: 10_000, lumpSum: 5_000 };
    expect(netGmFunding('DSD', withSlotting)).toBe(150);
    expect(netGmFunding('DC', withSlotting)).toBe(10);
    expect(netGmFunding('DSD', { scan: 0, bill: 0, other: 0, slotting: 10_000, lumpSum: 5_000 })).toBe(0);
  });
  it('counts a DC scan-down once: in the cost, not again in Net GM $', () => {
    const inCost = scanDownsInCost('DC', allowances);
    const added = netGmFunding('DC', allowances);
    expect(inCost + added).toBe(allowances.scan + allowances.other);
  });
  it('every DC event: Net GM $ adds no bill-back and no scan-down; every DSD event adds all promo allowances', () => {
    let dcWithBill = 0;
    for (const e of EVENTS) {
      const a = eventAgg(e, ctx);
      const m = derive(a, 'net');
      if (PRICE_GROUPS[e.pg].source === 'DC') {
        if (a.fund.bill > 0) dcWithBill++;
        expect(m.funding).toBeCloseTo(a.fund.other, 6);
      } else {
        expect(m.funding).toBeCloseTo(a.fund.scan + a.fund.bill + a.fund.other, 6);
      }
      expect(m.netGm! - m.gm!).toBeCloseTo(m.funding, 6);
    }
    expect(dcWithBill).toBeGreaterThan(0);
  });
  it('DC scan-downs lower the promo cost of the event by exactly their amount', () => {
    const e = EVENTS.find((x) => PRICE_GROUPS[x.pg].source === 'DC' && (x.fundingMix.scan ?? 0) > 0 && x.fundingRate > 0)!;
    const a = eventAgg(e, ctx);
    const noScan = eventAgg({ ...e, fundingMix: { ...e.fundingMix, scan: 0 } }, ctx);
    expect(noScan.cost - a.cost).toBeCloseTo(a.fund.scan, 6);
  });
});
