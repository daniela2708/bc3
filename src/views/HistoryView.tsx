import { useMemo, useState } from 'react';
import { KeyFigures, SectionHeading, ViewSummary, type Tile } from '../components/Blocks';
import { ChartCard, ChartGrid, HBars, hbarHeight, SignedColumns } from '../components/Charts';
import { HeatMap } from '../components/HeatMap';
import { HierTable } from '../components/HierTable';
import { Term } from '../components/Term';
import { Pending, Segmented } from '../components/ui';
import { FUNDING_BEHIND_SCENES } from '../lib/definitions';
import { buildHeatmap, heatHeight, MONTHS, type HeatMeasure, type HeatRows } from '../lib/heatmap';
import { fiscalOfDay } from '../data/calendar';
import { ITEMS, pgByName, PRICE_GROUPS } from '../data/products';
import { AD_TYPES, DEPTH_BANDS, depthBandOf, EVENTS } from '../data/promos';
import { useFilters } from '../lib/filterStore';
import { count, moneyCompact, moneyUnit, pct, pctChange, signedMoney, signedMoneyTile } from '../lib/format';
import { derive, eventAgg, sumAggs, type Agg } from '../lib/metrics';
import { getScope } from '../lib/selectors';
import { VIEW_INFO } from '../lib/viewInfo';
import { columnsOf, EmptyState, performanceRows, SettingTags, uomFirst, uomTile, ViewControls, type ViewProps } from './common';

const DEFAULT_PG = pgByName('Coca-Cola 12 pk 12 oz Cans').idx;
// Promo fatigue columns (prototype review, illustrative) right after the promo attributes.
const COLS = ['dates', 'type', 'depth', 'ad', 'promos52', 'daysSince', 'fatigue', 'avgRetail', 'gross', 'salesLift', 'unitLift', 'incGm', 'netIncGm'];

export default function HistoryView({ openDefinitions }: ViewProps) {
  const { state, update } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const basis = state.basis;
  const [grain, setGrain] = useState<'period' | 'week'>('period');
  const [heatRows, setHeatRows] = useState<HeatRows>('pg');
  const [heatMeasure, setHeatMeasure] = useState<HeatMeasure>('lift');

  const pg = state.pg >= 0 ? state.pg : state.item >= 0 ? ITEMS[state.item].pg : state.codes.length ? ITEMS[state.codes[0]].pg : -1;
  const nothing = pg < 0 && state.dept < 0 && state.cat < 0 && state.sub < 0 && !state.vb;
  const target = pg >= 0 ? pg : nothing ? DEFAULT_PG : -1;
  const events = useMemo(() => (target >= 0 ? scope.events.filter((e) => EVENTS[e].pg === target) : scope.events), [scope.events, target]);
  const cols = useMemo(() => columnsOf(COLS, ['gross']), []);
  const table = useMemo(
    () => performanceRows({ events, ctx: scope.ctx, basis, rollup: 'event', cols, selected: state.sel, onSelect: (e) => update((s) => ({ ...s, sel: e })) }),
    [events, scope.ctx, basis, cols, state.sel, update],
  );
  const all = useMemo(() => derive(sumAggs([...table.aggs.values()]), basis), [table, basis]);

  const by = <K extends string>(key: (e: number) => K, order: { id: K; label: string }[]) => {
    const g = new Map<K, Agg[]>();
    for (const e of events) g.set(key(e), [...(g.get(key(e)) ?? []), table.aggs.get(e)!]);
    return order.filter((o) => g.has(o.id)).map((o) => ({ label: o.label, n: g.get(o.id)!.length, m: derive(sumAggs(g.get(o.id)!), basis) }));
  };
  const byDepth = by((e) => depthBandOf(EVENTS[e].depth), DEPTH_BANDS);
  const byAd = by((e) => EVENTS[e].adType, AD_TYPES);
  const byTime = useMemo(() => {
    const g = new Map<string, { sort: number; aggs: Agg[] }>();
    for (const e of events) {
      const f = fiscalOfDay(EVENTS[e].start);
      const k = grain === 'period' ? `P${f.period} FY${String(f.fy).slice(2)}` : `W${f.week} FY${String(f.fy).slice(2)}`;
      const sort = f.fy * 100 + (grain === 'period' ? f.period : f.week);
      const cur = g.get(k) ?? { sort, aggs: [] };
      cur.aggs.push(table.aggs.get(e)!);
      g.set(k, cur);
    }
    return [...g.entries()].sort((a, b) => a[1].sort - b[1].sort).map(([x, v]) => ({ x, n: v.aggs.length, m: derive(sumAggs(v.aggs), basis) }));
  }, [events, grain, table, basis]);

  // Promotion timing heat map: every event of the selection (not only the table's price group), by month of the year.
  const heat = useMemo(() => buildHeatmap(scope.events, (e) => table.aggs.get(e) ?? eventAgg(EVENTS[e], scope.ctx), basis, heatRows, heatMeasure), [scope.events, scope.ctx, table, basis, heatRows, heatMeasure]);
  const heatFmt = (v: number | null) => (heatMeasure === 'lift' ? pctChange(v) : moneyCompact(v));
  const heatLabel = heatMeasure === 'lift' ? 'Sales Lift %' : 'Avg Net Incremental GM $ per event';
  const heatRowLabel = heatRows === 'pg' ? 'Price group' : 'Category';

  const name = state.item >= 0 ? ITEMS[state.item].name : target >= 0 ? PRICE_GROUPS[target].name : 'the selected items';
  const best = [...byDepth].sort((a, b) => (b.m.netIncGm ?? -Infinity) - (a.m.netIncGm ?? -Infinity))[0];

  if (events.length === 0)
    return (
      <>
        <Heading />
        <ViewControls />
        <EmptyState>No past promotions for {name} with the current filters. Pick a SKU Number or price group, or widen the period.</EmptyState>
      </>
    );

  const tiles: Tile[] = [
    { label: 'Promo Event Count', labelNode: <>Promo <Term id="event">Event</Term> Count</>, info: 'Times the item or price group was promoted in the period.', value: count(events.length) },
    { label: 'Promo Depth %', info: 'Average (Regular retail − Promo retail) ÷ Regular retail across the events.', value: pct(all.avgDepth, 0), sub: 'average across events' },
    { label: 'Avg Promo Retail $', info: 'Promo Sales $ (selected sales basis) ÷ Promo Units; per lb for random-weight items.', value: moneyUnit(uomFirst(all.avgRetail)), sub: all.avgRetail.lb !== null ? 'per lb' : 'per unit' },
    { label: 'Sales Lift %', info: 'Incremental Sales $ ÷ Baseline Sales $, all events.', value: pctChange(all.salesLift), pending: 4 },
    { label: 'Unit Lift %', info: 'Incremental Units ÷ Baseline Units, all events.', ...uomTile(all.unitLift, true), pending: 4 },
    { label: 'Incremental GM $', info: 'Promo GM $ − Baseline GM $, before cannibalization and funding.', value: signedMoneyTile(all.incGm) },
    { label: 'Net Incremental GM $', info: `${FUNDING_BEHIND_SCENES} Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $.`, value: signedMoneyTile(all.netIncGm), pending: 7 },
  ];

  const lift = (rows: typeof byDepth) => rows.map((r) => ({ label: `${r.label} (${r.n})`, value: r.m.salesLift ?? 0 }));
  const gm = (rows: typeof byDepth) => rows.map((r) => ({ label: `${r.label} (${r.n})`, value: r.m.netIncGm ?? 0, color: (r.m.netIncGm ?? 0) >= 0 ? '#2e7d4f' : '#c62828' }));
  const tbl = (rows: typeof byDepth, head: string) => ({ head: [head, 'Events', 'Sales Lift %', 'Net Incremental GM $'], rows: rows.map((r) => [r.label, r.n, pctChange(r.m.salesLift), Math.round(r.m.netIncGm ?? 0)]) });

  return (
    <>
      <Heading />

      <ViewControls />
      <KeyFigures tags={<SettingTags block="tiles" />} caption={`${name} · ${scope.range.name}`} tiles={tiles} />

      <ViewSummary>
      {name}: <b>{events.length}</b> promotions in {scope.range.name.toLowerCase()}, average depth <b>{pct(all.avgDepth, 0)}</b>, Sales Lift <b>{pctChange(all.salesLift)}</b>. {best && <>The <b>{best.label}</b> depth band returned the most Net Incremental GM ({signedMoney(best.m.netIncGm)}).</>}
      {nothing && ' Showing Coca-Cola 12 pk by default; pick a SKU Number or price group in the filters.'}
      </ViewSummary>

      <ChartGrid cols={1}>
        <ChartCard
          title={`Results by ${grain === 'period' ? 'fiscal period' : 'fiscal week'}`}
          tags={<SettingTags block="periodChart" />}
          subtitle={
            <span className="chart-sub-tools">
              Net Incremental GM $ of the promotions that started in each {grain}; event count in brackets, hover for lift.
              <Segmented<'period' | 'week'>
                small
                label="Group results by"
                value={grain}
                onChange={setGrain}
                options={[
                  { value: 'period', label: 'Period' },
                  { value: 'week', label: 'Week' },
                ]}
              />
            </span>
          }
          table={{ head: [grain === 'period' ? 'Period' : 'Week', 'Events', 'Sales Lift %', 'Net Incremental GM $'], rows: byTime.map((r) => [r.x, r.n, pctChange(r.m.salesLift), Math.round(r.m.netIncGm ?? 0)]) }}
          height={240}
        >
          <SignedColumns
            data={byTime.map((r) => ({
              x: `${r.x} (${r.n})`,
              value: r.m.netIncGm,
              tip: [
                { label: 'Net Incremental GM $', value: moneyCompact(r.m.netIncGm) },
                { label: 'Sales Lift %', value: pctChange(r.m.salesLift) },
                { label: 'Events', value: String(r.n) },
              ],
            }))}
            format={moneyCompact}
            valueLabel="Net Incremental GM $"
          />
        </ChartCard>
      </ChartGrid>

      <ChartGrid cols={2}>
        <ChartCard tags={<SettingTags block="depthCharts" />} title="Sales Lift % by Promo Depth Band" subtitle={<>Number of events in brackets <Pending q={10} /></>} table={tbl(byDepth, 'Depth band')} height={hbarHeight(byDepth.length)}>
          <HBars data={lift(byDepth)} format={(v) => pctChange(v)} valueLabel="Sales Lift %" labelWidth={130} />
        </ChartCard>
        <ChartCard tags={<SettingTags block="depthCharts" />} title="Net Incremental GM $ by Promo Depth Band" subtitle="Margin after cannibalization and vendor funding" table={tbl(byDepth, 'Depth band')} height={hbarHeight(byDepth.length)}>
          <HBars data={gm(byDepth)} format={moneyCompact} valueLabel="Net Incremental GM $" diverging labelWidth={130} />
        </ChartCard>
        <ChartCard tags={<SettingTags block="adCharts" />} title="Sales Lift % by Ad Type / Vehicle" subtitle={<>Number of events in brackets <Pending q={10} /></>} table={tbl(byAd, 'Ad type')} height={hbarHeight(byAd.length)}>
          <HBars data={lift(byAd)} format={(v) => pctChange(v)} valueLabel="Sales Lift %" labelWidth={130} />
        </ChartCard>
        <ChartCard tags={<SettingTags block="adCharts" />} title="Net Incremental GM $ by Ad Type / Vehicle" subtitle="Margin after cannibalization and vendor funding" table={tbl(byAd, 'Ad type')} height={hbarHeight(byAd.length)}>
          <HBars data={gm(byAd)} format={moneyCompact} valueLabel="Net Incremental GM $" diverging labelWidth={130} />
        </ChartCard>
      </ChartGrid>

      <ChartGrid cols={1}>
        <ChartCard
          title="Promotion timing heat map"
          titleChip={<span className="chip status-proposed">New request · production data from Cognira (pending)</span>}
          subtitle={`${heatLabel} of the events that started in each month, all ${scope.events.length} events in the selection`}
          tags={<SettingTags block="heatmap" />}
          controls={
            <>
              <span className="toggle-group">
                <span className="toggle-label">Rows</span>
                <Segmented<HeatRows>
                  small
                  label="Heat map rows"
                  value={heatRows}
                  onChange={setHeatRows}
                  options={[
                    { value: 'pg', label: 'Price group' },
                    { value: 'cat', label: 'Category' },
                  ]}
                />
              </span>
              <span className="toggle-group">
                <span className="toggle-label">Color</span>
                <Segmented<HeatMeasure>
                  small
                  label="Heat map colour"
                  value={heatMeasure}
                  onChange={setHeatMeasure}
                  options={[
                    { value: 'lift', label: 'Sales Lift %' },
                    { value: 'netIncGm', label: 'Net Incremental GM $' },
                  ]}
                />
              </span>
            </>
          }
          tableNote={`Rows: ${heatRowLabel.toLowerCase()}, most events first (event count in brackets). Month of the event start. Sales Lift % is a ratio of totals over the events in the cell; Net Incremental GM $ is the average per event. Empty = no event.`}
          table={{ head: [heatRowLabel, 'Events', ...MONTHS], rows: heat.rows.map((r) => [r.label, r.n, ...r.cells.map((c) => (c.n === 0 ? '' : `${heatFmt(c.value)} (${c.n})`))]) }}
          height={Math.min(420, heatHeight(heat.rows.length))}
          contentHeight={heatHeight(heat.rows.length)}
        >
          <HeatMap data={heat} format={heatFmt} measureLabel={heatLabel} rowLabel={heatRowLabel} highlight={heatRows === 'pg' ? target : undefined} />
        </ChartCard>
      </ChartGrid>

      <section className="card table-card" aria-label="Every past promotion">
        <header className="table-head">
          <div>
            <h3 className="chart-title">Every past promotion</h3>
            <p className="block-tags">
              <SettingTags block="table" />
            </p>
            <p className="chart-sub">One row per event of the <Term id="priceGroup">price group</Term>, with dates, Promo Type, Promo Depth %, Ad Type / Vehicle, how often it was promoted before and results. Expand a row for its SKU Numbers.</p>
          </div>
        </header>
        <HierTable hierarchy="Price group · event" columns={cols} rows={table.rows} total={table.total} defaultSort={{ key: 'dates', dir: 'desc' }} tableId="hist" exportTitle="Promo History" maxHeight={480} />
      </section>
      <p className="table-note">
        Use Fiscal Calendar › Holiday period in the Time filter to line up holiday promotions year over year.{' '}
        <button type="button" className="btn-link" onClick={() => openDefinitions('depth')}>
          Depth and ad type definitions
        </button>
      </p>
    </>
  );
}

function Heading() {
  return <SectionHeading title="Promo History" objective={VIEW_INFO.history.objective} />;
}
