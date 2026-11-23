import { useMemo, useState } from 'react';
import { KeyFigures, SectionHeading, ViewSummary, type Tile } from '../components/Blocks';
import { ChartGrid } from '../components/Charts';
import { HierTable, type HierCol, type HierRow } from '../components/HierTable';
import { Term } from '../components/Term';
import { Level2 } from '../components/ui';
import { CATS, PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { useFilters } from '../lib/filterStore';
import { count, moneyAxis, moneyCompact, moneyUnit, pct, pctChange, volume, volumeAxis } from '../lib/format';
import { derive, eventAgg, POST_PROMO_WINDOW_DAYS, sumAggs, type Agg } from '../lib/metrics';
import { SALES_COLUMNS, UNITS_COLUMNS } from '../lib/series';
import { getScope } from '../lib/selectors';
import { deriveShopper, eventShopper, REPEAT_WINDOW_DAYS, shopperOf } from '../lib/shopper';
import { VIEW_INFO } from '../lib/viewInfo';
import { basisWord, EmptyState, eventDates, SettingTags, uomFirst, uomPct, uomTile, ViewControls } from './common';
import { PromoWindowCard } from './PromoWindowCard';

/** Post-Promo Trend (workbook view, Nice to have, level 2): what happens to the item after each promo ends. */
export default function PostPromoView() {
  const { state } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const basis = state.basis;

  const aggs = useMemo(() => new Map<number, Agg>(scope.events.map((e) => [e, eventAgg(EVENTS[e], scope.ctx)])), [scope]);
  const all = useMemo(() => derive(sumAggs([...aggs.values()]), basis), [aggs, basis]);
  const shopperAll = useMemo(() => shopperOf(scope.events, scope.ctx), [scope]);
  const measured = useMemo(() => scope.events.filter((e) => aggs.get(e)!.postN > 0), [scope.events, aggs]);

  const [selPicked, setSelPicked] = useState(-1);
  const sel = scope.events.includes(selPicked) ? selPicked : ([...measured].sort((a, b) => aggs.get(b)!.net - aggs.get(a)!.net)[0] ?? scope.events[0] ?? -1);
  const selEvent = sel >= 0 ? EVENTS[sel] : null;
  const uom = selEvent ? PRICE_GROUPS[selEvent.pg].uom : 'ea';


  // Category-level post-promo summary, with each event underneath (click an event to show it in the charts above).
  const table = useMemo(() => {
    const byCat = new Map<number, number[]>();
    for (const e of scope.events) {
      const c = PRICE_GROUPS[EVENTS[e].pg].cat;
      byCat.set(c, [...(byCat.get(c) ?? []), e]);
    }
    const cells = (list: number[], repeat: number | null) => {
      const m = derive(sumAggs(list.map((e) => aggs.get(e)!)), basis);
      const measuredHere = list.filter((e) => aggs.get(e)!.postN > 0).length;
      return {
        cells: { events: count(list.length), measured: count(measuredHere), dip: uomPct(m.dip, true), repeat: pct(repeat) },
        sort: { events: list.length, measured: measuredHere, dip: uomFirst(m.dip), repeat },
      };
    };
    const rows: HierRow[] = [...byCat.entries()].map(([c, list]) => {
      const { cells: cc, sort } = cells(list, shopperOf(list, scope.ctx).repeatRate);
      return {
        id: `c${c}`,
        label: CATS[c].name,
        sub: `${list.length} event${list.length > 1 ? 's' : ''}`,
        cells: cc,
        sort: { ...sort, label: CATS[c].name },
        children: list.map((e) => {
          const ev = EVENTS[e];
          const x = cells([e], deriveShopper(eventShopper(ev, scope.ctx)).repeatRate);
          return {
            id: `e${e}`,
            label: PRICE_GROUPS[ev.pg].name,
            sub: `${ev.id} · ${eventDates(ev)} · ${PROMO_LABEL[ev.type]}`,
            cells: x.cells,
            sort: { ...x.sort, label: PRICE_GROUPS[ev.pg].name },
            onSelect: () => setSelPicked(e),
            selected: e === sel,
          };
        }),
      };
    });
    const t = cells(scope.events, shopperAll.repeatRate);
    return { rows, total: { id: 'total', label: 'Total', sub: `${scope.events.length} events`, cells: t.cells, sort: t.sort } };
  }, [scope, aggs, basis, sel, shopperAll.repeatRate]);

  const cols: HierCol[] = [
    { key: 'events', label: 'Events' },
    { key: 'measured', label: 'Events with 4 weeks after' },
    { key: 'dip', label: 'Post-Promo Dip %' },
    { key: 'repeat', label: 'Repeat Purchase Rate %' },
  ];

  if (scope.events.length === 0)
    return (
      <>
        <Heading />
        <ViewControls />
        <EmptyState>No promotions start in {scope.range.label} for the current filters. Try a longer period or clear a filter.</EmptyState>
      </>
    );

  const tiles: Tile[] = [
    {
      label: 'Post-Promo Dip %',
      labelNode: (
        <>
          <Term id="postPromoDip">Post-Promo Dip</Term> %
        </>
      ),
      info: `Units in the ${POST_PROMO_WINDOW_DAYS / 7} weeks after each promo vs. baseline units for the same days (pantry loading), ratio of totals over the events whose 4 weeks have passed.`,
      ...uomTile(all.dip, true),
      sub: `${measured.length} of ${scope.events.length} events measurable`,
    },
    {
      label: 'Repeat Purchase Rate %',
      info: `Promo buyers who bought the item again at regular price within ${REPEAT_WINDOW_DAYS} days after the promotion ÷ Promo Buyer Count. — until enough days have passed.`,
      value: pct(shopperAll.repeatRate),
      pending: 16,
    },
  ];

  return (
    <>
      <Heading />
      <ViewControls />
      <KeyFigures tags={<SettingTags block="tiles" />} caption={`${scope.range.name} · ${scope.events.length} events · ${POST_PROMO_WINDOW_DAYS / 7}-week post-promo window`} tiles={tiles} />
      <ViewSummary>
        {scope.events.length} promotions starting {scope.range.label}: units in the 4 weeks after the promo were <b>{pctChange(uomFirst(all.dip))}</b> vs. baseline, and <b>{pct(shopperAll.repeatRate)}</b> of promo buyers bought again at regular price.
      </ViewSummary>

      {selEvent && (
        <ChartGrid cols={2}>
          <PromoWindowCard
            key={`u${selEvent.idx}`}
            event={selEvent}
            ctx={scope.ctx}
            seriesKey="units"
            measure={uom === 'lb' ? 'Pounds' : 'Units'}
            columns={uom === 'lb' ? { value: 'Pounds', baseline: 'Baseline pounds', diff: 'Difference' } : UNITS_COLUMNS}
            format={(v) => volume(v, uom)}
            tickFormat={(v) => volumeAxis(v, uom)}
            baselineFormat={(v) => volume(v, uom)}
            height={240}
            block="unitsChart"
          />
          <PromoWindowCard
            key={`s${selEvent.idx}`}
            event={selEvent}
            ctx={scope.ctx}
            seriesKey={basis === 'net' ? 'net' : 'gross'}
            measure={basisWord(basis)}
            columns={SALES_COLUMNS}
            format={moneyUnit}
            tickFormat={moneyAxis}
            baselineFormat={moneyCompact}
            height={240}
            block="salesChart"
          />
        </ChartGrid>
      )}

      <section className="card table-card" aria-label="Post-promo summary by category">
        <header className="table-head">
          <div>
            <h3 className="chart-title">Post-promo summary by category</h3>
            <p className="block-tags">
              <SettingTags block="table" />
            </p>
            <p className="chart-sub">One row per category; expand it for its events and click an event to show it in the charts above. Post-Promo Dip % shows — until the 4 weeks after the promo have passed.</p>
          </div>
        </header>
        <HierTable hierarchy="Category · event" columns={cols} rows={table.rows} total={table.total} defaultSort={{ key: 'events', dir: 'desc' }} tableId="post" exportTitle="Post-Promo Trend" maxHeight={480} />
      </section>
    </>
  );
}

function Heading() {
  return <SectionHeading title="Post-Promo Trend" badge={<Level2 term />} objective={VIEW_INFO.post.objective} />;
}
