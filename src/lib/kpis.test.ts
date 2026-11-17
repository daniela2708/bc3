import { describe, expect, it } from 'vitest';
import {
  avgPromoRetail,
  baselineFromWindow,
  cannibalizationRate,
  diff,
  grossMargin,
  grossMarginPct,
  incremental,
  incrementalGm,
  lift,
  netGrossMargin,
  netIncrementalGm,
  netIncrementalSales,
  newToCategoryPct,
  postPromoDip,
  promoDepth,
  promoInvestment,
  promoRoi,
  repeatRate,
  safeDiv,
  spendChange,
  sumStrict,
  vendorFundedPct,
  weisFundedCost,
  yoyGrowth,
} from './kpis';

describe('guarded arithmetic', () => {
  it('returns null for zero, missing or non-finite denominators', () => {
    expect(safeDiv(5, 0)).toBeNull();
    expect(safeDiv(5, null)).toBeNull();
    expect(safeDiv(undefined, 2)).toBeNull();
    expect(safeDiv(NaN, 2)).toBeNull();
    expect(safeDiv(5, Infinity)).toBeNull();
    expect(safeDiv(6, 3)).toBe(2);
  });
  it('propagates missing parts in sums and differences', () => {
    expect(sumStrict(1, 2, 3)).toBe(6);
    expect(sumStrict()).toBe(0);
    expect(sumStrict(1, null)).toBeNull();
    expect(diff(5, undefined)).toBeNull();
  });
});

describe('baseline', () => {
  it('scales the window daily average to the promo days', () => {
    expect(baselineFromWindow(2800, 28, 7)).toBe(700);
  });
  it('is null when the window has no days or invalid inputs', () => {
    expect(baselineFromWindow(100, 0, 7)).toBeNull();
    expect(baselineFromWindow(100, -3, 7)).toBeNull();
    expect(baselineFromWindow(null, 28, 7)).toBeNull();
    expect(baselineFromWindow(100, 28, -1)).toBeNull();
    expect(baselineFromWindow(100, NaN, 7)).toBeNull();
  });
});

describe('sales, units and lift', () => {
  it('incremental = promo − baseline, lift = incremental ÷ baseline', () => {
    expect(incremental(300, 100)).toBe(200);
    expect(lift(300, 100)).toBe(2);
    expect(lift(80, 100)).toBeCloseTo(-0.2);
  });
  it('lift is null with a zero baseline (no division by zero)', () => {
    expect(lift(300, 0)).toBeNull();
    expect(lift(0, 0)).toBeNull();
  });
  it('average promo retail and promo depth', () => {
    expect(avgPromoRetail(500, 100)).toBe(5);
    expect(avgPromoRetail(500, 0)).toBeNull();
    expect(promoDepth(10, 7)).toBeCloseTo(0.3);
    expect(promoDepth(0, 7)).toBeNull();
    expect(promoDepth(10, -1)).toBeNull();
  });
});

describe('margin', () => {
  it('Promo GM, GM %, incremental and net GM', () => {
    const gm = grossMargin(1000, 700);
    expect(gm).toBe(300);
    expect(grossMarginPct(gm, 1000)).toBeCloseTo(0.3);
    expect(grossMarginPct(gm, 0)).toBeNull();
    expect(incrementalGm(300, 450)).toBe(-150);
    expect(netGrossMargin(300, 120)).toBe(420);
    expect(netGrossMargin(300, null)).toBeNull();
  });
});

describe('cannibalization', () => {
  it('rate is the share of incremental units taken from other items; halo is negative', () => {
    expect(cannibalizationRate(-30, 100)).toBeCloseTo(0.3);
    expect(cannibalizationRate(20, 100)).toBeCloseTo(-0.2);
  });
  it('rate is null without positive incremental units', () => {
    expect(cannibalizationRate(-30, 0)).toBeNull();
    expect(cannibalizationRate(-30, -10)).toBeNull();
    expect(cannibalizationRate(null, 100)).toBeNull();
  });
  it('net incremental sales and net incremental GM', () => {
    expect(netIncrementalSales(500, -200)).toBe(300);
    expect(netIncrementalGm(-150, -40, 260)).toBe(70);
    expect(netIncrementalGm(-150, null, 260)).toBeNull();
  });
});

describe('funding and ROI', () => {
  it('investment, vendor-funded %, Weis-funded cost', () => {
    expect(promoInvestment(10, 7, 100)).toBe(300);
    expect(promoInvestment(7, 10, 100)).toBe(0);
    expect(vendorFundedPct(120, 300)).toBeCloseTo(0.4);
    expect(vendorFundedPct(120, 0)).toBeNull();
    expect(weisFundedCost(300, 120)).toBe(180);
  });
  it('ROI = net incremental GM ÷ Weis-funded cost', () => {
    expect(promoRoi(90, 180)).toBeCloseTo(0.5);
    expect(promoRoi(-90, 180)).toBeCloseTo(-0.5);
  });
  it('ROI is undefined (null) when the vendor paid everything or the cost is missing', () => {
    expect(promoRoi(90, 0)).toBeNull();
    expect(promoRoi(90, -5)).toBeNull();
    expect(promoRoi(90, null)).toBeNull();
  });
});

describe('trend and shopper', () => {
  it('post-promo dip and YoY', () => {
    expect(postPromoDip(60, 100)).toBeCloseTo(-0.4);
    expect(postPromoDip(60, 0)).toBeNull();
    expect(yoyGrowth(110, 100)).toEqual({ abs: 10, pct: 0.1 });
    expect(yoyGrowth(110, 0)).toEqual({ abs: 110, pct: null });
    expect(yoyGrowth(110, null)).toEqual({ abs: null, pct: null });
  });
  it('shopper ratios are guarded', () => {
    expect(spendChange(120, 100)).toBeCloseTo(0.2);
    expect(repeatRate(30, 100)).toBeCloseTo(0.3);
    expect(repeatRate(0, 0)).toBeNull();
    expect(newToCategoryPct(10, 0)).toBeNull();
  });
});
