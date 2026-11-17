import { useMemo, useState } from 'react';
import { Banner, BannerStack, KeyFigures, SectionHeading, type Tile } from '../components/Blocks';
import { Bridge, ChartCard, ChartGrid, DailyVsBaseline, type BridgeStep } from '../components/Charts';
import { HierTable } from '../components/HierTable';
import { Pending, Segmented } from '../components/ui';
import { shortDay } from '../data/calendar';
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { useFilters } from '../lib/filterStore';
import { moneyCompact, moneyUnit, pct, pctChange, signedMoney, volumeCompact } from '../lib/format';
import { CANN_LEVELS, dailySeries, derive, eventAgg, sumAggs } from '../lib/metrics';
import { getScope } from '../lib/selectors';
import { basisWord, columnsOf, EmptyState, eventDates, performanceRows, unitsText, uomFirst, uomPct, ViewControls, type ViewProps } from './common';
import { RunsCompare } from './RunsCompare';

const HB_STORY =
  'As a Category Manager, I want to track the effectiveness of Hot Buys starting at the price group level, with the ability to drill down to each item and roll up to category (including cannibalization), so that I can make better decisions on when to run certain promotions for certain items.';
const OTHER_STORY =
  'As a Category Manager, I want to track TPRs, BOGOs, price locks and other promotions by price group, with item-level drill down and a category-level view, so that I can evaluate overall program performance, see which items drive the result (e.g., seasonal vs. everyday items), and adjust future runs and orders.';

const HB_COLS = ['dates', 'gross', 'net', 'units', 'baseSales', 'baseUnits', 'incSales', 'incUnits', 'salesLift', 'unitLift', 'gm', 'gmPct', 'baseGm', 'incGm', 'netGm', 'catIncSales', 'catIncGm', 'cannSales', 'cannRate', 'netIncSales', 'netIncGm'];
const HB_HIDDEN = ['dates', 'net', 'catIncGm', 'netGm', 'incSales'];
const OTHER_COLS = ['type', 'dates', 'gross', 'net', 'units', 'baseSales', 'salesLift', 'unitLift', 'gm', 'gmPct', 'incGm', 'netGm', 'catIncSales', 'cannSales', 'netIncGm'];
const OTHER_HIDDEN = ['dates', 'net', 'netGm'];

export function PerformanceView({ openDefinitions, variant }: ViewProps & { variant: 'hotbuy' | 'other' }) {
  const { state, update } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const hb = variant === 'hotbuy';
  const basis = state.basis;
  const cols = useMemo(() => {
    const c = columnsOf(hb ? HB_COLS : OTHER_COLS, hb ? HB_HIDDEN : OTHER_HIDDEN);
    return hb ? c : [...c.slice(0, 5), { key: 'share', label: 'Share of price group %', group: 'Sales' as const, cell: () => '', sort: () => null }, ...c.slice(5)];
  }, [hb]);
  const [bridgeScope, setBridgeScope] = useState<'event' | 'all'>('event');

  const table = useMemo(
    () =>
      performanceRows({
        events: scope.events,
        ctx: scope.ctx,
        basis,
        rollup: state.rollup,
        cols,
        selected: state.sel,
        onSelect: (e) => update((s) => ({ ...s, sel: e })),
        share: !hb,
      }),
    [scope, basis, state.rollup, state.sel, cols, hb, update],
  );
  const all = useMemo(() => derive(sumAggs([...table.aggs.values()]), basis), [table, basis]);
  const perEvent = useMemo(() => scope.events.map((e) => ({ e, m: derive(table.aggs.get(e)!, basis) })), [scope.events, table, basis]);

  const sel = scope.events.includes(state.sel) ? state.sel : [...perEvent].sort((a, b) => b.m.sales - a.m.sales)[0]?.e ?? -1;
  const selEvent = sel >= 0 ? EVENTS[sel] : null;
  const selM = sel >= 0 ? derive(table.aggs.get(sel)!, basis) : null;

  const daily = useMemo(() => {
    if (!selEvent) return null;
    const from = selEvent.start - Math.min(28, state.baseline * 7);
    const s = dailySeries(selEvent, scope.ctx, from, selEvent.end + 7);
    const key = basis === 'net' ? 'net' : 'gross';
    return s.days.map((d) => ({
      x: shortDay(d.day),
      actual: d[key],
      baseline: s.baseline[key],
      phase: d.day < s.window.from ? ('before' as const) : d.day < selEvent.start ? ('baseline' as const) : d.day <= selEvent.end ? ('promo' as const) : ('after' as const),
    }));
  }, [selEvent, scope.ctx, basis, state.baseline]);

  const bridgeM = bridgeScope === 'all' ? all : selM;
  const bridge: BridgeStep[] = bridgeM
    ? [
        { label: 'Promo item lift', value: bridgeM.incSales ?? 0, kind: 'delta' },
        { label: 'Cannibalization', value: bridgeM.cannSales ?? 0, kind: 'delta' },
        { label: 'Net incremental', value: bridgeM.netIncSales ?? 0, kind: 'total' },
        { label: 'Rest of category', value: (bridgeM.catIncSales ?? 0) - (bridgeM.netIncSales ?? 0), kind: 'delta' },
        { label: 'Category incremental', value: bridgeM.catIncSales ?? 0, kind: 'total' },
      ]
    : [];

  // Runs of the selected promo (same price group and promo type) side by side, Other Promo Performance.
  const runs = useMemo(() => {
    if (hb || !selEvent) return [];
    return EVENTS.filter((e) => e.pg === selEvent.pg && e.type === selEvent.type && e.start >= scope.range.start - 728).map((e) => e.idx).slice(-6);
  }, [hb, selEvent, scope.range.start]);
  const runMetrics = useMemo(() => runs.map((e) => derive(eventAgg(EVENTS[e], scope.ctx), basis)), [runs, scope.ctx, basis]);

  const losers = perEvent.filter((x) => (x.m.netIncGm ?? 0) < 0);
  const cannTop = [...perEvent].filter((x) => (x.m.salesLift ?? 0) > 0.8 && (uomFirst(x.m.cannRate) ?? 0) > 0.25).sort((a, b) => (uomFirst(b.m.cannRate) ?? 0) - (uomFirst(a.m.cannRate) ?? 0))[0];
  const levelWord = CANN_LEVELS.find((l) => l.id === state.level)!.label.toLowerCase();
  const typeWord = hb ? 'Hot Buys' : scope.types.length === 1 ? `${PROMO_LABEL[scope.types[0]]} events` : 'promotions';

  const tiles: Tile[] = [
    {
      label: 'Promo Sales $',
      info: 'Gross Sales (before discounts) and Net Customer Sales (after discounts) of the promoted items on promo days.',
      value: (
        <>
          {moneyCompact(all.gross)}
          <br />
          {moneyCompact(all.net)}
        </>
      ),
      two: true,
      sub: 'Gross · Net Customer',
    },
    { label: 'Promo Units', info: 'Units (ea) and pounds (lb) sold on promo days. Never added together.', value: unitsText(all.units), two: all.units.ea > 0 && all.units.lb > 0, sub: `Baseline ${all.baseUnits.ea > 0 ? volumeCompact(all.baseUnits.ea, 'ea') : volumeCompact(all.baseUnits.lb, 'lb')}` },
    {
      label: 'Sales / Unit Lift %',
      info: `Incremental ÷ Baseline, on ${basisWord(basis)} and on units. Baseline = ${state.baseline}-week average before each event.`,
      value: pctChange(all.salesLift),
      sub: <>Units {uomPct(all.unitLift, true)}</>,
      pending: 6,
    },
    { label: 'Promo GM $ / %', info: `${basisWord(basis)} − cost of goods sold, before vendor funding. GM % = GM $ ÷ ${basisWord(basis)}.`, value: moneyCompact(all.gm), sub: <>{pct(all.gmPct)} margin rate</>, pending: 7 },
    { label: 'Incremental GM $', info: 'Promo GM $ − Baseline GM $ (before cannibalization and vendor funding).', value: signedMoney(all.incGm), sub: <>Baseline GM {moneyCompact(all.baseGm)}</> },
    {
      label: 'Net Incremental GM $',
      info: 'Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ (all funding types). The main "did it pay off" number.',
      value: signedMoney(all.netIncGm),
      sub: <>Funding {moneyCompact(all.funding)} · {losers.length} of {perEvent.length} below zero</>,
      pending: 3,
    },
  ];

  if (scope.events.length === 0)
    return (
      <>
        <Heading hb={hb} />
        <ViewControls rollup />
        <EmptyState>No {typeWord} start in {scope.range.label} for the current filters. Try a longer period or clear a filter.</EmptyState>
      </>
    );

  return (
    <>
      <Heading hb={hb}>
        {scope.events.length} {typeWord} starting {scope.range.label}: Promo Sales <b>{moneyCompact(all.sales)}</b> ({basisWord(basis)}), Sales Lift <b>{pctChange(all.salesLift)}</b>, Net Incremental GM{' '}
        <b>{signedMoney(all.netIncGm)}</b> after cannibalization ({levelWord} level) and vendor funding.
        {scope.ctx.storeShare && ' Store values are the chain value × the selected stores’ share of each department.'}
        {scope.itemFiltered && ' Product filters narrow the items inside each price group; cannibalization stays measured for the whole price group.'}
      </Heading>

      <BannerStack>
        {cannTop && (
          <Banner lead="High lift, high cannibalization:" details={{ label: 'Show this event', onClick: () => update((s) => ({ ...s, sel: cannTop.e })) }}>
            {PRICE_GROUPS[EVENTS[cannTop.e].pg].name} ({eventDates(EVENTS[cannTop.e])}) lifted sales <b>{pctChange(cannTop.m.salesLift)}</b>, but <b>{pct(uomFirst(cannTop.m.cannRate))}</b> of its incremental units came from other items at {levelWord} level; Net Incremental GM{' '}
            <b>{signedMoney(cannTop.m.netIncGm)}</b>.
          </Banner>
        )}
        {losers.length > 0 && (
          <Banner lead="Did not pay off:" kind="note">
            {losers.length} of {perEvent.length} {typeWord} have a negative Net Incremental GM $ in this selection (sort the table by Net Incremental GM $ to see them).
          </Banner>
        )}
        {all.partialBaseline > 0 && (
          <Banner lead="Short baseline:" kind="note">
            {all.partialBaseline} event{all.partialBaseline > 1 ? 's' : ''} started less than {state.baseline} weeks after the start of the data (FY2024), so the baseline uses the weeks available.
          </Banner>
        )}
      </BannerStack>

      <ViewControls rollup />

      <KeyFigures
        caption={`${scope.range.name} · ${scope.events.length} ${typeWord} · ${basisWord(basis)} · ${state.baseline}-week baseline`}
        tiles={tiles}
        note={
          hb ? (
            <>
              <b>Hot Buy Score:</b> Scoring method to be defined. It will rate each Hot Buy from the core metrics once Weis agrees the method.{' '}
              <button type="button" className="btn-link" onClick={() => openDefinitions('score')}>
                Definition
              </button>
            </>
          ) : undefined
        }
      />

      <section className="card table-card" aria-label={hb ? 'Hot Buy events' : 'Promotions by price group'}>
        <header className="table-head">
          <div>
            <h3 className="chart-title">{hb ? 'Hot Buy events by price group' : 'Promotions by price group'}</h3>
            <p className="chart-sub">
              One row per event at price group level. Expand a row for its SKU Numbers{hb ? '' : ' and each item’s share of the price group result'}; click a row to show it in the charts. Cannibalization is measured for the price group, so SKU rows show —.
            </p>
          </div>
        </header>
        <HierTable
          hierarchy={state.rollup === 'event' ? 'Price group · event' : 'Hierarchy'}
          columns={cols}
          rows={table.rows}
          total={table.total}
          defaultSort={{ key: 'netIncGm', dir: 'desc' }}
          tableId={hb ? 'hb' : 'oth'}
          exportTitle={hb ? 'Hot Buy Performance' : 'Other Promo Performance'}
          maxHeight={560}
        />
      </section>

      {selEvent && selM && (
        <ChartGrid cols={2}>
          <ChartCard
            title={`Daily ${basisWord(basis)} vs. baseline`}
            subtitle={
              <>
                {PRICE_GROUPS[selEvent.pg].name} · {selEvent.id} · baseline {moneyCompact((daily?.[0]?.baseline ?? 0) * 7)} / week
              </>
            }
            legend={[
              { label: 'Daily sales', color: '#2d63a0' },
              { label: 'Baseline (daily average)', color: '#797873' },
            ]}
            table={daily ? { head: ['Day', 'Phase', 'Sales $', 'Baseline $'], rows: daily.map((d) => [d.x, d.phase, Math.round(d.actual), Math.round(d.baseline)]) } : undefined}
            height={260}
          >
            <DailyVsBaseline data={daily ?? []} format={moneyUnit} tickFormat={moneyCompact} actualLabel={`${basisWord(basis)}`} />
          </ChartCard>
          <ChartCard
            title={`${hb ? 'Category / subcategory' : 'Category'} bridge`}
            subtitle={
              <span className="chart-sub-tools">
                {bridgeScope === 'event' ? `${PRICE_GROUPS[selEvent.pg].name} in ${CATS[PRICE_GROUPS[selEvent.pg].cat].name}` : `All ${scope.events.length} events in the table`} · {levelWord} level <Pending q={5} />
                <Segmented<'event' | 'all'>
                  small
                  label="Bridge scope"
                  value={bridgeScope}
                  onChange={setBridgeScope}
                  options={[
                    { value: 'event', label: 'Selected event' },
                    { value: 'all', label: 'All events' },
                  ]}
                />
              </span>
            }
            table={{ head: ['Step', 'Sales $'], rows: bridge.map((b) => [b.label, Math.round(b.value)]) }}
            height={260}
          >
            <Bridge steps={bridge} format={moneyCompact} />
          </ChartCard>
        </ChartGrid>
      )}

      {!hb && selEvent && (
        <section className="card table-card" aria-label="Runs of the same promotion">
          <header className="table-head">
            <div>
              <h3 className="chart-title">
                Runs of the same promo: {PRICE_GROUPS[selEvent.pg].name} · {PROMO_LABEL[selEvent.type]}
              </h3>
              <p className="chart-sub">Up to six runs, side by side, from two years before the selected period. Click a run to show it in the charts. Promo Run Trend has the full history.</p>
            </div>
          </header>
          <RunsCompare runs={runs} metrics={runMetrics} selected={sel} onSelect={(e) => update((s) => ({ ...s, sel: e }))} title="Runs of the same promo" />
        </section>
      )}
    </>
  );
}

function Heading({ hb, children }: { hb: boolean; children?: React.ReactNode }) {
  return (
    <SectionHeading
      eyebrow={hb ? 'Must Have · View 1 of 6' : 'Must Have · View 2 of 6'}
      title={hb ? 'Hot Buy Performance' : 'Other Promo Performance'}
      question={hb ? 'Did each Hot Buy pay off, for the item and for the category?' : 'How did TPRs, BOGOs, price locks and other reductions perform, and which items drove the result?'}
      story={hb ? HB_STORY : OTHER_STORY}
      validate="Baseline window (#6), cannibalization level (#5), Promo GM % denominator (#7) and which vendor funding Net GM $ adds (#3)."
    >
      {children}
    </SectionHeading>
  );
}
