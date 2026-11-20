/**
 * Promotion timing heat map (Promo History, new request from the prototype review): rows are price groups or
 * categories, columns the month of the year the event started, the cell the Sales Lift % of its events (ratio of
 * totals) or their average Net Incremental GM $ per event. Months with no event stay empty.
 */
import { monthOfDay } from '../data/calendar';
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { derive, sumAggs, type Agg, type Basis } from './metrics';

export type HeatRows = 'pg' | 'cat';
export type HeatMeasure = 'lift' | 'netIncGm';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface HeatCell {
  value: number | null;
  /** Events in the cell. 0 = empty. */
  n: number;
}

export interface HeatRow {
  key: number;
  label: string;
  n: number;
  cells: HeatCell[];
}

export interface HeatMap {
  rows: HeatRow[];
  /** Largest absolute value, for a colour scale centred on zero. */
  maxAbs: number;
}

export function buildHeatmap(events: number[], aggOf: (e: number) => Agg, basis: Basis, rowsBy: HeatRows, measure: HeatMeasure): HeatMap {
  const groups = new Map<number, Agg[][]>();
  for (const e of events) {
    const ev = EVENTS[e];
    const key = rowsBy === 'pg' ? ev.pg : PRICE_GROUPS[ev.pg].cat;
    const months = groups.get(key) ?? Array.from({ length: 12 }, () => []);
    months[monthOfDay(ev.start) - 1].push(aggOf(e));
    groups.set(key, months);
  }
  let maxAbs = 0;
  const rows: HeatRow[] = [...groups.entries()].map(([key, months]) => {
    const cells = months.map((list): HeatCell => {
      if (list.length === 0) return { value: null, n: 0 };
      const m = derive(sumAggs(list), basis);
      const value = measure === 'lift' ? m.salesLift : m.netIncGm === null ? null : m.netIncGm / list.length;
      if (value !== null && Number.isFinite(value)) maxAbs = Math.max(maxAbs, Math.abs(value));
      return { value, n: list.length };
    });
    return { key, label: rowsBy === 'pg' ? PRICE_GROUPS[key].name : CATS[key].name, n: months.reduce((s, l) => s + l.length, 0), cells };
  });
  rows.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  return { rows, maxAbs };
}

/** Diverging scale: muted red below zero, neutral grey at zero, brand blue above (never a hue at the midpoint). */
const NEG = [180, 82, 77];
const MID = [238, 237, 232];
const POS = [45, 99, 160];

export function heatColor(value: number, maxAbs: number): string {
  const t = maxAbs > 0 ? Math.max(-1, Math.min(1, value / maxAbs)) : 0;
  const to = t < 0 ? NEG : POS;
  const k = Math.abs(t);
  const c = MID.map((m, i) => Math.round(m + (to[i] - m) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Height of the heat map body: legend, header and 26 px per row. */
export function heatHeight(rows: number): number {
  return 34 + 26 + Math.max(1, rows) * 26 + 4;
}
