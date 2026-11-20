/**
 * Event pickers of the Hot Buy / Other Promo Performance charts (presentation only; no KPI changes).
 *
 *  - The view keeps one selected event (state.sel, in the URL). A table row click or a pick in either chart's
 *    "Event" dropdown sets it.
 *  - Bridge: "All events in the table" by default; it shows the selected event once one is picked, until the user
 *    picks "All events" again. If the selected event leaves the table (global filters), it goes back to All.
 *  - Sales vs. baseline chart: always one event: the selected one, else the event with the highest sales.
 */
import { shortDay } from '../data/calendar';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL, type PromoEvent } from '../data/promos';
import type { Metrics } from './metrics';

/** The selected event if it is in the table, else null. */
export function selectedInTable(sel: number, events: number[]): number | null {
  return sel >= 0 && events.includes(sel) ? sel : null;
}

/**
 * Event the bridge shows, or null for "All events in the table". `allAt` is the selected event at the moment the
 * user picked "All events"; a later selection (row click or pick) switches the bridge back to that event.
 */
export function bridgeEvent(sel: number, events: number[], allAt: number | null): number | null {
  const s = selectedInTable(sel, events);
  if (s === null) return null;
  return allAt === s ? null : s;
}

/** Event the sales vs. baseline chart shows: the selected one, else the one with the highest sales (or -1). */
export function chartEvent(sel: number, events: number[], salesOf: (e: number) => number): number {
  const s = selectedInTable(sel, events);
  if (s !== null) return s;
  let best = -1;
  for (const e of events) if (best < 0 || salesOf(e) > salesOf(best)) best = e;
  return best;
}

/** "Price group · Promo type · mm/dd/yy–mm/dd/yy". */
export function eventOptionLabel(e: PromoEvent): string {
  return `${PRICE_GROUPS[e.pg].name} · ${PROMO_LABEL[e.type]} · ${shortDay(e.start)}–${shortDay(e.end)}`;
}

export const ALL_EVENTS = 'all';

export interface EventOption {
  value: string;
  /** Full text: "Price group · Promo type · mm/dd/yy–mm/dd/yy". */
  label: string;
  /** Two-line list rendering: price group on top, promo type and dates below. */
  primary?: string;
  secondary?: string;
}

/** Dropdown options: optionally "All events in the table (N)", then one per event, latest start first. */
export function eventOptions(events: number[], withAll: boolean): EventOption[] {
  const list = [...events]
    .sort((a, b) => EVENTS[b].start - EVENTS[a].start || a - b)
    .map((e) => {
      const ev = EVENTS[e];
      return { value: String(e), label: eventOptionLabel(ev), primary: PRICE_GROUPS[ev.pg].name, secondary: `${PROMO_LABEL[ev.type]} · ${shortDay(ev.start)}–${shortDay(ev.end)}` };
    });
  return withAll ? [{ value: ALL_EVENTS, label: `All events in the table (${events.length})` }, ...list] : list;
}

/** Above this many options the picker becomes a searchable combobox. */
export const SEARCHABLE_FROM = 11;

/** Options whose label contains the query (case-insensitive); the "All events" option always stays. */
export function filterOptions(options: EventOption[], query: string): EventOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.value === ALL_EVENTS || o.label.toLowerCase().includes(q));
}

export interface BridgeStepData {
  label: string;
  value: number;
  kind: 'delta' | 'total';
}

/** Bridge: promo item lift → cannibalization → net incremental → rest of category → category incremental. */
export function bridgeSteps(m: Pick<Metrics, 'incSales' | 'cannSales' | 'netIncSales' | 'catIncSales'>): BridgeStepData[] {
  return [
    { label: 'Promo item lift', value: m.incSales ?? 0, kind: 'delta' },
    { label: 'Cannibalization', value: m.cannSales ?? 0, kind: 'delta' },
    { label: 'Net incremental', value: m.netIncSales ?? 0, kind: 'total' },
    { label: 'Rest of category', value: (m.catIncSales ?? 0) - (m.netIncSales ?? 0), kind: 'delta' },
    { label: 'Category incremental', value: m.catIncSales ?? 0, kind: 'total' },
  ];
}
