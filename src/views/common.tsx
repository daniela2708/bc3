/* eslint-disable react-refresh/only-export-components -- shared view helpers and the controls they drive */
import type { ReactNode } from 'react';
import type { Tile, TileValue } from '../components/Blocks';
import type { HierCol, HierRow } from '../components/HierTable';
import { Term } from '../components/Term';
import { Field, HowItWorks, Impact, InfoTip, Pending, Segmented } from '../components/ui';
import { formatDay, shortDay } from '../data/calendar';
import { CATS, DEPTS, ITEMS, itemCode, PRICE_GROUPS, SUBS } from '../data/products';
import { AD_LABEL, EVENTS, EVENTS_BY_PG, PROMO_LABEL, type PromoEvent } from '../data/promos';
import { FUNDING_BEHIND_SCENES, RANDOM_WEIGHT_NOTE } from '../lib/definitions';
import { daysSincePreviousPromo, FATIGUE_CHIP, FATIGUE_INFO, FATIGUE_RULE, promosInLast52Weeks, promotedOften } from '../lib/fatigue';
import type { Rollup } from '../lib/filters';
import { useFilters } from '../lib/filterStore';
import { count, DASH, money, moneyCompact, moneyTile, numberCompact, pct, pctChange, volume, volumeCompact } from '../lib/format';
import { BASELINE_PENDING_TEXT, BASELINE_WEEKS, PROPOSED_BASELINE_BY_TYPE, viewBaselineDefault, type BaselineWeeks } from '../lib/baseline';
import { safeDiv } from '../lib/kpis';
import { affectsText, barSettings, blockSettings, SETTING_LABEL, tagsFor, type BlockId, type SettingKey } from '../lib/settings';
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

// ---------------------------------------------------------------- Two-value tiles

/**
 * Promo Sales $ as a two-value tile: the selected sales basis is the main value (Net Customer Sales by default, the
 * UC1 sales table, #5) and the other basis the secondary one.
 */
export function salesPair(gross: number, net: number, basis: Basis): [TileValue, TileValue] {
  const n: TileValue = { value: moneyTile(net), tag: 'Net Customer', spoken: 'Net Customer Sales', term: 'netCustomerSales' };
  const g: TileValue = { value: moneyTile(gross), tag: 'Gross', spoken: 'Gross Sales', term: 'grossSales' };
  return basis === 'net' ? [n, g] : [g, n];
}

const UOM_SPOKEN = { ea: 'Units (each)', lb: 'Pounds' } as const;

/** Units tile: one value, or each (main) and pounds (secondary) when both are sold. Never added together. */
export function unitsTile(u: U): Pick<Tile, 'value' | 'pair'> {
  if (u.ea > 0 && u.lb > 0)
    return {
      pair: [
        { value: numberCompact(u.ea), tag: 'ea', spoken: UOM_SPOKEN.ea, term: 'eaLb' },
        { value: numberCompact(u.lb), tag: 'lb', spoken: UOM_SPOKEN.lb },
      ],
    };
  return { value: u.lb > 0 ? volumeCompact(u.lb, 'lb') : volumeCompact(u.ea, 'ea') };
}

/** A rate kept per unit of measure: one value, or ea (main) and lb (secondary) when both exist. */
export function uomTile(v: ByUom, signed = false): Pick<Tile, 'value' | 'pair'> {
  const f = signed ? pctChange : pct;
  if (v.ea !== null && v.lb !== null)
    return {
      pair: [
        { value: f(v.ea), tag: 'ea', spoken: UOM_SPOKEN.ea, term: 'eaLb' },
        { value: f(v.lb), tag: 'lb', spoken: UOM_SPOKEN.lb },
      ],
    };
  return { value: f(v.ea ?? v.lb) };
}

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
/** Column tooltip for margin metrics: the pending questions plus the random weight note (#15). */
const MARGIN_TITLE = (pending: string) => `${pending}. ${RANDOM_WEIGHT_NOTE}`;
const LEVEL2_TITLE = 'Level 2 · not MVP';

/** The events of an event's price group, for the promo fatigue columns. */
const pgEvents = (e: PromoEvent) => EVENTS_BY_PG[e.pg].map((i) => EVENTS[i]);

/** Every metric column the performance tables can show, keyed for the column chooser. */
export const METRIC_COLS: Record<string, MetricCol> = {
  dates: { key: 'dates', label: 'Dates', group: 'Promo', left: true, cell: (_m, e) => (e ? eventDates(e) : ''), sort: (_m, e) => e?.start ?? null },
  type: { key: 'type', label: 'Promo Type', group: 'Promo', left: true, cell: (_m, e) => (e ? PROMO_LABEL[e.type] : ''), sort: (_m, e) => (e ? PROMO_LABEL[e.type] : null) },
  depth: { key: 'depth', label: 'Promo Depth %', group: 'Promo', cell: (m, e) => pct(e ? e.depth : m.avgDepth, 0), sort: (m, e) => (e ? e.depth : m.avgDepth) },
  ad: { key: 'ad', label: 'Ad Type', group: 'Promo', left: true, cell: (_m, e) => (e ? AD_LABEL[e.adType] : ''), sort: (_m, e) => (e ? AD_LABEL[e.adType] : null) },
  events: { key: 'events', label: 'Events', group: 'Promo', cell: (m) => count(m.events), sort: (m) => m.events },
  gross: { key: 'gross', label: 'Gross Sales $', group: 'Sales', cell: (m) => moneyCompact(m.gross), sort: (m) => m.gross },
  net: { key: 'net', label: 'Net Customer Sales $', group: 'Sales', cell: (m) => moneyCompact(m.net), sort: (m) => m.net },
  units: { key: 'units', label: 'Promo Units', group: 'Sales', title: `Random-weight items count pounds, as in Total Volume (UC2). ${RANDOM_WEIGHT_NOTE}`, cell: (m) => unitsText(m.units), sort: (m) => m.units.ea + m.units.lb },
  avgRetail: { key: 'avgRetail', label: 'Avg Promo Retail $', group: 'Sales', cell: (m) => (m.avgRetail.ea ?? m.avgRetail.lb) === null ? DASH : `$${(m.avgRetail.ea ?? m.avgRetail.lb)!.toFixed(2)}${m.avgRetail.lb !== null ? ' / lb' : ''}`, sort: (m) => uomFirst(m.avgRetail) },
  baseSales: { key: 'baseSales', label: 'Baseline Sales $', group: 'Baseline', title: PENDING_TITLE(4), cell: (m) => moneyCompact(m.baseSales), sort: (m) => m.baseSales },
  baseUnits: { key: 'baseUnits', label: 'Baseline Units', group: 'Baseline', title: PENDING_TITLE(4), defaultHidden: true, cell: (m) => unitsText(m.baseUnits), sort: (m) => m.baseUnits.ea + m.baseUnits.lb },
  incSales: { key: 'incSales', label: 'Incremental Sales $', group: 'Baseline', cell: (m) => <Impact value={m.incSales} compact />, sort: (m) => m.incSales },
  incUnits: { key: 'incUnits', label: 'Incremental Units', group: 'Baseline', defaultHidden: true, cell: (m) => uomPctUnits(m.incUnits), sort: (m) => uomFirst(m.incUnits) },
  salesLift: { key: 'salesLift', label: 'Sales Lift %', group: 'Baseline', cell: (m) => pctChange(m.salesLift), sort: (m) => m.salesLift },
  unitLift: { key: 'unitLift', label: 'Unit Lift %', group: 'Baseline', cell: (m) => uomPct(m.unitLift, true), sort: (m) => uomFirst(m.unitLift) },
  gm: { key: 'gm', label: 'Promo GM $', group: 'Margin', title: MARGIN_TITLE('Definition pending (#15; also #7)'), cell: (m) => moneyCompact(m.gm), sort: (m) => m.gm },
  gmPct: { key: 'gmPct', label: 'Promo GM %', group: 'Margin', title: MARGIN_TITLE('Definition pending (#5; also #7, #15)'), cell: (m) => pct(m.gmPct), sort: (m) => m.gmPct },
  baseGm: { key: 'baseGm', label: 'Baseline GM $', group: 'Margin', title: MARGIN_TITLE('Definition pending (#4; also #7)'), defaultHidden: true, cell: (m) => moneyCompact(m.baseGm), sort: (m) => m.baseGm },
  incGm: { key: 'incGm', label: 'Incremental GM $', group: 'Margin', title: MARGIN_TITLE(PENDING_TITLE(7)), cell: (m) => <Impact value={m.incGm} compact />, sort: (m) => m.incGm },
  netGm: { key: 'netGm', label: 'Net GM $', group: 'Margin', title: `${FUNDING_BEHIND_SCENES} ${MARGIN_TITLE(PENDING_TITLE(7))}`, cell: (m) => moneyCompact(m.netGm), sort: (m) => m.netGm },
  catIncSales: { key: 'catIncSales', label: 'Category Incremental Sales $', group: 'Category', cell: (m) => orPg(m, <Impact value={m.catIncSales} compact />), sort: (m) => m.catIncSales },
  catIncGm: { key: 'catIncGm', label: 'Category Incremental GM $', group: 'Category', title: MARGIN_TITLE(PENDING_TITLE(7)), defaultHidden: true, cell: (m) => orPg(m, <Impact value={m.catIncGm} compact />), sort: (m) => m.catIncGm },
  cannSales: { key: 'cannSales', label: 'Cannibalized Sales $', group: 'Category', title: PENDING_TITLE(3), cell: (m) => orPg(m, <Impact value={m.cannSales} compact />), sort: (m) => m.cannSales },
  cannRate: { key: 'cannRate', label: 'Cannibalization Rate %', group: 'Category', title: PENDING_TITLE(3), cell: (m) => orPg(m, uomPct(m.cannRate)), sort: (m) => uomFirst(m.cannRate) },
  netIncSales: { key: 'netIncSales', label: 'Net Incremental Sales $', group: 'Category', cell: (m) => orPg(m, <Impact value={m.netIncSales} compact />), sort: (m) => m.netIncSales },
  netIncGm: { key: 'netIncGm', label: 'Net Incremental GM $', group: 'Margin', title: `${FUNDING_BEHIND_SCENES} ${MARGIN_TITLE(PENDING_TITLE(7))}`, cell: (m) => orPg(m, <Impact value={m.netIncGm} compact />), sort: (m) => m.netIncGm },
  ly: { key: 'ly', label: 'LY Gross Sales $', group: 'Trend', cell: (m) => moneyCompact(m.ly), sort: (m) => m.ly },
  yoyAbs: { key: 'yoyAbs', label: 'YoY Gross Sales $', group: 'Trend', cell: (m) => <Impact value={m.yoy.abs} compact />, sort: (m) => m.yoy.abs },
  yoyPct: { key: 'yoyPct', label: 'YoY Gross Sales %', group: 'Trend', cell: (m) => pctChange(m.yoy.pct), sort: (m) => m.yoy.pct },
  dip: { key: 'dip', label: 'Post-Promo Dip %', group: 'Trend', title: LEVEL2_TITLE, cell: (m) => uomPct(m.dip, true), sort: (m) => uomFirst(m.dip) },
  // Promo fatigue (Promo History, prototype review, illustrative): per event only; group and total rows stay empty.
  promos52: { key: 'promos52', label: 'Promos in last 52 weeks', group: 'Promo', title: 'Events of the same price group (any promo type) in the 52 weeks before this event started.', cell: (_m, e) => (e ? count(promosInLast52Weeks(e, pgEvents(e))) : ''), sort: (_m, e) => (e ? promosInLast52Weeks(e, pgEvents(e)) : null) },
  daysSince: {
    key: 'daysSince',
    label: 'Days since previous promo',
    group: 'Promo',
    title: 'Days from the end of the previous promo of the same price group to this start; — when there is no earlier promo in the data (FY2024 onward).',
    cell: (_m, e) => (e ? (daysSincePreviousPromo(e, pgEvents(e)) === null ? DASH : count(daysSincePreviousPromo(e, pgEvents(e)))) : ''),
    sort: (_m, e) => (e ? daysSincePreviousPromo(e, pgEvents(e)) : null),
  },
  fatigue: {
    key: 'fatigue',
    label: 'Promo fatigue',
    group: 'Promo',
    left: true,
    title: `${FATIGUE_RULE} ${FATIGUE_INFO}`,
    headExtra: (
      <>
        <span className="chip status-pending th-chip">{FATIGUE_CHIP}</span>
        <InfoTip text={`${FATIGUE_INFO} ${FATIGUE_RULE}`} label="Promoted often: what it means" below />
      </>
    ),
    cell: (_m, e) => (e && promotedOften(e, pgEvents(e)) ? <span className="flag-chip">Promoted often</span> : ''),
    sort: (_m, e) => (e ? (promotedOften(e, pgEvents(e)) ? 1 : 0) : null),
  },
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

/**
 * Adds a per-event column to table rows built by performanceRows (e.g. the Hot Buy Score): event rows get the
 * event's cell, group rows and the total the cell for the events under them, SKU rows `sku`.
 */
export function withEventColumn<T extends { rows: HierRow[]; total: HierRow }>(t: T, key: string, cellOf: (events: number[]) => { cell: ReactNode; sort: number | null }, sku: ReactNode): T {
  const eventsUnder = (r: HierRow): number[] => {
    const m = /^e(\d+)$/.exec(r.id);
    if (m) return [Number(m[1])];
    return (r.children ?? []).flatMap(eventsUnder);
  };
  const walk = (r: HierRow): HierRow => {
    if (r.className === 'sku-row') return { ...r, cells: { ...r.cells, [key]: sku }, sort: { ...r.sort, [key]: null } };
    const c = cellOf(eventsUnder(r));
    return { ...r, cells: { ...r.cells, [key]: c.cell }, sort: { ...r.sort, [key]: c.sort }, children: r.children?.map(walk) };
  };
  return { ...t, rows: t.rows.map(walk), total: { ...cellsFor(t.total, key, cellOf(t.rows.flatMap(eventsUnder))) } };
}
const cellsFor = (r: HierRow, key: string, c: { cell: ReactNode; sort: number | null }): HierRow => ({ ...r, cells: { ...r.cells, [key]: c.cell }, sort: { ...r.sort, [key]: c.sort } });

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

// ---------------------------------------------------------------- Calculation settings (layout rules 5 and 6)

function BaselineControl() {
  const { state, update } = useFilters();
  const viewDefault = viewBaselineDefault(state.tab);
  const value = state.baseline === null ? String(viewDefault) : String(state.baseline);
  const options = [...(viewDefault === 'byType' ? [{ value: 'byType', label: 'By promo type' }] : []), ...BASELINE_WEEKS.map((w) => ({ value: String(w), label: `${w} wk` }))];
  // Picking the view's default stores no choice, so the URL and other views keep their own default.
  const set = (v: string) => update((s) => ({ ...s, baseline: v === 'byType' || v === String(viewDefault) ? null : (Number(v) as BaselineWeeks) }));
  return (
    <span className="toggle-group">
      <span className="toggle-label">
        <Term id="baseline">Baseline</Term> window{' '}
        <InfoTip
          text={`${affectsText(state.tab, 'baseline')} Average of the weeks right before the event, scaled to the promo days. Proposed defaults (#4): ${PROPOSED_BASELINE_BY_TYPE.HB} weeks for Hot Buys, ${PROPOSED_BASELINE_BY_TYPE.TPR} weeks for TPRs, BOGOs and price locks. Prior promo weeks inside the window are still included; whether to exclude them is pending.`}
          label="Baseline window: what it affects"
        />
      </span>
      <Segmented<string> small label="Baseline window in weeks" value={value} onChange={set} options={options} />
      <span className="baseline-note">
        {BASELINE_PENDING_TEXT}. Baseline includes prior promo weeks in the window <Pending q={4} term />
      </span>
    </span>
  );
}

function BasisControl() {
  const { state, update } = useFilters();
  return (
    <span className="toggle-group">
      <span className="toggle-label">
        <Term id="salesBasis">Sales basis</Term>{' '}
        <InfoTip text={`${affectsText(state.tab, 'basis')} Net Customer Sales by default (#5); Promo GM % divides by the same basis.`} label="Sales basis: what it affects" />
      </span>
      <Segmented<Basis>
        small
        label="Sales basis"
        value={state.basis}
        onChange={(v) => update((s) => ({ ...s, basis: v }))}
        options={[
          { value: 'net', label: 'Net Customer' },
          { value: 'gross', label: 'Gross' },
        ]}
      />
    </span>
  );
}

function CannControl() {
  const { state, update } = useFilters();
  return (
    <span className="toggle-group">
      <span className="toggle-label">
        <Term id="cannLevel">Cannibalization level</Term>{' '}
        <HowItWorks title="How cannibalization works">
          <p>
            <b>{affectsText(state.tab, 'cann')}</b>
          </p>
          <p>Which items count as competitors of the promoted price group. Always excludes the promoted price group and compares only items with the same unit of measure.</p>
          <p>
            <b>How it is calculated:</b> for those items, sales during the promo minus their baseline. A drop is cannibalization (negative), a rise is <Term id="halo">halo</Term> (positive). Cannibalization Rate % = units lost by those items ÷
            incremental units of the promoted item.
          </p>
          <p>
            <b>What changes:</b> Cannibalized Sales $, Cannibalization Rate %, Net Incremental Sales $, Net Incremental Gross Margin $, and the Cannibalization step in the bridge chart.
          </p>
          <p>
            <b>What does not change:</b> the promoted item&apos;s own sales, units, lift, incremental results and Promo GM, and <Term id="categoryIncremental">Category Incremental</Term> Sales $ / GM $, which always use the whole category.
          </p>
          <p>
            <b>Levels:</b> Subcategory (default, as in the KPI sheet), Brand, Brand-category, Category. The level is still open (#3).
          </p>
          <ul>
            {CANN_LEVELS.map((l) => (
              <li key={l.id}>
                <b>{l.label}:</b> {l.tip}
              </li>
            ))}
          </ul>
        </HowItWorks>
      </span>
      <Segmented<CannLevel> small label="Cannibalization level" value={state.level} onChange={(v) => update((s) => ({ ...s, level: v }))} options={CANN_LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
      <Pending q={3} />
    </span>
  );
}

const CONTROL: Record<SettingKey, () => ReactNode> = { baseline: BaselineControl, basis: BasisControl, cann: CannControl };

/**
 * "Calculation settings": the controls that change more than one block of the view (layout rule 5). A control that
 * changes nothing in the view is not shown; one that changes a single block lives in that block's header
 * (BlockSettings). `children` adds view-specific selectors (e.g. the promotion to compare in Promo Run Trend).
 */
export function ViewControls({ children }: { children?: ReactNode }) {
  const { state } = useFilters();
  const keys = barSettings(state.tab);
  if (keys.length === 0 && !children) return null;
  return (
    <div className="toggle-row view-toggles calc-settings" role="group" aria-label="Calculation settings">
      <span className="calc-settings-title">Calculation settings</span>
      {keys.map((k) => {
        const C = CONTROL[k];
        return <C key={k} />;
      })}
      {children}
    </div>
  );
}

/** Controls that change only this block, shown in its header (layout rule 5). */
export function BlockSettings({ block }: { block: BlockId }) {
  const { state } = useFilters();
  const keys = blockSettings(state.tab, block);
  if (keys.length === 0) return null;
  return (
    <span className="block-settings" role="group" aria-label="Settings for this block">
      {keys.map((k) => {
        const C = CONTROL[k];
        return <C key={k} />;
      })}
    </span>
  );
}

/** Rows (Price Group / Subcategory / Category / Department): changes only the table, so it lives in its header. */
export function RowsControl() {
  const { state, update } = useFilters();
  return (
    <span className="toggle-group rows-control">
      <span className="toggle-label">
        Rows <InfoTip text="Affects: this table only (how its rows are grouped). Totals and every other block stay the same." label="Rows: what it affects" />
      </span>
      <Segmented<Rollup>
        small
        label="Table rows: roll up by"
        value={state.rollup}
        onChange={(v) => update((s) => ({ ...s, rollup: v }))}
        options={[
          { value: 'event', label: 'Price Group' },
          { value: 'sub', label: 'Subcategory' },
          { value: 'cat', label: 'Category' },
          { value: 'dept', label: 'Department' },
        ]}
      />
    </span>
  );
}

/** Active-value tags of the settings that change this block (layout rule 6); nothing when no setting does. */
export function SettingTags({ block }: { block: BlockId }) {
  const { state } = useFilters();
  const tags = tagsFor(state.tab, block, state);
  if (tags.length === 0) return null;
  return (
    <span className="setting-tags" data-block={block}>
      {tags.map((t, i) => (
        <span key={t.key} className="setting-item">
          {i > 0 && (
            <span className="setting-sep" aria-hidden="true">
              {' · '}
            </span>
          )}
          <span className={`setting-tag tip below${t.changed ? ' is-changed' : ''}`} tabIndex={0} data-setting={t.key} aria-label={`${SETTING_LABEL[t.key]}: ${t.text}. ${t.affects}`}>
            {t.text}
            <span className="tip-body" role="tooltip" aria-hidden="true">
              {t.affects}
            </span>
          </span>
        </span>
      ))}
    </span>
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
