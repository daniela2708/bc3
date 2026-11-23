/**
 * Promo Shopper Impact: the current view plus two layout proposals for review, shown as subtabs at the top of the view.
 * All use club card aggregates only (totals and averages per event or category, never a customer or card).
 */
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { DEFAULT_SUBTAB, SUBTAB_IDS, type SubTab } from './filters';
import type { EventCtx } from './metrics';
import { shopperOf, type ShopperMetrics } from './shopper';

export type Proposal = SubTab;
export const DEFAULT_PROPOSAL: Proposal = DEFAULT_SUBTAB;
export const PROPOSAL_CHIP = 'Proposals for review';

export interface ProposalInfo {
  id: Proposal;
  label: string;
  name: string;
  /** False for the current view; A and B are layout proposals for review. */
  proposal: boolean;
  /** The question the subtab answers. */
  question: string;
  description: string;
  /** "What to look at: …" line under the description. */
  look: string;
}

/** The subtabs in order: the current view, then the two proposals. */
export const PROPOSALS: ProposalInfo[] = [
  {
    id: 'current',
    label: 'Current',
    name: 'Event panels',
    proposal: false,
    question: 'How did each promotion change its buyers’ behaviour?',
    description: 'The view as it is today: the period’s key figures, one panel per event with its shopper metrics vs. the same buyers’ usual, and every event in the table.',
    look: 'Which promotions moved buyers, baskets and spend above their usual?',
  },
  {
    id: 'A',
    label: 'A',
    name: 'Category summary',
    proposal: true,
    question: 'How do shoppers respond, by category?',
    description: 'One row and one bar per category: events in the period, Promo Buyer Count, Avg Basket Size $, New-to-Category Buyers %, buyer lift vs. the previous week and last year, and promo intensity.',
    look: 'Which categories gain buyers, and is the lift real vs. last year?',
  },
  {
    id: 'B',
    label: 'B',
    name: 'Event detail',
    proposal: true,
    question: 'What happened to shoppers in one promotion?',
    description: 'Pick an event: its defined shopper KPIs, buyers and baskets before, during and after, and every event in the table below. Metrics that would require a new KPI definition are intentionally excluded.',
    look: 'Did this promotion increase buyers and baskets above their usual?',
  },
];

/** The subtab for a stored or typed value; anything else falls back to the default (the current view). */
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

/** Tab text: "Current · Event panels", "A · Category summary", … */
export const subTabLabel = (p: ProposalInfo) => `${p.label} · ${p.name}`;

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
