import { useMemo, useState } from 'react';
import { Banner, BannerStack, KeyFigures, SectionHeading, type Tile } from '../components/Blocks';
import { C, ChartCard, ChartGrid, DailyVsBaseline, SignedColumns, TrendLines } from '../components/Charts';
import { Level2, Pending, Segmented } from '../components/ui';
import { shortDay } from '../data/calendar';
import { ITEMS, pgByName, PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL, type PromoType } from '../data/promos';
import { RANDOM_WEIGHT_NOTE } from '../lib/definitions';
import { useFilters } from '../lib/filterStore';
import { count, moneyCompact, pct, pctChange, signedMoney, volume } from '../lib/format';
import { dailySeries, derive, eventAgg, POST_PROMO_WINDOW_DAYS, sumAggs } from '../lib/metrics';
import { getScope } from '../lib/selectors';
import { EmptyState, unitsText, uomFirst, uomPct, ViewControls, type ViewProps } from './common';
import { RunsCompare, runLabel } from './RunsCompare';

const STORY =
  'As a Category Manager, I want to compare how the same promotion performs each time it runs (e.g., a Hot Buy run in Q1, Q2 and Q3, and vs. prior years) at the price group level down to the item level, so that I can see whether it is trending up or down and adjust future runs.';
const DEFAULT_PG = pgByName('Cheerios Family Size').idx;

export default function RunTrendView({ openDefinitions }: ViewProps) {
  const { state } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const basis = state.basis;

  // The price group: the one picked in the filters, the SKU's group, the group with most runs in scope, or the default.
  const pg = useMemo(() => {
    if (state.pg >= 0) return state.pg;
    if (state.item >= 0) return ITEMS[state.item].pg;
    const nothingPicked = state.dept < 0 && state.cat < 0 && state.sub < 0 && !state.vb && state.codes.length === 0 && state.event < 0;
    if (nothingPicked) return DEFAULT_PG;
    const counts = new Map<number, number>();
    for (const e of scope.events) counts.set(EVENTS[e].pg, (counts.get(EVENTS[e].pg) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
  }, [state, scope.events]);
  const isDefault = pg === DEFAULT_PG && state.pg < 0 && state.item < 0;

  const typesHere = useMemo(() => {
    const t = new Map<PromoType, number>();
    for (const e of scope.events) if (EVENTS[e].pg === pg) t.set(EVENTS[e].type, (t.get(EVENTS[e].type) ?? 0) + 1);
    return [...t.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [scope.events, pg]);
  const [pickedType, setPickedType] = useState<PromoType | null>(null);
  const runType: PromoType | undefined = state.promoType !== 'all' ? state.promoType : pickedType && typesHere.includes(pickedType) ? pickedType : typesHere[0];

  const runs = useMemo(() => scope.events.filter((e) => EVENTS[e].pg === pg && EVENTS[e].type === runType), [scope.events, pg, runType]);
  const aggs = useMemo(() => runs.map((e) => eventAgg(EVENTS[e], scope.ctx)), [runs, scope.ctx]);
  const metrics = useMemo(() => aggs.map((a) => derive(a, basis)), [aggs, basis]);
  const all = useMemo(() => derive(sumAggs(aggs), basis), [aggs, basis]);
  const [selRun, setSelRun] = useState(-1);
  const sel = runs.includes(selRun) ? selRun : runs[runs.length - 1] ?? -1;

  const units = useMemo(() => {
    if (sel < 0) return null;
    const e = EVENTS[sel];
    const s = dailySeries(e, scope.ctx, e.start - 28, e.end + POST_PROMO_WINDOW_DAYS);
    return s.days.map((d) => ({
      x: shortDay(d.day),
      actual: d.units,
      baseline: s.baseline.units,
      phase: d.day < s.window.from ? ('before' as const) : d.day < e.start ? ('baseline' as const) : d.day <= e.end ? ('promo' as const) : ('after' as const),
    }));
  }, [sel, scope.ctx]);

  const name = pg >= 0 ? (state.item >= 0 && ITEMS[state.item].pg === pg ? ITEMS[state.item].name : PRICE_GROUPS[pg].name) : '';
  const uom = pg >= 0 ? PRICE_GROUPS[pg].uom : 'ea';
  const first = metrics[0];
  const last = metrics[metrics.length - 1];
  const trendDown = first && last && runs.length >= 3 && (last.salesLift ?? 0) < (first.salesLift ?? 0) - 0.15;

  if (pg < 0 || runs.length === 0)
    return (
      <>
        <Heading />
        <ViewControls cann={false} />
        <EmptyState>No runs for the current filters. Pick a price group or SKU Number with promo history, or widen the period.</EmptyState>
      </>
    );

  const tiles: Tile[] = [
    { label: 'Promo Event Count', info: 'Number of runs of this promotion (same price group and promo type) in the period.', value: count(runs.length), sub: `${PROMO_LABEL[runType!]} runs` },
    { label: 'Total Gross Sales', info: 'Gross sales of the promoted items on promo days, all runs.', value: moneyCompact(all.gross) },
    { label: 'Promo Units', info: `Units or pounds sold on promo days, all runs; random-weight items count pounds, as in Total Volume (UC2). ${RANDOM_WEIGHT_NOTE}`, value: unitsText(all.units) },
    { label: 'Promo GM $ / %', info: `Promo GM $ (cost per #15: DC average cost minus scan-downs, DSD replacement cost); GM % on the selected sales basis, denominator pending (#5). Margin scope pending (#7). ${RANDOM_WEIGHT_NOTE}`, value: moneyCompact(all.gm), sub: <>{pct(all.gmPct)} margin rate</>, pending: 15 },
    { label: 'Sales / Unit Lift %', info: 'Incremental ÷ Baseline, all runs (ratio of totals).', value: pctChange(all.salesLift), sub: <>Units {uomPct(all.unitLift, true)}</>, pending: 4 },
    { label: 'Net Incremental GM $', info: `Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ (the funding #7 allows). ${RANDOM_WEIGHT_NOTE}`, value: signedMoney(all.netIncGm), sub: <>Incremental GM {signedMoney(all.incGm)}</>, pending: 7 },
    { label: 'YoY Gross Sales Growth', info: 'Promo-day gross sales vs. the same days last year (364 days earlier), runs with last-year history.', value: pctChange(all.yoy.pct), sub: <>LY {moneyCompact(all.ly)} · {signedMoney(all.yoy.abs)}</> },
  ];

  const trendData = runs.map((e, i) => ({ x: shortDay(EVENTS[e].start), sales: metrics[i].salesLift, units: uomFirst(metrics[i].unitLift) }));

  return (
    <>
      <Heading>
        {name}: {runs.length} {PROMO_LABEL[runType!]} runs in {scope.range.name.toLowerCase()}. Sales Lift went from <b>{pctChange(first.salesLift)}</b> ({runLabel(runs[0])}) to <b>{pctChange(last.salesLift)}</b> ({runLabel(runs[runs.length - 1])}); Net Incremental GM per run from{' '}
        <b>{signedMoney(first.netIncGm)}</b> to <b>{signedMoney(last.netIncGm)}</b>.{isDefault && ' Showing the Cheerios Family Size Hot Buy by default; pick a price group or SKU Number in the filters.'}
      </Heading>

      <BannerStack>
        {trendDown && (
          <Banner lead="Trending down:">
            each run of this promotion lifts less than the one before it ({pctChange(first.salesLift)} → {pctChange(last.salesLift)}); consider a different depth, ad type or timing (see Promo History).
          </Banner>
        )}
      </BannerStack>

      <ViewControls cann>
        {typesHere.length > 1 && state.promoType === 'all' && (
          <span className="toggle-group">
            <span className="toggle-label">Promotion</span>
            <Segmented<PromoType> small label="Promo type to compare" value={runType!} onChange={setPickedType} options={typesHere.map((t) => ({ value: t, label: PROMO_LABEL[t] }))} />
          </span>
        )}
      </ViewControls>

      <KeyFigures caption={`${name} · ${PROMO_LABEL[runType!]} · ${scope.range.name}`} tiles={tiles} />

      <section className="card table-card" aria-label="Runs side by side">
        <header className="table-head">
          <div>
            <h3 className="chart-title">Each run side by side</h3>
            <p className="chart-sub">One column per run, oldest first. Click a run to show it in the before / during / after chart.</p>
          </div>
        </header>
        <RunsCompare runs={runs} metrics={metrics} selected={sel} onSelect={setSelRun} title="Promo Run Trend" />
      </section>

      <ChartGrid cols={2}>
        <ChartCard
          title="Lift across runs"
          subtitle="Sales Lift % and Unit Lift % per run (axis: run start date)"
          legend={[
            { label: 'Sales Lift %', color: C.s1 },
            { label: 'Unit Lift %', color: C.s2 },
          ]}
          table={{ head: ['Run', 'Sales Lift %', 'Unit Lift %'], rows: trendData.map((d) => [d.x, pctChange(d.sales), pctChange(d.units)]) }}
          height={240}
        >
          <TrendLines
            data={trendData}
            series={[
              { key: 'sales', label: 'Sales Lift %', color: C.s1 },
              { key: 'units', label: 'Unit Lift %', color: C.s2 },
            ]}
            format={(v) => pctChange(v)}
            tickFormat={(v) => pct(v, 0)}
          />
        </ChartCard>
        <ChartCard
          title="Net Incremental GM $ per run"
          subtitle={<>After cannibalization and vendor funding <Pending q={7} /></>}
          table={{ head: ['Run', 'Net Incremental GM $'], rows: runs.map((e, i) => [runLabel(e), Math.round(metrics[i].netIncGm ?? 0)]) }}
          height={240}
        >
          <SignedColumns data={runs.map((e, i) => ({ x: shortDay(EVENTS[e].start), value: metrics[i].netIncGm, tip: [{ label: `${runLabel(e)} · Net Incremental GM $`, value: moneyCompact(metrics[i].netIncGm) }] }))} format={moneyCompact} valueLabel="Net Incremental GM $" />
        </ChartCard>
      </ChartGrid>

      <section className="secondary-section" aria-label="Post-Promo Trend">
        <h3 className="secondary-title">
          Post-Promo Trend <Level2 />
        </h3>
        <p className="chart-sub">
          Units before, during and after each promo vs. baseline. Useful but outside the MVP (#8). Post-Promo Dip % compares units in the 4 weeks after the promo with baseline units for the same days; a negative value suggests pantry loading. It shows — until the 4 weeks have passed.{' '}
          <button type="button" className="btn-link" onClick={() => openDefinitions('dip')}>
            Definition
          </button>
        </p>
        <ChartGrid cols={2}>
          <ChartCard
            title={`Daily ${uom === 'lb' ? 'pounds' : 'units'} vs. baseline · ${runLabel(sel)}`}
            subtitle={`${EVENTS[sel].id} · four weeks before, the promo and four weeks after`}
            legend={[
              { label: uom === 'lb' ? 'Pounds' : 'Units', color: C.s1 },
              { label: 'Baseline (daily average)', color: C.axis },
            ]}
            table={units ? { head: ['Day', 'Phase', 'Volume', 'Baseline'], rows: units.map((d) => [d.x, d.phase, Math.round(d.actual), Math.round(d.baseline)]) } : undefined}
            height={240}
          >
            <DailyVsBaseline data={units ?? []} format={(v) => volume(v, uom)} tickFormat={(v) => volume(v, uom)} actualLabel={uom === 'lb' ? 'Pounds' : 'Units'} />
          </ChartCard>
          <ChartCard title="Post-Promo Dip % per run" subtitle="Units in the 4 weeks after vs. baseline (— until the 4 weeks have passed)" table={{ head: ['Run', 'Post-Promo Dip %'], rows: runs.map((e, i) => [runLabel(e), pctChange(uomFirst(metrics[i].dip))]) }} height={240}>
            <SignedColumns data={runs.map((e, i) => ({ x: shortDay(EVENTS[e].start), value: uomFirst(metrics[i].dip), tip: [{ label: `${runLabel(e)} · Post-Promo Dip %`, value: pctChange(uomFirst(metrics[i].dip)) }] }))} format={(v) => pct(v, 0)} valueLabel="Post-Promo Dip %" />
          </ChartCard>
        </ChartGrid>
      </section>
    </>
  );
}

function Heading({ children }: { children?: React.ReactNode }) {
  return (
    <SectionHeading
      eyebrow="Must Have · View 3 of 5"
      title="Promo Run Trend"
      question="Is the same promotion trending up or down each time it runs?"
      story={STORY}
      validate="Baseline (#4), sales basis and GM % denominator (#5), margin scope and funding (#7), cost (#15). Last Year Gross Sales and YoY growth reuse the UC1 definition."
    >
      {children}
    </SectionHeading>
  );
}
