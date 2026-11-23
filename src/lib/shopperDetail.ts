/** Promo Shopper Impact proposal A: category-level promotion intensity. */
import { CAT_ITEMS } from '../data/generate';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';

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
