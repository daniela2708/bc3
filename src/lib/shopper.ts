/**
 * Promo Shopper Impact: club card AGGREGATES per promo event (Item-Promo Event grain, weekly refresh). There is no
 * customer- or card-level record anywhere in the prototype: each event carries only the totals below, derived from
 * the event's promo and baseline volume plus seeded ratios.
 */
import { AS_OF_DAY, LY_OFFSET_DAYS } from '../data/calendar';
import { getModel, rangeSum } from '../data/generate';
import { hash01, hashSigned } from '../data/prng';
import { DEPTS, PRICE_GROUPS } from '../data/products';
import { EVENTS, type PromoEvent } from '../data/promos';
import { STORES } from '../data/stores';
import { newToCategoryPct, repeatRate, safeDiv, spendChange } from './kpis';
import { eventAgg, eventBaselineWeeks, POST_PROMO_WINDOW_DAYS, type EventCtx } from './metrics';

const CLUB_SHARE = 0.78;
/** Days after the promo needed to measure repeat purchases at regular price. */
export const REPEAT_WINDOW_DAYS = 28;

export interface ShopperAgg {
  n: number;
  buyers: number;
  usualBuyers: number;
  /** Transactions that include the promo item, during the event and over the same number of usual days. */
  txns: number;
  usualTxns: number;
  /** Units of the promoted items in those transactions, during the event and over the same number of usual days. */
  promoUnits: number;
  usualPromoUnits: number;
  basketDollars: number;
  usualBasketDollars: number;
  basketUnits: number;
  usualBasketUnits: number;
  spend: number;
  usualSpend: number;
  newBuyers: number;
  /** Promo buyers with no category purchase in the 4 weeks before the event (Hot Buy Score window). */
  newBuyers4w: number;
  catTrips: number;
  usualCatTrips: number;
  storeTxns: number;
  /** Repeat buyers and the promo buyers of events old enough to measure them. */
  repeat: number;
  repeatBase: number;
  /**
   * Proposals for review (Shopper Impact layouts A and B), same club card aggregates: promo buyers over the same
   * number of days right before the event ("previous week" for a one-week Hot Buy), and over the same days last
   * year (events with last-year data only, with this year's buyers of those events); and the 4 weeks after the
   * promo scaled to the promo days (events whose 4 weeks have passed).
   */
  prevBuyers: number;
  lyBuyers: number;
  lyTyBuyers: number;
  afterN: number;
  afterBuyers: number;
  afterTxns: number;
  afterBasketDollars: number;
}

export function emptyShopper(): ShopperAgg {
  return { n: 0, buyers: 0, usualBuyers: 0, txns: 0, usualTxns: 0, promoUnits: 0, usualPromoUnits: 0, basketDollars: 0, usualBasketDollars: 0, basketUnits: 0, usualBasketUnits: 0, spend: 0, usualSpend: 0, newBuyers: 0, newBuyers4w: 0, catTrips: 0, usualCatTrips: 0, storeTxns: 0, repeat: 0, repeatBase: 0, prevBuyers: 0, lyBuyers: 0, lyTyBuyers: 0, afterN: 0, afterBuyers: 0, afterTxns: 0, afterBasketDollars: 0 };
}

export function addShopper(a: ShopperAgg, b: ShopperAgg): ShopperAgg {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof ShopperAgg)[]) out[k] = a[k] + b[k];
  return out;
}

/** Chain store transactions on one day (store traffic). */
export function dailyStoreTxns(day: number): number {
  return STORES.length * 2300 * (0.96 + 0.08 * hash01(day, 911));
}

/**
 * Store transactions over the UNION of the events' promo days: events overlap in time, so adding each event's
 * Transaction Count would count the same store traffic more than once.
 */
export function storeTxnsOf(events: number[]): number {
  const days = new Set<number>();
  for (const i of events) for (let d = EVENTS[i].start; d <= Math.min(EVENTS[i].end, AS_OF_DAY); d++) days.add(d);
  let t = 0;
  for (const d of days) t += dailyStoreTxns(d);
  return t;
}

export function eventShopper(e: PromoEvent, ctx: EventCtx): ShopperAgg {
  const a = eventAgg(e, { ...ctx, storeShare: null });
  const pg = PRICE_GROUPS[e.pg];
  const k = e.idx;
  const h = (n: number) => hash01(k, 900 + n);
  const units = a.units.ea + a.units.lb;
  const usualUnits = a.bUnits.ea + a.bUnits.lb;
  const perTxn = pg.uom === 'lb' ? 2.4 + 0.8 * h(1) : 1.5 + 0.6 * h(1);
  const usualPerTxn = perTxn * (0.88 + 0.06 * h(2));
  const txns = units / perTxn;
  const usualTxns = usualUnits / usualPerTxn;
  const tripsPerBuyer = 1.1 + 0.15 * h(3);
  const buyers = (txns * CLUB_SHARE) / tripsPerBuyer;
  const usualBuyers = (usualTxns * CLUB_SHARE) / (1.05 + 0.1 * h(4));
  const usualBasket = DEPTS[pg.dept].basket * (0.92 + 0.16 * h(5)) * (1 + 0.01 * hashSigned(k, eventBaselineWeeks(e, ctx), 6));
  const liftCap = Math.min(2, e.lift);
  const basket = usualBasket * (1 + 0.02 + 0.045 * liftCap + 0.03 * hashSigned(k, 7) - 0.05 * e.dip);
  const usualUpb = 13 + 8 * h(8);
  const upb = usualUpb * (1 + 0.03 + 0.04 * liftCap + 0.03 * hashSigned(k, 9));
  const catTripsPer = 1.25 + 0.3 * h(10);
  const usualCatTripsPer = catTripsPer / (1 + 0.04 + 0.07 * liftCap);
  const storeTxns = storeTxnsOf([e.idx]);
  const measurable = e.end + REPEAT_WINDOW_DAYS <= AS_OF_DAY;
  const rate = Math.min(0.6, Math.max(0.08, 0.5 - 0.45 * e.dip - 0.3 * e.depth + 0.06 * hashSigned(k, 12)));
  // Other windows (layout proposals): buyers from the units sold, with the same "usual" ratios as usualBuyers.
  const items = pg.items.filter((i) => !ctx.itemMask || ctx.itemMask[i]);
  const unitsIn = (from: number, to: number) => items.reduce((s, i) => s + rangeSum(getModel().units, i, from, to), 0);
  const usualTxnsPerBuyer = 1.05 + 0.1 * h(4);
  const buyersOf = (u: number) => (u / usualPerTxn) * (CLUB_SHARE / usualTxnsPerBuyer);
  const days = Math.min(e.end, AS_OF_DAY) - e.start + 1;
  const hasLy = e.start - LY_OFFSET_DAYS >= 0;
  const hasAfter = e.end + POST_PROMO_WINDOW_DAYS <= AS_OF_DAY;
  const afterUnits = hasAfter ? (unitsIn(e.end + 1, e.end + POST_PROMO_WINDOW_DAYS) * days) / POST_PROMO_WINDOW_DAYS : 0;
  const afterBasket = usualBasket * (0.97 + 0.04 * h(15));
  return {
    n: 1,
    buyers,
    usualBuyers,
    txns,
    usualTxns,
    promoUnits: units,
    usualPromoUnits: usualUnits,
    basketDollars: txns * basket,
    usualBasketDollars: usualTxns * usualBasket,
    basketUnits: txns * upb,
    usualBasketUnits: usualTxns * usualUpb,
    spend: buyers * tripsPerBuyer * basket,
    usualSpend: buyers * (1.02 + 0.06 * h(13)) * usualBasket,
    newBuyers: buyers * Math.min(0.4, 0.05 + 0.22 * e.depth + 0.06 * h(14)),
    // A 4-week look-back finds more buyers "new" to the category than the 52-week one.
    newBuyers4w: buyers * Math.min(0.7, 0.05 + 0.22 * e.depth + 0.06 * h(14) + 0.12 + 0.1 * h(16)),
    catTrips: buyers * catTripsPer,
    usualCatTrips: buyers * usualCatTripsPer,
    storeTxns,
    repeat: measurable ? buyers * rate : 0,
    repeatBase: measurable ? buyers : 0,
    prevBuyers: buyersOf(unitsIn(e.start - days, e.start - 1)),
    lyBuyers: hasLy ? buyersOf(unitsIn(e.start - LY_OFFSET_DAYS, e.start + days - 1 - LY_OFFSET_DAYS)) : 0,
    lyTyBuyers: hasLy ? buyers : 0,
    afterN: hasAfter ? 1 : 0,
    afterBuyers: hasAfter ? buyersOf(afterUnits) : 0,
    afterTxns: hasAfter ? afterUnits / usualPerTxn : 0,
    afterBasketDollars: hasAfter ? (afterUnits / usualPerTxn) * afterBasket : 0,
  };
}

export interface ShopperMetrics {
  events: number;
  buyers: number;
  usualBuyers: number;
  buyersChange: number | null;
  basket: number | null;
  usualBasket: number | null;
  basketChange: number | null;
  /** Baskets (transactions) that include the promoted items vs. usual: Basket Lift of the Hot Buy Score. */
  txnsChange: number | null;
  spendChange: number | null;
  upb: number | null;
  usualUpb: number | null;
  upbChange: number | null;
  newToCat: number | null;
  /** New-to-Category share with the Hot Buy Score's 4-week look-back. */
  newToCat4w: number | null;
  catTrips: number;
  usualCatTrips: number;
  catTripsChange: number | null;
  storeTxns: number;
  repeatRate: number | null;
  /** Promo Buyer Count vs. the same number of days right before the event (the previous week for a one-week Hot Buy). */
  buyersVsPrev: number | null;
  /** Promo Buyer Count vs. the same days last year (events with last-year data). */
  buyersVsLy: number | null;
  /** Promo buyers over the 4 weeks after the promo, scaled to the promo days; null until they have passed. */
  afterBuyers: number | null;
  afterBasket: number | null;
}

export function deriveShopper(s: ShopperAgg): ShopperMetrics {
  const basket = safeDiv(s.basketDollars, s.txns);
  const usualBasket = safeDiv(s.usualBasketDollars, s.usualTxns);
  const upb = safeDiv(s.basketUnits, s.txns);
  const usualUpb = safeDiv(s.usualBasketUnits, s.usualTxns);
  const ch = (a: number | null, b: number | null) => (a === null || b === null ? null : safeDiv(a - b, b));
  return {
    events: s.n,
    buyers: s.buyers,
    usualBuyers: s.usualBuyers,
    buyersChange: ch(s.buyers, s.usualBuyers),
    basket,
    usualBasket,
    basketChange: ch(basket, usualBasket),
    txnsChange: ch(s.txns, s.usualTxns),
    spendChange: spendChange(s.spend, s.usualSpend),
    upb,
    usualUpb,
    upbChange: ch(upb, usualUpb),
    newToCat: newToCategoryPct(s.newBuyers, s.buyers),
    newToCat4w: newToCategoryPct(s.newBuyers4w, s.buyers),
    catTrips: s.catTrips,
    usualCatTrips: s.usualCatTrips,
    catTripsChange: ch(s.catTrips, s.usualCatTrips),
    storeTxns: s.storeTxns,
    repeatRate: s.repeatBase > 0 ? repeatRate(s.repeat, s.repeatBase) : null,
    buyersVsPrev: ch(s.buyers, s.n > 0 ? s.prevBuyers : null),
    buyersVsLy: s.lyBuyers > 0 ? ch(s.lyTyBuyers, s.lyBuyers) : null,
    afterBuyers: s.afterN > 0 ? s.afterBuyers : null,
    afterBasket: s.afterN > 0 ? safeDiv(s.afterBasketDollars, s.afterTxns) : null,
  };
}

/** Shopper KPIs for many events. Transaction Count uses the union of promo days. */
export function shopperOf(events: number[], ctx: EventCtx): ShopperMetrics {
  const s = events.reduce((acc, i) => addShopper(acc, eventShopper(EVENTS[i], ctx)), emptyShopper());
  return deriveShopper({ ...s, storeTxns: storeTxnsOf(events) });
}
