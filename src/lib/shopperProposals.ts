/**
 * Promo Shopper Impact: three layout proposals for review (prototype review), picked with a local control. All three
 * use club card aggregates only (totals and averages per event or per category, never a customer or card).
 */
import { formatMonth, monthOfDay } from '../data/calendar';
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import type { EventCtx } from './metrics';
import { shopperOf, type ShopperMetrics } from './shopper';

export type Proposal = 'A' | 'B' | 'C';
export const DEFAULT_PROPOSAL: Proposal = 'A';
export const PROPOSAL_CHIP = 'Proposal for review';

export const PROPOSALS: { id: Proposal; label: string; name: string; description: string }[] = [
  { id: 'A', label: 'A', name: 'Category summary', description: 'One row and one bar per category: events in the period, Promo Buyer Count, Avg Basket Size $, New-to-Category Buyers % and buyer lift vs. the previous week and vs. the same week last year.' },
  { id: 'B', label: 'B', name: 'Event detail', description: 'The Hot Buy Performance pattern: pick an event, see its key figures, its buyers and basket before, during and after the promo, and every event in the table below.' },
  { id: 'C', label: 'C', name: 'Executive snapshot', description: 'Every Hot Buy of one ad month in a compact grid: one card per event with four key figures and the Hot Buy Score, for a quick read.' },
];

/** The proposal for a stored or typed value; anything else falls back to the default (A). */
export function parseProposal(v: unknown): Proposal {
  return v === 'A' || v === 'B' || v === 'C' ? v : DEFAULT_PROPOSAL;
}

export interface CategoryRow {
  cat: number;
  label: string;
  events: number[];
  m: ShopperMetrics;
}

/** Proposal A: club card aggregates per category (ratio of totals over its events), most buyers first. */
export function categorySummary(events: number[], ctx: EventCtx): CategoryRow[] {
  const byCat = new Map<number, number[]>();
  for (const e of events) {
    const c = PRICE_GROUPS[EVENTS[e].pg].cat;
    byCat.set(c, [...(byCat.get(c) ?? []), e]);
  }
  return [...byCat.entries()].map(([cat, list]) => ({ cat, label: CATS[cat].name, events: list, m: shopperOf(list, ctx) })).sort((a, b) => b.m.buyers - a.m.buyers || a.label.localeCompare(b.label));
}

export interface AdMonth {
  /** "MM/YYYY" of the events' start (ad week start). */
  key: string;
  label: string;
  events: number[];
}

const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Proposal C: the Hot Buys of the selection grouped by the month their ad week starts, latest month first. */
export function hotBuyMonths(events: number[]): AdMonth[] {
  const map = new Map<string, AdMonth & { sort: number }>();
  for (const e of events) {
    const ev = EVENTS[e];
    if (ev.type !== 'HB') continue;
    const key = formatMonth(ev.start);
    const cur = map.get(key) ?? { key, label: `${MONTH_NAME[monthOfDay(ev.start) - 1]} ${key.slice(3)}`, events: [], sort: Number(key.slice(3)) * 100 + monthOfDay(ev.start) };
    cur.events.push(e);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.sort - a.sort).map(({ key, label, events: list }) => ({ key, label, events: list.sort((a, b) => EVENTS[a].start - EVENTS[b].start || a - b) }));
}
