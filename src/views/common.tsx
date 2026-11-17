/* eslint-disable react-refresh/only-export-components -- shared view helpers and the controls they drive */
import type { ReactNode } from 'react';
import type { HierCol, HierRow } from '../components/HierTable';
import { Field, Impact, InfoTip, Pending, Segmented } from '../components/ui';
import { formatDay, shortDay } from '../data/calendar';
import { CATS, DEPTS, ITEMS, itemCode, PRICE_GROUPS, SUBS } from '../data/products';
import { AD_LABEL, EVENTS, PROMO_LABEL, type PromoEvent } from '../data/promos';
import type { FilterState, Rollup } from '../lib/filters';
import { useFilters } from '../lib/filterStore';
import { count, DASH, money, moneyCompact, pct, pctChange, ratio, volume, volumeCompact } from '../lib/format';
import { BASELINE_WEEKS, safeDiv, type BaselineWeeks } from '../lib/kpis';
import { CANN_LEVELS, derive, eventAgg, sumAggs, type Agg, type Basis, type ByUom, type CannLevel, type EventCtx, type Metrics, type U } from '../lib/metrics';

export interface ViewProps {
  openDefinitions: (id?: string) => void;
}

export const basisWord = (b: Basis) => (b === 'net' ? 'Net Customer Sales' : 'Gross Sales');

// ---------------------------------------------------------------- Formatting

export function unitsText(u: U, compact = true): ReactNode {
  const f = compact ? volumeCompact : volume;
  if (u.ea > 0 && u.lb > 0)
    return (
      <>
        {f(u.ea, 'ea')}
        <span className="cell-sub">{f(u.lb, 'lb')}</span>
      </>
    );
  if (u.lb > 0) return f(u.lb, 'lb');
  return f(u.ea, 'ea');
}

/** A rate kept per unit of measure: shows the ea value, the lb value, or both on two lines. Never mixes them. */
export function uomPct(v: ByUom, signed = false): ReactNode {
  const f = signed ? pctChange : pct;
  if (v.ea !== null && v.lb !== null)
    return (
      <>
        {f(v.ea)} <small>ea</small>
        <span className="cell-sub">
          {f(v.lb)} <small>lb</small>
        </span>
      </>
    );
  return f(v.ea ?? v.lb);
}
export const uomFirst = (v: ByUom) => v.ea ?? v.lb;

export function eventDates(e: PromoEvent): string {
  return `${shortDay(e.start)}–${shortDay(e.end)}`;
}

export function eventSub(e: PromoEvent): string {
  return `${e.id} · ${eventDates(e)} · ${PROMO_LABEL[e.type]} ${pct(e.depth, 0)} off · ${AD_LABEL[e.adType]}`;
}

// ---------------------------------------------------------------- Metric columns

export const PG_LEVEL_TIP = 'Measured at price group level';

/** The "—" of SKU rows for measures that exist only for the whole price group (cannibalization, category). */
export function pgOnly(): ReactNode {
  return (
    <span className="pg-only" title={PG_LEVEL_TIP} aria-label={`Not shown for a SKU: ${PG_LEVEL_TIP.toLowerCase()}`} tabIndex={0}>
      {DASH}
    </span>
  );
}

/** SKU rows carry null cannibalization; every measure built on it shows the price-group-level dash. */
const skuRow = (m: Metrics) => m.cannSales === null;
const orPg = (m: Metrics, node: ReactNode) => (skuRow(m) ? pgOnly() : node);

export interface MetricCol extends HierCol {
  cell: (m: Metrics, e?: PromoEvent) => ReactNode;
  sort: (m: Metrics, e?: PromoEvent) => number | string | null;
}

const PENDING_TITLE = (q: number) => `Definition pending (#${q})`;

/** Every metric column the performance tables can show, keyed for the column chooser. */
export const METRIC_COLS: Record<string, MetricCol> = {
  dates: { key: 'dates', label: 'Dates', group: 'Promo', left: true, cell: (_m, e) => (e ? eventDates(e) : ''), sort: (_m, e) => e?.start ?? null },
  type: { key: 'type', label: 'Promo Type', group: 'Promo', left: true, cell: (_m, e) => (e ? PROMO_LABEL[e.type] : ''), sort: (_m, e) => (e ? PROMO_LABEL[e.type] : null) },
  depth: { key: 'depth', label: 'Promo Depth %', group: 'Promo', cell: (m, e) => pct(e ? e.depth : m.avgDepth, 0), sort: (m, e) => (e ? e.depth : m.avgDepth) },
  ad: { key: 'ad', label: 'Ad Type', group: 'Promo', left: true, cell: (_m, e) => (e ? AD_LABEL[e.adType] : ''), sort: (_m, e) => (e ? AD_LABEL[e.adType] : null) },
  events: { key: 'events', label: 'Events', group: 'Promo', cell: (m) => count(m.events), sort: (m) => m.events },
  gross: { key: 'gross', label: 'Gross Sales $', group: 'Sales', cell: (m) => moneyCompact(m.gross), sort: (m) => m.gross },
  net: { key: 'net', label: 'Net Customer Sales $', group: 'Sales', cell: (m) => moneyCompact(m.net), sort: (m) => m.net },
  units: { key: 'units', label: 'Promo Units', group: 'Sales', cell: (m) => unitsText(m.units), sort: (m) => m.units.ea + m.units.lb },
  avgRetail: { key: 'avgRetail', label: 'Avg Promo Retail $', group: 'Sales', cell: (m) => (m.avgRetail.ea ?? m.avgRetail.lb) === null ? DASH : `$${(m.avgRetail.ea ?? m.avgRetail.lb)!.toFixed(2)}${m.avgRetail.lb !== null ? ' / lb' : ''}`, sort: (m) => uomFirst(m.avgRetail) },
  baseSales: { key: 'baseSales', label: 'Baseline Sales $', group: 'Baseline', title: PENDING_TITLE(6), cell: (m) => moneyCompact(m.baseSales), sort: (m) => m.baseSales },
  baseUnits: { key: 'baseUnits', label: 'Baseline Units', group: 'Baseline', defaultHidden: true, cell: (m) => unitsText(m.baseUnits), sort: (m) => m.baseUnits.ea + m.baseUnits.lb },
  incSales: { key: 'incSales', label: 'Incremental Sales $', group: 'Baseline', cell: (m) => <Impact value={m.incSales} compact />, sort: (m) => m.incSales },
  incUnits: { key: 'incUnits', label: 'Incremental Units', group: 'Baseline', defaultHidden: true, cell: (m) => uomPctUnits(m.incUnits), sort: (m) => uomFirst(m.incUnits) },
  salesLift: { key: 'salesLift', label: 'Sales Lift %', group: 'Baseline', cell: (m) => pctChange(m.salesLift), sort: (m) => m.salesLift },
  unitLift: { key: 'unitLift', label: 'Unit Lift %', group: 'Baseline', cell: (m) => uomPct(m.unitLift, true), sort: (m) => uomFirst(m.unitLift) },
  gm: { key: 'gm', label: 'Promo GM $', group: 'Margin', cell: (m) => moneyCompact(m.gm), sort: (m) => m.gm },
  gmPct: { key: 'gmPct', label: 'Promo GM %', group: 'Margin', title: PENDING_TITLE(7), cell: (m) => pct(m.gmPct), sort: (m) => m.gmPct },
  baseGm: { key: 'baseGm', label: 'Baseline GM $', group: 'Margin', defaultHidden: true, cell: (m) => moneyCompact(m.baseGm), sort: (m) => m.baseGm },
  incGm: { key: 'incGm', label: 'Incremental GM $', group: 'Margin', cell: (m) => <Impact value={m.incGm} compact />, sort: (m) => m.incGm },
  netGm: { key: 'netGm', label: 'Net GM $', group: 'Margin', title: PENDING_TITLE(3), cell: (m) => moneyCompact(m.netGm), sort: (m) => m.netGm },
  catIncSales: { key: 'catIncSales', label: 'Category Incremental Sales $', group: 'Category', cell: (m) => orPg(m, <Impact value={m.catIncSales} compact />), sort: (m) => m.catIncSales },
  catIncGm: { key: 'catIncGm', label: 'Category Incremental GM $', group: 'Category', defaultHidden: true, cell: (m) => orPg(m, <Impact value={m.catIncGm} compact />), sort: (m) => m.catIncGm },
  cannSales: { key: 'cannSales', label: 'Cannibalized Sales $', group: 'Category', title: PENDING_TITLE(5), cell: (m) => orPg(m, <Impact value={m.cannSales} compact />), sort: (m) => m.cannSales },
  cannRate: { key: 'cannRate', label: 'Cannibalization Rate %', group: 'Category', title: PENDING_TITLE(5), cell: (m) => orPg(m, uomPct(m.cannRate)), sort: (m) => uomFirst(m.cannRate) },
  netIncSales: { key: 'netIncSales', label: 'Net Incremental Sales $', group: 'Category', cell: (m) => orPg(m, <Impact value={m.netIncSales} compact />), sort: (m) => m.netIncSales },
  netIncGm: { key: 'netIncGm', label: 'Net Incremental GM $', group: 'Margin', title: PENDING_TITLE(3), cell: (m) => orPg(m, <Impact value={m.netIncGm} compact />), sort: (m) => m.netIncGm },
  invest: { key: 'invest', label: 'Promo Investment $', group: 'Funding', cell: (m) => moneyCompact(m.invest), sort: (m) => m.invest },
  funding: { key: 'funding', label: 'Vendor Promo Funding $', group: 'Funding', cell: (m) => moneyCompact(m.funding), sort: (m) => m.funding },
  vendorPct: { key: 'vendorPct', label: 'Vendor-Funded %', group: 'Funding', cell: (m) => pct(m.vendorPct, 0), sort: (m) => m.vendorPct },
  weisCost: { key: 'weisCost', label: 'Weis-Funded Promo Cost $', group: 'Funding', cell: (m) => moneyCompact(m.weisCost), sort: (m) => m.weisCost },
  roi: { key: 'roi', label: 'Promo ROI', group: 'Funding', title: PENDING_TITLE(3), cell: (m) => roiText(m), sort: (m) => m.roi },
  ly: { key: 'ly', label: 'LY Gross Sales $', group: 'Trend', cell: (m) => moneyCompact(m.ly), sort: (m) => m.ly },
  yoyAbs: { key: 'yoyAbs', label: 'YoY Gross Sales $', group: 'Trend', cell: (m) => <Impact value={m.yoy.abs} compact />, sort: (m) => m.yoy.abs },
  yoyPct: { key: 'yoyPct', label: 'YoY Gross Sales %', group: 'Trend', cell: (m) => pctChange(m.yoy.pct), sort: (m) => m.yoy.pct },
  dip: { key: 'dip', label: 'Post-Promo Dip %', group: 'Trend', title: PENDING_TITLE(4), cell: (m) => uomPct(m.dip, true), sort: (m) => uomFirst(m.dip) },
};

function uomPctUnits(v: ByUom): ReactNode {
  if (v.ea !== null && v.lb !== null)
    return (
      <>
        {volumeCompact(v.ea, 'ea')}
        <span className="cell-sub">{volumeCompact(v.lb, 'lb')}</span>
      </>
    );
  return v.lb !== null ? volumeCompact(v.lb, 'lb') : volumeCompact(v.ea, 'ea');
}

export function roiText(m: Pick<Metrics, 'roi' | 'weisCostAll' | 'invest' | 'cannSales'>): ReactNode {
  if (m.roi !== null) return ratio(m.roi);
  if (m.cannSales === null) return pgOnly();
  if (m.invest > 0 && (m.weisCostAll ?? 0) <= 0.005) return <span title="The vendor paid the whole promo investment, so ROI is not defined.">— fully vendor funded</span>;
  return DASH;
}

export function columnsOf(keys: string[], hidden: string[] = []): MetricCol[] {
  return keys.map((k) => ({ ...METRIC_COLS[k], defaultHidden: METRIC_COLS[k].defaultHidden || hidden.includes(k) }));
}

// ---------------------------------------------------------------- Rows

function cellsOf(cols: MetricCol[], m: Metrics, e?: PromoEvent) {
  const cells: Record<string, ReactNode> = {};
  const sort: Record<string, number | string | null> = {};
  for (const c of cols) {
    cells[c.key] = c.cell(m, e);
    sort[c.key] = c.sort(m, e);
  }
  return { cells, sort };
}

export interface RowOptions {
  events: number[];
  ctx: EventCtx;
  basis: Basis;
  rollup: Rollup;
  cols: MetricCol[];
  selected: number;
  onSelect: (event: number) => void;
  /** Adds "Share of price group %" and the Seasonal / Everyday tag to SKU rows. */
  share?: boolean;
}

/** Hierarchical rows: optional roll-up (Department › Category › Subcategory) › event (price group) › SKU. */
export function performanceRows(o: RowOptions): { rows: HierRow[]; total: HierRow; aggs: Map<number, Agg> } {
  const aggs = new Map<number, Agg>();
  for (const e of o.events) aggs.set(e, eventAgg(EVENTS[e], o.ctx));

  const skuRows = (e: PromoEvent, eventMetrics: Metrics): HierRow[] =>
    PRICE_GROUPS[e.pg].items
      .filter((i) => !o.ctx.itemMask || o.ctx.itemMask[i])
      .map((i) => {
        const it = ITEMS[i];
        const m = derive(eventAgg(e, o.ctx, i), o.basis);
        const { cells, sort } = cellsOf(o.cols, m);
        if (o.share) {
          const share = safeDiv(m.sales, eventMetrics.sales);
          cells.share = pct(share);
          sort.share = share;
        }
        return {
          id: `e${e.idx}-i${i}`,
          label: it.name,
          sub: `SKU ${it.sku} · ${itemCode(it)}${o.share ? ` · ${it.season ? 'Seasonal' : 'Everyday'}` : ''}`,
          cells,
          sort,
          className: 'sku-row',
        };
      });

  const eventRow = (idx: number): HierRow => {
    const e = EVENTS[idx];
    const m = derive(aggs.get(idx)!, o.basis);
    const { cells, sort } = cellsOf(o.cols, m, e);
    if (o.share) {
      cells.share = '100 %';
      sort.share = 1;
    }
    return {
      id: `e${idx}`,
      label: PRICE_GROUPS[e.pg].name,
      sub: eventSub(e),
      cells,
      sort: { ...sort, label: PRICE_GROUPS[e.pg].name },
      children: skuRows(e, m),
      onSelect: () => o.onSelect(idx),
      selected: idx === o.selected,
    };
  };

  const levels: ('dept' | 'cat' | 'sub')[] = o.rollup === 'dept' ? ['dept', 'cat', 'sub'] : o.rollup === 'cat' ? ['cat', 'sub'] : o.rollup === 'sub' ? ['sub'] : [];
  const keyOf = (lvl: 'dept' | 'cat' | 'sub', e: number) => PRICE_GROUPS[EVENTS[e].pg][lvl];
  const nameOf = (lvl: 'dept' | 'cat' | 'sub', k: number) => (lvl === 'dept' ? DEPTS[k].name : lvl === 'cat' ? CATS[k].name : SUBS[k].name);
  const build = (evs: number[], depth: number, prefix: string): HierRow[] => {
    if (depth >= levels.length) return evs.map(eventRow);
    const lvl = levels[depth];
    const groups = new Map<number, number[]>();
    for (const e of evs) {
      const k = keyOf(lvl, e);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()].map(([k, list]) => {
      const m = derive(sumAggs(list.map((e) => aggs.get(e)!)), o.basis);
      const { cells, sort } = cellsOf(o.cols, m);
      return { id: `${prefix}${lvl}${k}`, label: nameOf(lvl, k), sub: `${list.length} event${list.length > 1 ? 's' : ''}`, cells, sort: { ...sort, label: nameOf(lvl, k) }, children: build(list, depth + 1, `${prefix}${lvl}${k}-`) };
    });
  };

  const totalM = derive(sumAggs([...aggs.values()]), o.basis);
  const t = cellsOf(o.cols, totalM);
  if (o.share) t.cells.share = '';
  return {
    rows: build(o.events, 0, ''),
    total: { id: 'total', label: 'Total', sub: `${o.events.length} event${o.events.length === 1 ? '' : 's'}`, cells: t.cells, sort: t.sort },
    aggs,
  };
}

// ---------------------------------------------------------------- Controls

export function ViewControls({ cann = true, rollup = false, basis = true, baseline = true, children }: { cann?: boolean; rollup?: boolean; basis?: boolean; baseline?: boolean; children?: ReactNode }) {
  const { state, update } = useFilters();
  const set = (patch: Partial<FilterState>) => update((s) => ({ ...s, ...patch }));
  return (
    <div className="toggle-row view-toggles" role="group" aria-label="View controls">
      {baseline && (
        <span className="toggle-group">
          <span className="toggle-label">
            Baseline window <InfoTip text="Average of the weeks right before the event, scaled to the promo days. Default 4 weeks (question #6). Prior promo weeks inside the window are not excluded." />
          </span>
          <Segmented<string>
            small
            label="Baseline window in weeks"
            value={String(state.baseline)}
            onChange={(v) => set({ baseline: Number(v) as BaselineWeeks })}
            options={BASELINE_WEEKS.map((w) => ({ value: String(w), label: `${w} wk` }))}
          />
          <span className="baseline-note">
            Baseline includes prior promo weeks in the window <Pending q={6} />
          </span>
        </span>
      )}
      {cann && (
        <span className="toggle-group">
          <span className="toggle-label">
            Cannibalization level <InfoTip text={CANN_LEVELS.map((l) => `${l.label}: ${l.tip}`).join(' ')} />
          </span>
          <Segmented<CannLevel> small label="Cannibalization level" value={state.level} onChange={(v) => set({ level: v })} options={CANN_LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
          <Pending q={5} />
        </span>
      )}
      {basis && (
        <span className="toggle-group">
          <span className="toggle-label">
            Sales basis <InfoTip text="Sales used for Promo Sales $, baseline, lift, incremental and margin. Net Customer Sales by default; Promo GM % divides by the same basis (question #7)." />
          </span>
          <Segmented<Basis>
            small
            label="Sales basis"
            value={state.basis}
            onChange={(v) => set({ basis: v })}
            options={[
              { value: 'net', label: 'Net Customer' },
              { value: 'gross', label: 'Gross' },
            ]}
          />
        </span>
      )}
      {rollup && (
        <span className="toggle-group">
          <span className="toggle-label">Rows</span>
          <Segmented<Rollup>
            small
            label="Table rows: roll up by"
            value={state.rollup}
            onChange={(v) => set({ rollup: v })}
            options={[
              { value: 'event', label: 'Price Group' },
              { value: 'sub', label: 'Subcategory' },
              { value: 'cat', label: 'Category' },
              { value: 'dept', label: 'Department' },
            ]}
          />
        </span>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <section className="card empty-card" role="status">
      <p>{children}</p>
    </section>
  );
}

export function rangeText(start: number, end: number): string {
  return `${formatDay(start)} – ${formatDay(end)}`;
}

export function moneyFmt(v: number): string {
  return moneyCompact(v);
}
export { money, Field };
