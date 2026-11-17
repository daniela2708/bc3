/**
 * Every KPI formula from the requirements workbook, pure and typed (same rules as UC2):
 *  - every rate is a ratio of totals, never an average of rates;
 *  - every division is guarded: a zero or missing denominator returns null, shown as "—".
 * Sign convention: Cannibalized Sales $ is negative for cannibalization and positive for halo;
 * Cannibalization Rate % is positive when other items lost units.
 */

export type Num = number | null | undefined;
const ok = (n: Num): n is number => typeof n === 'number' && Number.isFinite(n);

export function safeDiv(numerator: Num, denominator: Num): number | null {
  if (!ok(numerator) || !ok(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

/** a − b, or null when either side is missing. */
export function diff(a: Num, b: Num): number | null {
  return ok(a) && ok(b) ? a - b : null;
}

/** Sum that propagates missing values: any missing part makes the total missing. */
export function sumStrict(...parts: Num[]): number | null {
  let t = 0;
  for (const p of parts) {
    if (!ok(p)) return null;
    t += p;
  }
  return t;
}

// ---------------------------------------------------------------- Baseline

/** Baseline windows offered by the control, in weeks (default 4, adjustable; question #6). */
export const BASELINE_WEEKS = [2, 4, 8, 13, 52] as const;
export type BaselineWeeks = (typeof BASELINE_WEEKS)[number];
export const DEFAULT_BASELINE_WEEKS: BaselineWeeks = 4;

/**
 * Baseline for the promo days: the daily average of the baseline window × the number of promo days.
 * Null when the window has no days of history (for example the first weeks of FY2024).
 */
export function baselineFromWindow(windowTotal: Num, windowDays: number, promoDays: number): number | null {
  if (!ok(windowTotal) || !Number.isFinite(windowDays) || windowDays <= 0 || !Number.isFinite(promoDays) || promoDays < 0) return null;
  return (windowTotal / windowDays) * promoDays;
}

// ---------------------------------------------------------------- Sales and units

/** Incremental Sales $ = Promo Sales $ − Baseline Sales $ (also Incremental Units with units). */
export function incremental(promo: Num, baseline: Num): number | null {
  return diff(promo, baseline);
}

/** Sales Lift % = Incremental ÷ Baseline (also Unit Lift % with units). */
export function lift(promo: Num, baseline: Num): number | null {
  return safeDiv(incremental(promo, baseline), baseline);
}

/** Avg Promo Retail $ (Average Retail Price per Unit) = Promo Sales $ ÷ Promo Units. */
export function avgPromoRetail(promoSales: Num, promoUnits: Num): number | null {
  return safeDiv(promoSales, promoUnits);
}

/** Promo Depth % = (Regular retail − Promo retail) ÷ Regular retail. */
export function promoDepth(regularRetail: Num, promoRetail: Num): number | null {
  if (!ok(regularRetail) || !ok(promoRetail) || regularRetail <= 0 || promoRetail < 0) return null;
  return (regularRetail - promoRetail) / regularRetail;
}

// ---------------------------------------------------------------- Margin

/** Gross Margin $ = Sales − Cost of goods sold (same GM definition as UC2, on the selected sales basis). */
export function grossMargin(sales: Num, cogs: Num): number | null {
  return diff(sales, cogs);
}

/** Promo Gross Margin % = Promo Gross Margin $ ÷ Promo Sales $ (Net Customer Sales by default; question #7). */
export function grossMarginPct(gm: Num, sales: Num): number | null {
  return safeDiv(gm, sales);
}

/** Incremental Gross Margin $ = Promo Gross Margin $ − Baseline Gross Margin $. */
export function incrementalGm(promoGm: Num, baselineGm: Num): number | null {
  return diff(promoGm, baselineGm);
}

/** Net Gross Margin $ = Promo Gross Margin $ + Vendor Promo Funding $ (all funding types; question #3). */
export function netGrossMargin(promoGm: Num, vendorFunding: Num): number | null {
  return sumStrict(promoGm, vendorFunding);
}

// ---------------------------------------------------------------- Category and cannibalization

/** Cannibalization Rate % = share of the promoted items' incremental units that came from other items. */
export function cannibalizationRate(cannibalizedUnits: Num, incrementalUnits: Num): number | null {
  if (!ok(incrementalUnits) || incrementalUnits <= 0 || !ok(cannibalizedUnits)) return null;
  return -cannibalizedUnits / incrementalUnits;
}

/** Net Incremental Sales $ = Incremental Sales $ + Cannibalized Sales $. */
export function netIncrementalSales(incSales: Num, cannibalizedSales: Num): number | null {
  return sumStrict(incSales, cannibalizedSales);
}

/** Net Incremental Gross Margin $ = Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $. */
export function netIncrementalGm(incGm: Num, cannibalizedGm: Num, vendorFunding: Num): number | null {
  return sumStrict(incGm, cannibalizedGm, vendorFunding);
}

// ---------------------------------------------------------------- Funding

/** Promo Investment $ = (Regular retail − Promo retail) × Promo Units. */
export function promoInvestment(regularRetail: Num, promoRetail: Num, promoUnits: Num): number | null {
  if (!ok(regularRetail) || !ok(promoRetail) || !ok(promoUnits)) return null;
  return Math.max(0, regularRetail - promoRetail) * promoUnits;
}

/** Vendor-Funded % = Vendor Promo Funding $ ÷ Promo Investment $. */
export function vendorFundedPct(funding: Num, investment: Num): number | null {
  return safeDiv(funding, investment);
}

/** Weis-Funded Promo Cost $ = Promo Investment $ − Vendor Promo Funding $. */
export function weisFundedCost(investment: Num, funding: Num): number | null {
  return diff(investment, funding);
}

/**
 * Promo ROI = Net Incremental Gross Margin $ ÷ Weis-Funded Promo Cost $. Null when Weis paid nothing (fully
 * vendor funded): the ratio is undefined, not infinite.
 */
export function promoRoi(netIncGm: Num, weisCost: Num): number | null {
  if (!ok(weisCost) || weisCost <= 0.005) return null;
  return safeDiv(netIncGm, weisCost);
}

// ---------------------------------------------------------------- Trend

/** Post-Promo Dip % = (Units after the promo − Baseline Units for the same days) ÷ Baseline Units. */
export function postPromoDip(unitsAfter: Num, baselineUnitsSameDays: Num): number | null {
  return lift(unitsAfter, baselineUnitsSameDays);
}

export interface Growth {
  abs: number | null;
  pct: number | null;
}
/** YoY Gross Sales Growth: $ = This year − Last year; % = $ ÷ Last year. */
export function yoyGrowth(ty: Num, ly: Num): Growth {
  return { abs: diff(ty, ly), pct: safeDiv(diff(ty, ly), ly) };
}

// ---------------------------------------------------------------- Shopper (Club Card aggregates)

/** Promo Buyer Spend Change % = promo buyers' spend during the event ÷ their usual spend − 1. */
export function spendChange(spendDuring: Num, usualSpend: Num): number | null {
  return lift(spendDuring, usualSpend);
}

/** Repeat Purchase Rate % = Repeat buyers ÷ Promo Buyer Count. */
export function repeatRate(repeatBuyers: Num, promoBuyers: Num): number | null {
  return safeDiv(repeatBuyers, promoBuyers);
}

/** New-to-Category Buyers % = new-to-category buyers ÷ Promo Buyer Count. */
export function newToCategoryPct(newBuyers: Num, promoBuyers: Num): number | null {
  return safeDiv(newBuyers, promoBuyers);
}
