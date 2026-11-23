/**
 * Event measures: raw sums for one promo event (promo window, baseline window, cannibalization group, category,
 * the 4 weeks after the promo and last year), the aggregation of many events (ratio of totals) and the derivation of every KPI
 * from those totals with the formulas in kpis.ts.
 */
import { AS_OF_DAY, LY_OFFSET_DAYS } from '../data/calendar';
import { CAT_ITEMS, getModel, rangeSum } from '../data/generate';
import { ITEMS, PRICE_GROUPS, type Uom } from '../data/products';
import { EVENTS, FUNDING_TYPES, type FundingType, type PromoEvent } from '../data/promos';
import {
  avgPromoRetail,
  baselineFromWindow,
  cannibalizationRate,
  grossMargin,
  grossMarginPct,
  incremental,
  incrementalGm,
  lift,
  netGrossMargin,
  netIncrementalGm,
  netIncrementalSales,
  postPromoDip,
  safeDiv,
  yoyGrowth,
  type Growth,
} from './kpis';
import { baselineWeeksFor, type BaselineSetting } from './baseline';
import { netGmFunding, promoCost } from './cost';

/** Days after the promo ends that Post-Promo Dip % measures (4-week post-promo window, per the workbook). Level 2 KPI. */
export const POST_PROMO_WINDOW_DAYS = 28;

/**
 * Which items count as the "group" for cannibalization (#3). The workbook KPI rows measure at subcategory (the
 * default); brand, brand-category and category were also proposed. Level and source are pending.
 */
export type CannLevel = 'sub' | 'brand' | 'brandcat' | 'category';
export const DEFAULT_CANN_LEVEL: CannLevel = 'sub';
export const CANN_LEVELS: { id: CannLevel; label: string; tip: string }[] = [
  { id: 'sub', label: 'Subcategory', tip: 'Every other item in the same subcategory (default, as in the workbook KPI rows).' },
  { id: 'brand', label: 'Brand', tip: 'Other items of the same brand, in any category.' },
  { id: 'brandcat', label: 'Brand-category', tip: 'Other items of the same brand in the same category.' },
  { id: 'category', label: 'Category', tip: 'Every other item in the same category.' },
];
/** Sales basis for promo sales, lift, incremental and margin. Default Net Customer Sales. */
export type Basis = 'net' | 'gross';
export const DEFAULT_BASIS: Basis = 'net';

export interface U {
  ea: number;
  lb: number;
}
const u0 = (): U => ({ ea: 0, lb: 0 });
const uAdd = (a: U, b: U): U => ({ ea: a.ea + b.ea, lb: a.lb + b.lb });
const uOf = (uom: Uom, v: number): U => (uom === 'ea' ? { ea: v, lb: 0 } : { ea: 0, lb: v });

/** Additive totals. Every KPI is derived from these, so a total row is always a ratio of totals. */
export interface Agg {
  n: number;
  promoDays: number;
  gross: number;
  net: number;
  cost: number;
  invest: number;
  units: U;
  bGross: number;
  bNet: number;
  bCost: number;
  bUnits: U;
  /** Events whose baseline window was cut short by the start of the data (FY2024). */
  partialBaseline: number;
  /**
   * All vendor promo funding of the events, by type (generated; Vendor Promo Funding $ is not a KPI here, #2).
   * Each allowance is counted once (a CNS store shipment recap is the same allowance as the DC off-invoice one).
   */
  fund: Record<FundingType, number>;
  /** The part of the funding that Net GM $ and Net Incremental GM $ add (#7, by supply source; see cost.ts). */
  fundNetGm: number;
  /** Change vs baseline of the cannibalization group; null on SKU rows (measured for the price group). */
  cGross: number | null;
  cNet: number | null;
  cCost: number | null;
  cUnits: U | null;
  catGross: number | null;
  catNet: number | null;
  catCost: number | null;
  /** Events with a full post-promo ad week, and their units vs baseline. */
  postN: number;
  postUnits: U;
  postBase: U;
  /** Events with last-year history, their gross sales this year and last year. */
  lyN: number;
  lyTy: number;
  ly: number;
  depthSum: number;
}

export function emptyAgg(): Agg {
  return {
    n: 0,
    promoDays: 0,
    gross: 0,
    net: 0,
    cost: 0,
    invest: 0,
    units: u0(),
    bGross: 0,
    bNet: 0,
    bCost: 0,
    bUnits: u0(),
    partialBaseline: 0,
    fund: { scan: 0, bill: 0, other: 0 },
    fundNetGm: 0,
    cGross: 0,
    cNet: 0,
    cCost: 0,
    cUnits: u0(),
    catGross: 0,
    catNet: 0,
    catCost: 0,
    postN: 0,
    postUnits: u0(),
    postBase: u0(),
    lyN: 0,
    lyTy: 0,
    ly: 0,
    depthSum: 0,
  };
}

const addNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

export function addAgg(a: Agg, b: Agg): Agg {
  return {
    n: a.n + b.n,
    promoDays: a.promoDays + b.promoDays,
    gross: a.gross + b.gross,
    net: a.net + b.net,
    cost: a.cost + b.cost,
    invest: a.invest + b.invest,
    units: uAdd(a.units, b.units),
    bGross: a.bGross + b.bGross,
    bNet: a.bNet + b.bNet,
    bCost: a.bCost + b.bCost,
    bUnits: uAdd(a.bUnits, b.bUnits),
    partialBaseline: a.partialBaseline + b.partialBaseline,
    fund: { scan: a.fund.scan + b.fund.scan, bill: a.fund.bill + b.fund.bill, other: a.fund.other + b.fund.other },
    fundNetGm: a.fundNetGm + b.fundNetGm,
    cGross: addNull(a.cGross, b.cGross),
    cNet: addNull(a.cNet, b.cNet),
    cCost: addNull(a.cCost, b.cCost),
    cUnits: a.cUnits && b.cUnits ? uAdd(a.cUnits, b.cUnits) : null,
    catGross: addNull(a.catGross, b.catGross),
    catNet: addNull(a.catNet, b.catNet),
    catCost: addNull(a.catCost, b.catCost),
    postN: a.postN + b.postN,
    postUnits: uAdd(a.postUnits, b.postUnits),
    postBase: uAdd(a.postBase, b.postBase),
    lyN: a.lyN + b.lyN,
    lyTy: a.lyTy + b.lyTy,
    ly: a.ly + b.ly,
    depthSum: a.depthSum + b.depthSum,
  };
}

export function sumAggs(list: Agg[]): Agg {
  return list.reduce(addAgg, emptyAgg());
}

// ---------------------------------------------------------------- One event

export interface EventCtx {
  /** Baseline window in weeks, or 'byType' for the proposed default of each event's promo type (#4). */
  baselineWeeks: BaselineSetting;
  level: CannLevel;
  /** Items that pass the product filters (SKU, vendor / brand, pasted UPCs); null = every item. */
  itemMask: Uint8Array | null;
  /** Share of chain volume in the selected stores, by department; null = whole chain. */
  storeShare: Float64Array | null;
}

interface Sums {
  units: number;
  gross: number;
  net: number;
  cost: number;
  invest: number;
}
function sums(items: number[], from: number, to: number): Sums {
  const m = getModel();
  const s: Sums = { units: 0, gross: 0, net: 0, cost: 0, invest: 0 };
  for (const i of items) {
    s.units += rangeSum(m.units, i, from, to);
    s.gross += rangeSum(m.gross, i, from, to);
    s.net += rangeSum(m.net, i, from, to);
    s.cost += rangeSum(m.cost, i, from, to);
    s.invest += rangeSum(m.invest, i, from, to);
  }
  return s;
}

/** Baseline window: the N weeks (7N days) right before the event, clipped to the start of the data. */
export function baselineWindow(e: Pick<PromoEvent, 'start'>, weeks: number): { from: number; to: number; days: number; partial: boolean } {
  const to = e.start - 1;
  const wanted = e.start - weeks * 7;
  const from = Math.max(0, wanted);
  return { from, to, days: Math.max(0, to - from + 1), partial: wanted < 0 };
}

/** Weeks of the baseline window for an event under the current setting. */
export function eventBaselineWeeks(e: Pick<PromoEvent, 'type'>, ctx: Pick<EventCtx, 'baselineWeeks'>): number {
  return baselineWeeksFor(e.type, ctx.baselineWeeks);
}

/** Items of the cannibalization group: same unit of measure, not in the promoted price group. */
export function cannGroup(e: Pick<PromoEvent, 'pg'>, level: CannLevel): number[] {
  const pg = PRICE_GROUPS[e.pg];
  const pool = level === 'brand' ? ITEMS.filter((i) => i.brand === pg.brand).map((i) => i.idx) : CAT_ITEMS[pg.cat];
  return pool.filter(
    (i) =>
      ITEMS[i].pg !== pg.idx &&
      ITEMS[i].uom === pg.uom &&
      (level !== 'brandcat' || ITEMS[i].brand === pg.brand) &&
      (level !== 'sub' || ITEMS[i].sub === pg.sub),
  );
}

/** Promo-window total minus its baseline, for a group of items. */
function change(items: number[], e: PromoEvent, bw: ReturnType<typeof baselineWindow>, promoDays: number) {
  const p = sums(items, e.start, e.end);
  const b = sums(items, bw.from, bw.to);
  const base = (v: number) => baselineFromWindow(v, bw.days, promoDays) ?? 0;
  return { gross: p.gross - base(b.gross), net: p.net - base(b.net), cost: p.cost - base(b.cost), units: p.units - base(b.units) };
}

/**
 * Category Sales and Category Units lift of an event (Hot Buy Score): the whole category, promoted items included, during
 * the promo vs. its baseline window scaled to the promo days. Units count only the category items with the promoted
 * price group's unit of measure (each and pounds are never added). Store shares cancel out in a ratio.
 */
export function categoryLifts(e: PromoEvent, ctx: Pick<EventCtx, 'baselineWeeks'>, basis: Basis = DEFAULT_BASIS): { sales: number | null; units: number | null } {
  const pg = PRICE_GROUPS[e.pg];
  const end = Math.min(e.end, AS_OF_DAY);
  const days = end - e.start + 1;
  const bw = baselineWindow(e, eventBaselineWeeks(e, ctx));
  const items = CAT_ITEMS[pg.cat];
  const sameUom = items.filter((i) => ITEMS[i].uom === pg.uom);
  const p = sums(items, e.start, end);
  const b = sums(items, bw.from, bw.to);
  const base = (v: number) => baselineFromWindow(v, bw.days, days);
  return {
    sales: basis === 'net' ? lift(p.net, base(b.net)) : lift(p.gross, base(b.gross)),
    units: lift(sums(sameUom, e.start, end).units, base(sums(sameUom, bw.from, bw.to).units)),
  };
}

/**
 * Totals for one event. With `onlyItem`, totals for that SKU only: cannibalization and category change are
 * measured for the price group, so a SKU row carries null there.
 */
export function eventAgg(e: PromoEvent, ctx: EventCtx, onlyItem?: number): Agg {
  const pg = PRICE_GROUPS[e.pg];
  const items = onlyItem !== undefined ? [onlyItem] : pg.items.filter((i) => !ctx.itemMask || ctx.itemMask[i]);
  const f = ctx.storeShare ? ctx.storeShare[pg.dept] : 1;
  const end = Math.min(e.end, AS_OF_DAY);
  const days = end - e.start + 1;
  const p = sums(items, e.start, end);
  const bw = baselineWindow(e, eventBaselineWeeks(e, ctx));
  const b = sums(items, bw.from, bw.to);
  const base = (v: number) => (baselineFromWindow(v, bw.days, days) ?? 0) * f;
  const fund: Record<FundingType, number> = { scan: 0, bill: 0, other: 0 };
  for (const t of FUNDING_TYPES) fund[t.id] = p.invest * e.fundingRate * (e.fundingMix[t.id] ?? 0) * f;

  const a = emptyAgg();
  a.n = 1;
  a.promoDays = days;
  a.gross = p.gross * f;
  a.net = p.net * f;
  // Cost basis by supply source (#15): DC average cost minus scan-downs, DSD replacement cost.
  a.cost = promoCost(pg.source, p.cost * f, fund.scan);
  a.invest = p.invest * f;
  a.units = uOf(pg.uom, p.units * f);
  a.bGross = base(b.gross);
  a.bNet = base(b.net);
  a.bCost = base(b.cost);
  a.bUnits = uOf(pg.uom, base(b.units));
  a.partialBaseline = bw.partial ? 1 : 0;
  a.fund = fund;
  a.fundNetGm = netGmFunding(pg.source, fund);
  a.depthSum = e.depth;

  if (onlyItem === undefined) {
    const c = change(cannGroup(e, ctx.level), e, bw, days);
    a.cGross = c.gross * f;
    a.cNet = c.net * f;
    a.cCost = c.cost * f;
    a.cUnits = uOf(pg.uom, c.units * f);
    const cat = change(CAT_ITEMS[pg.cat], e, bw, days);
    a.catGross = cat.gross * f;
    a.catNet = cat.net * f;
    a.catCost = cat.cost * f;
  } else {
    a.cGross = a.cNet = a.cCost = a.catGross = a.catNet = a.catCost = null;
    a.cUnits = null;
  }

  // Post-Promo Dip % needs the whole 4-week window; until it has passed the event carries no post-promo data (—).
  if (e.end + POST_PROMO_WINDOW_DAYS <= AS_OF_DAY) {
    const after = sums(items, e.end + 1, e.end + POST_PROMO_WINDOW_DAYS);
    a.postN = 1;
    a.postUnits = uOf(pg.uom, after.units * f);
    a.postBase = uOf(pg.uom, (baselineFromWindow(b.units, bw.days, POST_PROMO_WINDOW_DAYS) ?? 0) * f);
  }
  if (e.start - LY_OFFSET_DAYS >= 0) {
    a.lyN = 1;
    a.lyTy = a.gross;
    a.ly = sums(items, e.start - LY_OFFSET_DAYS, end - LY_OFFSET_DAYS).gross * f;
  }
  return a;
}

/** Daily series for charts: promo items' sales and units per day over [from, to], plus the baseline daily average. */
export function dailySeries(e: PromoEvent, ctx: EventCtx, from: number, to: number, onlyItem?: number) {
  const pg = PRICE_GROUPS[e.pg];
  const items = onlyItem !== undefined ? [onlyItem] : pg.items.filter((i) => !ctx.itemMask || ctx.itemMask[i]);
  const f = ctx.storeShare ? ctx.storeShare[pg.dept] : 1;
  const bw = baselineWindow(e, eventBaselineWeeks(e, ctx));
  const b = sums(items, bw.from, bw.to);
  const per = (v: number) => (baselineFromWindow(v, bw.days, 1) ?? 0) * f;
  const out: { day: number; gross: number; net: number; units: number }[] = [];
  for (let d = Math.max(0, from); d <= Math.min(AS_OF_DAY, to); d++) {
    const s = sums(items, d, d);
    out.push({ day: d, gross: s.gross * f, net: s.net * f, units: s.units * f });
  }
  return { days: out, baseline: { gross: per(b.gross), net: per(b.net), units: per(b.units) }, window: bw };
}

// ---------------------------------------------------------------- KPIs from totals

export interface ByUom {
  ea: number | null;
  lb: number | null;
}

export interface Metrics {
  events: number;
  gross: number;
  net: number;
  /** Promo Sales $ on the selected basis. */
  sales: number;
  units: U;
  baseSales: number;
  baseUnits: U;
  incSales: number | null;
  incUnits: ByUom;
  salesLift: number | null;
  unitLift: ByUom;
  gm: number | null;
  gmPct: number | null;
  baseGm: number | null;
  incGm: number | null;
  /** Vendor funding added by Net GM $ and Net Incremental GM $ (#7, by supply source), not shown as a KPI. */
  funding: number;
  netGm: number | null;
  cannSales: number | null;
  cannGm: number | null;
  cannRate: ByUom;
  catIncSales: number | null;
  catIncGm: number | null;
  netIncSales: number | null;
  netIncGm: number | null;
  avgRetail: ByUom;
  avgDepth: number | null;
  ly: number | null;
  yoy: Growth;
  dip: ByUom;
  partialBaseline: number;
}

const byUom = (fn: (k: Uom) => number | null): ByUom => ({ ea: fn('ea'), lb: fn('lb') });

export function derive(a: Agg, basis: Basis): Metrics {
  const sales = basis === 'net' ? a.net : a.gross;
  const baseSales = basis === 'net' ? a.bNet : a.bGross;
  const cSales = basis === 'net' ? a.cNet : a.cGross;
  const catSales = basis === 'net' ? a.catNet : a.catGross;
  const gm = grossMargin(sales, a.cost);
  const baseGm = grossMargin(baseSales, a.bCost);
  const incGm = incrementalGm(gm, baseGm);
  const funding = a.fundNetGm;
  const cannGm = cSales === null || a.cCost === null ? null : cSales - a.cCost;
  const incSales = incremental(sales, baseSales);
  const netIncGm = netIncrementalGm(incGm, cannGm, funding);
  const has = (k: Uom) => a.units[k] > 0 || a.bUnits[k] > 0;
  const incU = (k: Uom) => (has(k) ? incremental(a.units[k], a.bUnits[k]) : null);
  return {
    events: a.n,
    gross: a.gross,
    net: a.net,
    sales,
    units: a.units,
    baseSales,
    baseUnits: a.bUnits,
    incSales,
    incUnits: byUom(incU),
    salesLift: lift(sales, baseSales),
    unitLift: byUom((k) => (has(k) ? lift(a.units[k], a.bUnits[k]) : null)),
    gm,
    gmPct: grossMarginPct(gm, sales),
    baseGm,
    incGm,
    funding,
    netGm: netGrossMargin(gm, funding),
    cannSales: cSales,
    cannGm,
    cannRate: byUom((k) => (a.cUnits && has(k) ? cannibalizationRate(a.cUnits[k], incU(k)) : null)),
    catIncSales: catSales,
    catIncGm: catSales === null || a.catCost === null ? null : catSales - a.catCost,
    netIncSales: netIncrementalSales(incSales, cSales),
    netIncGm,
    avgRetail: byUom((k) => (a.units[k] > 0 && !(a.units.ea > 0 && a.units.lb > 0) ? avgPromoRetail(sales, a.units[k]) : null)),
    avgDepth: safeDiv(a.depthSum, a.n),
    ly: a.lyN > 0 ? a.ly : null,
    yoy: a.lyN > 0 ? yoyGrowth(a.lyTy, a.ly) : { abs: null, pct: null },
    dip: byUom((k) => (a.postN > 0 && a.postBase[k] > 0 ? postPromoDip(a.postUnits[k], a.postBase[k]) : null)),
    partialBaseline: a.partialBaseline,
  };
}

/** Convenience: KPIs for a list of events. */
export function metricsOf(events: number[], ctx: EventCtx, basis: Basis): Metrics {
  return derive(sumAggs(events.map((i) => eventAgg(EVENTS[i], ctx))), basis);
}
