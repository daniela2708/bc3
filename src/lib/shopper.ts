/**
 * Promo Shopper Impact: club card AGGREGATES per promo event (Item-Promo Event grain, weekly refresh). There is no
 * customer- or card-level record anywhere in the prototype: each event carries only the totals below, derived from
 * the event's promo and baseline volume plus seeded ratios.
 */
import { AS_OF_DAY } from '../data/calendar';
import { hash01, hashSigned } from '../data/prng';
import { DEPTS, PRICE_GROUPS } from '../data/products';
import { EVENTS, type PromoEvent } from '../data/promos';
import { STORES } from '../data/stores';
import { newToCategoryPct, repeatRate, safeDiv, spendChange } from './kpis';
import { eventAgg, eventBaselineWeeks, type EventCtx } from './metrics';

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
  basketDollars: number;
  usualBasketDollars: number;
  basketUnits: number;
  usualBasketUnits: number;
  spend: number;
  usualSpend: number;
  newBuyers: number;
  catTrips: number;
  usualCatTrips: number;
  storeTxns: number;
  /** Repeat buyers and the promo buyers of events old enough to measure them. */
  repeat: number;
  repeatBase: number;
}

export function emptyShopper(): ShopperAgg {
  return { n: 0, buyers: 0, usualBuyers: 0, txns: 0, usualTxns: 0, basketDollars: 0, usualBasketDollars: 0, basketUnits: 0, usualBasketUnits: 0, spend: 0, usualSpend: 0, newBuyers: 0, catTrips: 0, usualCatTrips: 0, storeTxns: 0, repeat: 0, repeatBase: 0 };
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
  return {
    n: 1,
    buyers,
    usualBuyers,
    txns,
    usualTxns,
    basketDollars: txns * basket,
    usualBasketDollars: usualTxns * usualBasket,
    basketUnits: txns * upb,
    usualBasketUnits: usualTxns * usualUpb,
    spend: buyers * tripsPerBuyer * basket,
    usualSpend: buyers * (1.02 + 0.06 * h(13)) * usualBasket,
    newBuyers: buyers * Math.min(0.4, 0.05 + 0.22 * e.depth + 0.06 * h(14)),
    catTrips: buyers * catTripsPer,
    usualCatTrips: buyers * usualCatTripsPer,
    storeTxns,
    repeat: measurable ? buyers * rate : 0,
    repeatBase: measurable ? buyers : 0,
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
  spendChange: number | null;
  upb: number | null;
  usualUpb: number | null;
  upbChange: number | null;
  newToCat: number | null;
  catTrips: number;
  usualCatTrips: number;
  catTripsChange: number | null;
  storeTxns: number;
  repeatRate: number | null;
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
    spendChange: spendChange(s.spend, s.usualSpend),
    upb,
    usualUpb,
    upbChange: ch(upb, usualUpb),
    newToCat: newToCategoryPct(s.newBuyers, s.buyers),
    catTrips: s.catTrips,
    usualCatTrips: s.usualCatTrips,
    catTripsChange: ch(s.catTrips, s.usualCatTrips),
    storeTxns: s.storeTxns,
    repeatRate: s.repeatBase > 0 ? repeatRate(s.repeat, s.repeatBase) : null,
  };
}

/** Shopper KPIs for many events. Transaction Count uses the union of promo days. */
export function shopperOf(events: number[], ctx: EventCtx): ShopperMetrics {
  const s = events.reduce((acc, i) => addShopper(acc, eventShopper(EVENTS[i], ctx)), emptyShopper());
  return deriveShopper({ ...s, storeTxns: storeTxnsOf(events) });
}
