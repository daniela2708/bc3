/**
 * Promo Shopper Impact, proposals A and B: the new metrics the team reads today in the Hot Buy recap, calculated here
 * from Weis aggregates only (club card and T-log totals per event or category, never a customer or card).
 *
 * - Brand share gain and promo intensity are calculated from the item × day sales and the promo calendar.
 * - Where buyers came from and multi-item baskets come from the event's club card aggregates.
 * - Also bought (category over-index and co-purchased promotions of the same ad) needs basket-level affinity that the
 *   prototype does not hold, so it is simulated with a seeded, deterministic aggregate; production reads it from the
 *   Weis T-log baskets.
 */
import { adWeekOfDay, AS_OF_DAY } from '../data/calendar';
import { CAT_ITEMS } from '../data/generate';
import { hash01 } from '../data/prng';
import { CATS, ITEMS, PRICE_GROUPS } from '../data/products';
import { EVENTS, type PromoEvent } from '../data/promos';
import { safeDiv } from './kpis';
import { baselineWindow, eventBaselineWeeks, sums, type EventCtx } from './metrics';
import type { ShopperAgg } from './shopper';

export const NEW_METRIC_CHIP = 'New metric · definition pending';
export const NEW_METRIC_INFO =
  'Not in the KPI sheet: it comes from the views the team uses today in the Hot Buy recap, calculated here with Weis data (club card and T-log aggregates only).';

/**
 * Brand share gain: the promoted brand's share of category sales (Net Customer Sales) during the event minus its share
 * before (the baseline window), in share points (0.031 = +3.1 points). Null when the category sold nothing.
 */
export function brandShare(e: PromoEvent, ctx: Pick<EventCtx, 'baselineWeeks'>): { before: number | null; during: number | null; gain: number | null } {
  const pg = PRICE_GROUPS[e.pg];
  const cat = CAT_ITEMS[pg.cat];
  const brand = cat.filter((i) => ITEMS[i].brand === pg.brand);
  const end = Math.min(e.end, AS_OF_DAY);
  const bw = baselineWindow(e, eventBaselineWeeks(e, ctx));
  const before = bw.days > 0 ? safeDiv(sums(brand, bw.from, bw.to).net, sums(cat, bw.from, bw.to).net) : null;
  const during = safeDiv(sums(brand, e.start, end).net, sums(cat, e.start, end).net);
  return { before, during, gain: before === null || during === null ? null : during - before };
}

export interface BuyerSources {
  /** No category purchase in the 52-week look-back (the dashboard's New-to-Category Buyers %). */
  newToCategory: number;
  /** Already bought the promoted item (the same buyers' usual, capped by what is left). */
  existing: number;
  /** Bought the category but another brand before: the rest. */
  switched: number;
}

/** Where promo buyers came from: three shares that always add up to 100 %. Null with no buyers. */
export function buyerSources(s: Pick<ShopperAgg, 'buyers' | 'usualBuyers' | 'newBuyers'>): BuyerSources | null {
  if (!(s.buyers > 0)) return null;
  const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  const newToCategory = clamp(s.newBuyers / s.buyers);
  const existing = Math.min(1 - newToCategory, clamp(s.usualBuyers / s.buyers));
  return { newToCategory, existing, switched: 1 - newToCategory - existing };
}

/**
 * Share of baskets with 2 or more units of the promoted items, from the average units per basket u: the extra units
 * of a basket are taken as Poisson(u − 1), so P(2 or more) = 1 − e^−(u − 1). Null with no basket.
 */
export function multiUnitShare(units: number, baskets: number): number | null {
  const u = safeDiv(units, baskets);
  if (u === null || !Number.isFinite(u)) return null;
  return u <= 1 ? 0 : 1 - Math.exp(-(u - 1));
}

/** Multi-item baskets before (the same buyers' usual) and during the event. */
export function multiItemBaskets(s: Pick<ShopperAgg, 'promoUnits' | 'txns' | 'usualPromoUnits' | 'usualTxns'>): { before: number | null; during: number | null } {
  return { before: multiUnitShare(s.usualPromoUnits, s.usualTxns), during: multiUnitShare(s.promoUnits, s.txns) };
}

/** Also bought: other categories in the event's baskets, as an index vs. their share of all baskets (100 = average). */
export function alsoBoughtCategories(e: PromoEvent, n = 5): { cat: number; label: string; index: number }[] {
  const pg = PRICE_GROUPS[e.pg];
  return CATS.filter((c) => c.idx !== pg.cat)
    .map((c) => {
      const sameDept = c.dept === pg.dept ? 0.35 : 0;
      return { cat: c.idx, label: c.name, index: Math.round(100 * (0.75 + sameDept + 0.6 * hash01(e.pg, c.idx, 731))) };
    })
    .sort((a, b) => b.index - a.index || a.label.localeCompare(b.label))
    .slice(0, n);
}

/** Also bought: the other promotions of the same ad week most often in the event's baskets (share of its baskets). */
export function sameAdPromos(e: PromoEvent, n = 5): { event: number; label: string; share: number }[] {
  const aw = adWeekOfDay(e.start);
  const pg = PRICE_GROUPS[e.pg];
  return EVENTS.filter((o) => o.idx !== e.idx && o.pg !== e.pg && adWeekOfDay(o.start) === aw)
    .map((o) => {
      const sameCat = PRICE_GROUPS[o.pg].cat === pg.cat ? 0.05 : 0;
      return { event: o.idx, label: PRICE_GROUPS[o.pg].name, share: 0.015 + sameCat + 0.12 * hash01(e.idx, o.idx, 733) };
    })
    .sort((a, b) => b.share - a.share || a.event - b.event)
    .slice(0, n);
}

/**
 * Promo intensity of a category: the average share of its items on offer per day of the period (item-days with any
 * promotion of any type ÷ item-days of the period). A day counts once per item even when promotions overlap. Every item
 * of the category counts, whatever the product filters. Null with no item or an empty period.
 */
export function categoryIntensity(cat: number, from: number, to: number): number | null {
  const items = CAT_ITEMS[cat];
  const days = to - from + 1;
  if (items.length === 0 || days <= 0) return null;
  const onOffer = new Map<number, Set<number>>();
  for (const ev of EVENTS) {
    if (ev.start > to || ev.end < from || PRICE_GROUPS[ev.pg].cat !== cat) continue;
    for (const i of PRICE_GROUPS[ev.pg].items) {
      const set = onOffer.get(i) ?? new Set<number>();
      for (let d = Math.max(ev.start, from); d <= Math.min(ev.end, to); d++) set.add(d);
      onOffer.set(i, set);
    }
  }
  let itemDays = 0;
  for (const set of onOffer.values()) itemDays += set.size;
  return itemDays / (items.length * days);
}
