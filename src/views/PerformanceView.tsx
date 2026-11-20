import { useMemo, useState } from 'react';
import { Banner, BannerStack, KeyFigures, SectionHeading, ViewSummary, type Tile } from '../components/Blocks';
import { Bridge, ChartCard, ChartGrid, type BridgeStep } from '../components/Charts';
import { HierTable } from '../components/HierTable';
import { EventPicker } from '../components/EventPicker';
import { Term } from '../components/Term';
import { Pending } from '../components/ui';
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { useFilters } from '../lib/filterStore';
import { moneyCompact, moneyTile, moneyUnit, pct, pctChange, signedMoney, signedMoneyTile, volumeCompact } from '../lib/format';
import { baselineText } from '../lib/baseline';
import { RANDOM_WEIGHT_NOTE } from '../lib/definitions';
import { CANN_LEVELS, derive, eventAgg, sumAggs } from '../lib/metrics';
import { SALES_COLUMNS } from '../lib/series';
import { ALL_EVENTS, bridgeEvent, bridgeSteps, chartEvent, eventOptions, selectedInTable } from '../lib/eventPick';
import { getScope } from '../lib/selectors';
import { VIEW_INFO } from '../lib/viewInfo';
import { basisWord, columnsOf, EmptyState, eventDates, performanceRows, RowsControl, salesPair, SettingTags, unitsTile, uomFirst, uomPct, ViewControls, type ViewProps } from './common';
import { PromoWindowCard } from './PromoWindowCard';
import { RunsCompare } from './RunsCompare';


const HB_COLS = ['dates', 'gross', 'net', 'units', 'baseSales', 'baseUnits', 'incSales', 'incUnits', 'salesLift', 'unitLift', 'gm', 'gmPct', 'baseGm', 'incGm', 'netGm', 'catIncSales', 'catIncGm', 'cannSales', 'cannRate', 'netIncSales', 'netIncGm'];
const HB_HIDDEN = ['dates', 'net', 'catIncGm', 'netGm', 'incSales'];
// Same layout as Hot Buy Performance (workbook); the extra KPI columns start hidden in the column chooser.
const OTHER_COLS = ['type', 'dates', 'gross', 'net', 'units', 'baseSales', 'baseUnits', 'incSales', 'incUnits', 'salesLift', 'unitLift', 'gm', 'gmPct', 'baseGm', 'incGm', 'netGm', 'catIncSales', 'catIncGm', 'cannSales', 'cannRate', 'netIncSales', 'netIncGm'];
const OTHER_HIDDEN = ['dates', 'net', 'netGm', 'incSales', 'cannRate', 'netIncSales'];

export function PerformanceView({ openDefinitions, variant }: ViewProps & { variant: 'hotbuy' | 'other' }) {
  const { state, update } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const hb = variant === 'hotbuy';
  const basis = state.basis;
  const cols = useMemo(() => {
    const c = columnsOf(hb ? HB_COLS : OTHER_COLS, hb ? HB_HIDDEN : OTHER_HIDDEN);
    return hb ? c : [...c.slice(0, 5), { key: 'share', label: 'Share of price group %', group: 'Sales' as const, cell: () => '', sort: () => null }, ...c.slice(5)];
  }, [hb]);
  /** The selected event when the user picked "All events" in the bridge (see eventPick.ts). */
  const [allAt, setAllAt] = useState<number | null>(null);

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

  // Sales vs. baseline chart: the selected event, else the one with the highest sales. Bridge: All events by default.
  const salesOf = (e: number) => perEvent.find((x) => x.e === e)?.m.sales ?? 0;
  const sel = chartEvent(state.sel, scope.events, salesOf);
  const selEvent = sel >= 0 ? EVENTS[sel] : null;
  const selM = sel >= 0 ? derive(table.aggs.get(sel)!, basis) : null;
  const bridgeSel = bridgeEvent(state.sel, scope.events, allAt);
  const pick = (v: string) => {
    if (v === ALL_EVENTS) setAllAt(selectedInTable(state.sel, scope.events) ?? -1);
    else update((s) => ({ ...s, sel: Number(v) }));
  };
  const optionsAll = useMemo(() => eventOptions(scope.events, true), [scope.events]);
  const optionsOne = useMemo(() => eventOptions(scope.events, false), [scope.events]);


  const bridgeM = bridgeSel === null ? all : derive(table.aggs.get(bridgeSel)!, basis);
  const bridge: BridgeStep[] = bridgeSteps(bridgeM);
  const bridgePg = bridgeSel === null ? null : PRICE_GROUPS[EVENTS[bridgeSel].pg];

  // Runs of the selected promo (same price group and promo type) side by side, Other Promo Performance.
  const runs = useMemo(() => {
    if (hb || !selEvent) return [];
    return EVENTS.filter((e) => e.pg === selEvent.pg && e.type === selEvent.type && e.start >= scope.range.start - 728).map((e) => e.idx).slice(-6);
  }, [hb, selEvent, scope.range.start]);
  const runMetrics = useMemo(() => runs.map((e) => derive(eventAgg(EVENTS[e], scope.ctx), basis)), [runs, scope.ctx, basis]);

  const losers = perEvent.filter((x) => (x.m.netIncGm ?? 0) < 0);
  const cannTop = [...perEvent].filter((x) => (x.m.salesLift ?? 0) > 0.8 && (uomFirst(x.m.cannRate) ?? 0) > 0.25).sort((a, b) => (uomFirst(b.m.cannRate) ?? 0) - (uomFirst(a.m.cannRate) ?? 0))[0];
  const levelWord = CANN_LEVELS.find((l) => l.id === state.level)!.label.toLowerCase();
  const baseWord = baselineText(scope.ctx.baselineWeeks);
  const typeWord = hb ? 'Hot Buys' : scope.types.length === 1 ? `${PROMO_LABEL[scope.types[0]]} events` : 'promotions';

  const tiles: Tile[] = [
    {
      label: 'Promo Sales $',
      info: 'Gross Sales (before discounts) and Net Customer Sales (after discounts) of the promoted items on promo days.',
      pair: salesPair(all.gross, all.net, basis),
    },
    { label: 'Promo Units', info: `Units (ea) and pounds (lb) sold on promo days; random-weight items count pounds, as in Total Volume (UC2). Never added together. ${RANDOM_WEIGHT_NOTE}`, ...unitsTile(all.units), sub: `Baseline ${all.baseUnits.ea > 0 ? volumeCompact(all.baseUnits.ea, 'ea') : volumeCompact(all.baseUnits.lb, 'lb')}` },
    {
      label: 'Sales / Unit Lift %',
      labelNode: (
        <>
          Sales / Unit <Term id="lift">Lift</Term> %
        </>
      ),
      info: `Incremental ÷ Baseline, on ${basisWord(basis)} and on units. Baseline: ${baseWord}, average of the weeks before each event.`,
      value: pctChange(all.salesLift),
      sub: <>Units {uomPct(all.unitLift, true)}</>,
      pending: 4,
    },
    {
      label: 'Promo GM $ / %',
      info: `${basisWord(basis)} − cost of goods sold. Cost (#15): DC items use the DC average cost minus scan-downs; DSD items the replacement cost that day. GM % = GM $ ÷ ${basisWord(basis)}; denominator pending (#5). Margin scope pending (#7). ${RANDOM_WEIGHT_NOTE}`,
      value: moneyTile(all.gm),
      sub: <>{pct(all.gmPct)} margin rate</>,
      pending: 15,
    },
    { label: 'Incremental GM $', labelNode: <><Term id="incremental">Incremental</Term> GM $</>, info: `Promo GM $ − Baseline GM $ (before cannibalization and the vendor funding Net GM adds). Margin scope pending (#7). ${RANDOM_WEIGHT_NOTE}`, value: signedMoneyTile(all.incGm), sub: <>Baseline GM {moneyTile(all.baseGm)}</>, pending: 7 },
    {
      label: 'Net Incremental GM $',
      info: `Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ (#7: scan-downs at the expected amount, bill-backs only for DSD items, no slotting or lump sums; DC scan-downs are already in the cost, #15). The main "did it pay off" number. ${RANDOM_WEIGHT_NOTE}`,
      value: signedMoneyTile(all.netIncGm),
      sub: <>{losers.length} of {perEvent.length} below zero</>,
      pending: 7,
    },
  ];

  if (scope.events.length === 0)
    return (
      <>
        <Heading hb={hb} />
        <ViewControls />
        <EmptyState>No {typeWord} start in {scope.range.label} for the current filters. Try a longer period or clear a filter.</EmptyState>
      </>
    );

  return (
    <>
      <Heading hb={hb} />

      <ViewControls />

      <KeyFigures
        tags={<SettingTags block="tiles" />}
        caption={`${scope.range.name} · ${scope.events.length} ${typeWord} · ${basisWord(basis)} · ${baseWord}`}
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

      <ViewSummary>
      {scope.events.length} {typeWord} starting {scope.range.label}: Promo Sales <b>{moneyCompact(all.sales)}</b> ({basisWord(basis)}), Sales Lift <b>{pctChange(all.salesLift)}</b>, Net Incremental GM{' '}
      <b>{signedMoney(all.netIncGm)}</b> after cannibalization ({levelWord} level) and vendor funding.
      {scope.ctx.storeShare && ' Store values are the chain value × the selected stores’ share of each department.'}
      {scope.itemFiltered && ' Product filters narrow the items inside each price group; cannibalization stays measured for the whole price group.'}
      </ViewSummary>

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
            {all.partialBaseline} event{all.partialBaseline > 1 ? 's' : ''} started less than one baseline window after the start of the data (FY2024), so the baseline uses the weeks available.
          </Banner>
        )}
      </BannerStack>

      {selEvent && selM && (
        <ChartGrid cols={2}>
          <PromoWindowCard
            key={selEvent.idx}
            event={selEvent}
            ctx={scope.ctx}
            seriesKey={basis === 'net' ? 'net' : 'gross'}
            measure={basisWord(basis)}
            columns={SALES_COLUMNS}
            format={moneyUnit}
            tickFormat={moneyCompact}
            baselineFormat={moneyCompact}
            block="salesChart"
            picker={<EventPicker value={String(selEvent.idx)} options={optionsOne} onChange={pick} />}
          />
          <ChartCard
            title={`${hb ? 'Category / subcategory' : 'Category'} bridge`}
            titleNode={
              <>
                {hb ? 'Category / subcategory' : 'Category'} <Term id="bridge">bridge</Term>
              </>
            }
            tags={
              <>
                <EventPicker value={bridgeSel === null ? ALL_EVENTS : String(bridgeSel)} options={optionsAll} onChange={pick} />
                <SettingTags block="bridge" />
              </>
            }
            subtitle={
              <>
                {bridgePg ? `${bridgePg.name} in ${CATS[bridgePg.cat].name}` : `All ${scope.events.length} events in the table`} · {levelWord} level <Pending q={3} />
                <br />
                Promo item lift, minus <Term id="cannibalization">cannibalization</Term> (or plus <Term id="halo">halo</Term>), equals <Term id="netIncremental">net incremental</Term>; plus the rest of the category equals{' '}
                <Term id="categoryIncremental">category incremental</Term>.
              </>
            }
            table={{ head: ['Step', 'Sales $'], rows: bridge.map((b) => [b.label, Math.round(b.value)]) }}
            height={260}
          >
            <Bridge steps={bridge} format={moneyCompact} />
          </ChartCard>
        </ChartGrid>
      )}

      <section className="card table-card" aria-label={hb ? 'Hot Buy events' : 'Promotions by price group'}>
        <header className="table-head">
          <div>
            <h3 className="chart-title">
              {hb ? 'Hot Buy events by ' : 'Promotions by '}
              <Term id="priceGroup">price group</Term>
            </h3>
            <p className="block-tags">
              <SettingTags block="table" />
            </p>
            <p className="chart-sub">
              One row per <Term id="event">event</Term> at price group level. Expand a row for its SKU Numbers{hb ? '' : ' and each item’s share of the price group result'}. Click a row, or pick an event in the charts above, to see it in detail. Cannibalization is measured for the price group, so SKU rows show —.
            </p>
          </div>
          <RowsControl />
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

      {!hb && selEvent && (
        <section className="card table-card" aria-label="Runs of the same promotion">
          <header className="table-head">
            <div>
              <h3 className="chart-title">
                Runs of the same promo: {PRICE_GROUPS[selEvent.pg].name} · {PROMO_LABEL[selEvent.type]}
              </h3>
              <p className="block-tags">
                <SettingTags block="runs" />
              </p>
              <p className="chart-sub">Up to six runs, side by side, from two years before the selected period. Click a run to show it in the charts. Promo Run Trend has the full history.</p>
            </div>
          </header>
          <RunsCompare runs={runs} metrics={runMetrics} selected={sel} onSelect={(e) => update((s) => ({ ...s, sel: e }))} title="Runs of the same promo" />
        </section>
      )}
    </>
  );
}

function Heading({ hb }: { hb: boolean }) {
  return <SectionHeading title={hb ? 'Hot Buy Performance' : 'Other Promo Performance'} objective={VIEW_INFO[hb ? 'hotbuy' : 'other'].objective} />;
}
