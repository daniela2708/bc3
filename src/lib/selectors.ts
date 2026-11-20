/**
 * Scope: which events and items the current filters select, and the context the metrics need. Filters that a
 * view does not use (greyed out) are ignored here, so a hidden filter can never change a number.
 */
import { DEPTS, ITEMS, PRICE_GROUPS } from '../data/products';
import { depthBandOf, EVENTS, type PromoType } from '../data/promos';
import { STORES } from '../data/stores';
import { STORE_SHARE } from '../data/generate';
import { effectiveTime, promoTypesFor, resolveTime, usesFilter, type FilterState, type ResolvedRange } from './filters';
import type { EventCtx } from './metrics';
import { effectiveBaseline } from './baseline';

export interface Scope {
  range: ResolvedRange;
  events: number[];
  ctx: EventCtx;
  /** True when a product filter narrows the items inside a price group (SKU, vendor / brand, pasted list). */
  itemFiltered: boolean;
  types: PromoType[];
}

/** Items that pass the product filters, or null when none of them is set. */
export function itemMaskOf(s: FilterState): Uint8Array | null {
  const on = (k: Parameters<typeof usesFilter>[1]) => usesFilter(s.tab, k);
  const dept = on('dept') ? s.dept : -1;
  const cat = on('cat') ? s.cat : -1;
  const sub = on('sub') ? s.sub : -1;
  const item = on('item') ? s.item : -1;
  const vb = on('vb') ? s.vb : '';
  const codes = on('pg') ? s.codes : [];
  if (dept < 0 && cat < 0 && sub < 0 && item < 0 && !vb && codes.length === 0) return null;
  const codeSet = new Set(codes);
  const mask = new Uint8Array(ITEMS.length);
  for (const it of ITEMS) {
    if (dept >= 0 && it.dept !== dept) continue;
    if (cat >= 0 && it.cat !== cat) continue;
    if (sub >= 0 && it.sub !== sub) continue;
    if (item >= 0 && it.idx !== item) continue;
    if (vb.startsWith('v:') && it.vendor !== Number(vb.slice(2))) continue;
    if (vb.startsWith('b:') && it.brand !== Number(vb.slice(2))) continue;
    if (codeSet.size && !codeSet.has(it.idx)) continue;
    mask[it.idx] = 1;
  }
  return mask;
}

/** Department share of chain volume in the selected stores; null for the whole chain. */
export function storeShareOf(s: FilterState): Float64Array | null {
  if (!usesFilter(s.tab, 'location')) return null;
  if (s.region === 0 && s.districts.length === 0 && s.stores.length === 0) return null;
  const dSet = new Set(s.districts);
  const sSet = new Set(s.stores);
  const all = dSet.size === 0 && sSet.size === 0;
  const out = new Float64Array(DEPTS.length);
  for (const st of STORES) {
    if (s.region > 0 && st.region !== s.region) continue;
    if (!all && !dSet.has(st.district) && !sSet.has(st.id)) continue;
    for (let d = 0; d < DEPTS.length; d++) out[d] += STORE_SHARE[d][st.idx];
  }
  return out;
}

/** Events that match every filter except Promo Event (used to list the Promo Event options). */
export function candidateEvents(s: FilterState, range: ResolvedRange, mask: Uint8Array | null): number[] {
  const on = (k: Parameters<typeof usesFilter>[1]) => usesFilter(s.tab, k);
  const allowed = promoTypesFor(s.tab);
  const types = on('promoType') && s.promoType !== 'all' && allowed.includes(s.promoType) ? [s.promoType] : allowed;
  const out: number[] = [];
  for (const e of EVENTS) {
    if (e.start < range.start || e.start > range.end) continue;
    if (!types.includes(e.type)) continue;
    if (on('pg') && s.pg >= 0 && e.pg !== s.pg) continue;
    if (on('adType') && s.adType !== 'all' && e.adType !== s.adType) continue;
    if (on('depthBand') && s.depthBand !== 'all' && depthBandOf(e.depth) !== s.depthBand) continue;
    if (mask && !PRICE_GROUPS[e.pg].items.some((i) => mask[i])) continue;
    out.push(e.idx);
  }
  return out;
}

export function getScope(s: FilterState): Scope {
  const range = resolveTime(effectiveTime(s), s.tab);
  const mask = itemMaskOf(s);
  const allowed = promoTypesFor(s.tab);
  const types = usesFilter(s.tab, 'promoType') && s.promoType !== 'all' && allowed.includes(s.promoType) ? [s.promoType] : allowed;
  let events = candidateEvents(s, range, mask);
  if (usesFilter(s.tab, 'event') && s.event >= 0) events = events.filter((e) => e === s.event);
  const narrows = !!mask && ((usesFilter(s.tab, 'item') && s.item >= 0) || (usesFilter(s.tab, 'vb') && !!s.vb) || (usesFilter(s.tab, 'pg') && s.codes.length > 0));
  return {
    range,
    events,
    ctx: { baselineWeeks: effectiveBaseline(s.tab, s.baseline), level: s.level, itemMask: mask, storeShare: storeShareOf(s) },
    itemFiltered: narrows,
    types,
  };
}
