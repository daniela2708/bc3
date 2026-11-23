/**
 * Promo Shopper Impact: three layout proposals for review (prototype review), shown as subtabs at the top of the view.
 * All three use club card and T-log aggregates only (totals and averages per event or per category, never a customer
 * or card).
 */
import { formatMonth, monthOfDay } from '../data/calendar';
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { DEFAULT_SUBTAB, SUBTAB_IDS, type FilterState, type SubTab } from './filters';
import type { EventCtx } from './metrics';
import { shopperOf, type ShopperMetrics } from './shopper';

export type Proposal = SubTab;
export const DEFAULT_PROPOSAL: Proposal = DEFAULT_SUBTAB;
export const PROPOSAL_CHIP = 'Proposals for review';

export interface ProposalInfo {
  id: Proposal;
  label: string;
  name: string;
  /** The question the subtab answers. */
  question: string;
  description: string;
  /** "What to look at: …" line under the description. */
  look: string;
}

export const PROPOSALS: ProposalInfo[] = [
  {
    id: 'A',
    label: 'A',
    name: 'Category summary',
    question: 'How do shoppers respond, by category?',
    description: 'One row and one bar per category: events in the period, Promo Buyer Count, Avg Basket Size $, New-to-Category Buyers %, buyer lift vs. the previous week and last year, and promo intensity.',
    look: 'Which categories gain buyers, and is the lift real vs. last year?',
  },
  {
    id: 'B',
    label: 'B',
    name: 'Event detail',
    question: 'What happened to shoppers in one promotion?',
    description: 'Pick an event: its buyers and baskets before, during and after, where the buyers came from, multi-item baskets, what else they bought and every event in the table below.',
    look: 'Did this promotion bring new shoppers and bigger baskets, or just discount existing buyers?',
  },
  {
    id: 'C',
    label: 'C',
    name: 'Executive snapshot',
    question: 'How did every Hot Buy of a month do?',
    description: 'Every Hot Buy of one ad month, one card each ordered by Hot Buy Score with its verdict. Click a card to open the event in B.',
    look: 'Which Hot Buys should we run again, refine or reconsider?',
  },
];

/** The proposal for a stored or typed value; anything else falls back to the default (A). */
export function parseProposal(v: unknown): Proposal {
  return SUBTAB_IDS.find((id) => id === v) ?? DEFAULT_PROPOSAL;
}

/** Subtab bar keyboard (WAI-ARIA tabs, automatic activation): arrows move and wrap, Home / End jump; other keys null. */
export function nextSubTab(current: Proposal, key: string): Proposal | null {
  const ids = PROPOSALS.map((p) => p.id);
  const i = ids.indexOf(current);
  if (key === 'ArrowRight' || key === 'ArrowDown') return ids[(i + 1) % ids.length];
  if (key === 'ArrowLeft' || key === 'ArrowUp') return ids[(i - 1 + ids.length) % ids.length];
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[ids.length - 1];
  return null;
}

/** C → B: clicking a card opens that event in the Event detail subtab. */
export function openInEventDetail(s: FilterState, event: number): FilterState {
  return { ...s, sp: 'B', sel: event };
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
