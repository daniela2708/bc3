import { ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyFigures, SectionHeading, ViewSummary, type Tile } from '../components/Blocks';
import { C, ChartCard, ChartGrid, HBars, hbarHeight, PhaseBars, SignedColumns } from '../components/Charts';
import { EventPicker } from '../components/EventPicker';
import { HierTable, type HierCol, type HierRow } from '../components/HierTable';
import { ScoreChip, ScoreInline } from '../components/Score';
import { Select } from '../components/Select';
import { SubTabPanel, SubTabs } from '../components/SubTabs';
import { Term } from '../components/Term';
import { InfoTip, Pending, Var } from '../components/ui';
import { AS_OF_DAY, formatMonth } from '../data/calendar';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { baselineText } from '../lib/baseline';
import { eventOptions } from '../lib/eventPick';
import { INTENSITY, INTENSITY_CHIP, intensityBand } from '../lib/fatigue';
import { useFilters } from '../lib/filterStore';
import { count, moneyCompact, moneyUnit, pct, pctChange, pts, signedMoney } from '../lib/format';
import { averageScore, hotBuyScores, resultsOf } from '../lib/hotBuyScore';
import { DEFAULT_BASIS, DEFAULT_CANN_LEVEL, derive, eventAgg, type EventCtx } from '../lib/metrics';
import { SCORE_MARGIN_NOTE, SCORE_WINDOW_NOTE, verdictCountText } from '../lib/scoring';
import { getScope } from '../lib/selectors';
import { deriveShopper, eventShopper, REPEAT_WINDOW_DAYS, shopperOf, type ShopperMetrics } from '../lib/shopper';
import { alsoBoughtCategories, brandShare, buyerSources, categoryIntensity, multiItemBaskets, NEW_METRIC_CHIP, NEW_METRIC_INFO, sameAdPromos } from '../lib/shopperDetail';
import { categorySummary, hotBuyMonths, nextSubTab, openInEventDetail, PROPOSAL_CHIP, PROPOSALS, type AdMonth, type Proposal } from '../lib/shopperProposals';
import { VIEW_INFO } from '../lib/viewInfo';
import { BlockSettings, EmptyState, eventDates, SettingTags, ViewControls } from './common';

const SUM_LABEL = 'Sum across events (not unique households)';
const SUM_TIP = 'Each event counts its own buyers. A household that bought in two events counts twice, so this total is not a count of unique households. Unique households across events would need the club card data itself, which the dashboard does not hold (aggregates only).';
const PREV_TIP = 'Promo Buyer Count vs. the buyers of the same items over the same number of days right before the event (the previous week for a one-week Hot Buy).';
const LY_TIP = 'Promo Buyer Count vs. the buyers of the same items over the same days 52 weeks earlier; events with last-year data only.';
const NTC_TIP = 'Share of promo buyers with no category purchase in the 52-week look-back.';
const BASKET_TIP = 'Average total transaction dollars for transactions that include the promoted item.';

function SumLabel() {
  return (
    <span className="sum-label">
      {SUM_LABEL} <InfoTip text={SUM_TIP} label="Why this is not a count of unique households" />
    </span>
  );
}

const vsUsual = (v: number | null) => (
  <span className="vs-usual">
    <Var value={v} kind="pct" /> vs. usual
  </span>
);

/** "New metric · definition pending" with the explanation in its (i). */
function NewMetricChip() {
  return (
    <span className="score-chip-wrap">
      <span className="chip status-pending new-metric-chip">{NEW_METRIC_CHIP}</span>
      <InfoTip text={NEW_METRIC_INFO} label="Where this metric comes from" below />
    </span>
  );
}

function PrivacyNotes({ ctx, full = true }: { ctx: EventCtx; full?: boolean }) {
  return (
    <>
      {full && (
        <p className="privacy-note" role="note">
          <ShieldCheck size={15} aria-hidden="true" />
          Aggregates only: every figure is a total or average per promo event or category. No customer- or card-level detail is stored or shown. Club card data refreshed weekly; “usual” = the same buyers over the {baselineText(ctx.baselineWeeks)} window.
        </p>
      )}
      <p className="privacy-note approval-note" role="note">
        Aggregates only. Individual-level detail requires approval (#16).
      </p>
    </>
  );
}

/** Every event as a table row (B's table). */
function eventRows(list: { e: number; m: ShopperMetrics }[], selected: number, onSelect: (e: number) => void): HierRow[] {
  return list.map(({ e, m }) => ({
    id: `e${e}`,
    label: PRICE_GROUPS[EVENTS[e].pg].name,
    sub: `${EVENTS[e].id} · ${PROMO_LABEL[EVENTS[e].type]}`,
    cells: { dates: eventDates(EVENTS[e]), buyers: count(m.buyers), basketLift: <Var value={m.txnsChange} kind="pct" />, basket: moneyUnit(m.basket), spend: <Var value={m.spendChange} kind="pct" />, upb: m.upb?.toFixed(1) ?? '—', ntc: pct(m.newToCat), trips: count(m.catTrips), txn: count(m.storeTxns), repeat: pct(m.repeatRate) },
    sort: { label: PRICE_GROUPS[EVENTS[e].pg].name, dates: EVENTS[e].start, buyers: m.buyers, basketLift: m.txnsChange, basket: m.basket, spend: m.spendChange, upb: m.upb, ntc: m.newToCat, trips: m.catTrips, txn: m.storeTxns, repeat: m.repeatRate },
    onSelect: () => onSelect(e),
    selected: e === selected,
  }));
}

const EVENT_COLS: HierCol[] = [
  { key: 'dates', label: 'Dates', left: true },
  { key: 'buyers', label: 'Promo Buyer Count' },
  { key: 'basketLift', label: 'Basket lift %', title: 'Baskets (transactions) that include the promoted item vs. the same buyers’ usual.' },
  { key: 'basket', label: 'Avg Basket Size $' },
  { key: 'spend', label: 'Spend Change %' },
  { key: 'upb', label: 'Units per Basket' },
  { key: 'ntc', label: 'New-to-Category %' },
  { key: 'trips', label: 'Category Trips' },
  { key: 'txn', label: 'Transaction Count' },
  { key: 'repeat', label: 'Repeat Purchase Rate %', title: `Level 2 (not MVP): bought again at regular price within ${REPEAT_WINDOW_DAYS} days.` },
];

function TableCard({ label, title, sub, tags = true, children }: { label: string; title: ReactNode; sub: ReactNode; tags?: boolean; children: ReactNode }) {
  return (
    <section className="card table-card" aria-label={label}>
      <header className="table-head">
        <div>
          <h3 className="chart-title">{title}</h3>
          {tags && (
            <p className="block-tags">
              <SettingTags block="table" />
            </p>
          )}
          <p className="chart-sub">{sub}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

const ID = 'shopper';

/**
 * Promo Shopper Impact: three layout proposals for review, as subtabs at the top of the view (URL `sp`, default A):
 * A Category summary, B Event detail, C Executive snapshot. Only the active panel renders. Club card and T-log
 * aggregates only.
 */
export default function ShopperView() {
  const { state, update } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const sp = state.sp;
  const info = PROPOSALS.find((p) => p.id === sp)!;

  return (
    <>
      <Heading />
      <div className="subtabs-head">
        <SubTabs<Proposal>
          tabs={PROPOSALS.map((p) => ({ id: p.id, label: `${p.label} · ${p.name}` }))}
          value={sp}
          onChange={(v) => update((s) => ({ ...s, sp: v }))}
          next={nextSubTab}
          label="Layout proposals"
          idPrefix={ID}
          aside={<span className="chip status-proposed proposal-chip">{PROPOSAL_CHIP}</span>}
        />
        <p className="subtab-desc">{info.description}</p>
        <p className="subtab-look">What to look at: {info.look}</p>
      </div>
      <ViewControls />
      <SubTabPanel id={sp} idPrefix={ID}>
        {scope.events.length === 0 ? (
          <>
            <EmptyState>No promotions start in {scope.range.label} for the current filters.</EmptyState>
            <PrivacyNotes ctx={scope.ctx} full={false} />
          </>
        ) : sp === 'A' ? (
          <CategoryPanel events={scope.events} ctx={scope.ctx} range={scope.range} />
        ) : sp === 'B' ? (
          <EventPanel events={scope.events} ctx={scope.ctx} selected={state.sel} onSelect={(e) => update((s) => ({ ...s, sel: e }))} />
        ) : (
          <SnapshotPanel
            events={scope.events}
            ctx={scope.ctx}
            weights={state.weights}
            rangeLabel={scope.range.label}
            onOpen={(e) => {
              update((s) => openInEventDetail(s, e));
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </SubTabPanel>
    </>
  );
}

// ---------------------------------------------------------------- A · Category summary

function CategoryPanel({ events, ctx, range }: { events: number[]; ctx: EventCtx; range: { start: number; end: number; name: string; label: string } }) {
  const all = useMemo(() => shopperOf(events, ctx), [events, ctx]);
  const cats = useMemo(() => categorySummary(events, ctx).map((c) => ({ ...c, intensity: categoryIntensity(c.cat, range.start, range.end) })), [events, ctx, range.start, range.end]);
  const byLift = [...cats].sort((a, b) => (b.m.buyersVsPrev ?? -Infinity) - (a.m.buyersVsPrev ?? -Infinity));
  const byIntensity = [...cats].sort((a, b) => (b.intensity ?? -1) - (a.intensity ?? -1));
  const bandText = (v: number | null) => {
    const b = intensityBand(v);
    return b === 'flag' ? 'Flag' : b === 'watch' ? 'Watch' : b === 'ok' ? 'OK' : '—';
  };
  const tiles: Tile[] = [
    { label: 'Promo events', info: 'Promotions that start in the period with the current filters.', value: count(events.length), sub: <>in {cats.length} categories</> },
    { label: 'Promo Buyer Count', info: 'Club card households that bought the promoted items during the promotions. Household vs. card level per metric is pending; Promo Buyer Count uses households (#16).', value: count(all.buyers), sub: events.length > 1 ? <SumLabel /> : vsUsual(all.buyersChange), pending: 16 },
    { label: 'Avg Basket Size $', info: BASKET_TIP, value: moneyUnit(all.basket), sub: vsUsual(all.basketChange), pending: 16 },
    { label: 'New-to-Category Buyers %', info: NTC_TIP, value: pct(all.newToCat), pending: 11 },
  ];
  return (
    <>
      <KeyFigures tags={<SettingTags block="tiles" />} caption={`${range.name} · ${events.length} events · club card households`} tiles={tiles} />
      <ViewSummary>
        {events.length} promotions in {cats.length} categories starting {range.label}: <b>{count(all.buyers)}</b> promo buyers{events.length > 1 ? ' (sum across events, not unique households)' : ''}, <b>{pct(all.newToCat)}</b> new to the category, buyers{' '}
        <b>
          <Var value={all.buyersVsPrev} kind="pct" />
        </b>{' '}
        vs. the week before.
      </ViewSummary>
      <PrivacyNotes ctx={ctx} />
      <ChartGrid cols={2}>
        <ChartCard
          title="Promo buyer lift by category"
          subtitle="Vs. the previous week and vs. the same week last year, highest first"
          tags={<SettingTags block="panels" />}
          legend={[
            { label: 'Vs. previous week', color: C.s1, kind: 'rect' },
            { label: 'Vs. same week last year', color: C.s2, kind: 'rect' },
          ]}
          table={{ head: ['Category', 'Events', 'Vs. previous week %', 'Vs. same week LY %'], rows: byLift.map((c) => [c.label, c.events.length, pctChange(c.m.buyersVsPrev), pctChange(c.m.buyersVsLy)]) }}
          tableNote={`${PREV_TIP} ${LY_TIP}`}
          height={hbarHeight(Math.min(byLift.length, 10), true)}
          contentHeight={hbarHeight(byLift.length, true)}
        >
          <HBars
            data={byLift.map((c) => ({ label: `${c.label} (${c.events.length})`, value: c.m.buyersVsPrev ?? 0, compare: c.m.buyersVsLy }))}
            format={(v) => pctChange(v)}
            valueLabel="Vs. previous week"
            compareLabel="Vs. same week last year"
            compareColor={C.s2}
            diverging
            labelWidth={170}
          />
        </ChartCard>
        <ChartCard
          title="Promo intensity by category"
          titleNode={
            <>
              <Term id="promoIntensity">Promo intensity</Term> by category
            </>
          }
          titleChip={<span className="chip status-proposed">{INTENSITY_CHIP}</span>}
          subtitle={`Average share of the category's items on offer per day · watch ${pct(INTENSITY.watch, 0)}, flag ${pct(INTENSITY.flag, 0)}`}
          table={{ head: ['Category', 'Promo intensity %', 'Band'], rows: byIntensity.map((c) => [c.label, pct(c.intensity), bandText(c.intensity)]) }}
          tableNote={`Item-days with any promotion (any type) in ${range.label} ÷ item-days of the period (every item of the category, whatever the product filters). Watch at ${pct(INTENSITY.watch, 0)} or more, flag at ${pct(INTENSITY.flag, 0)} or more: thresholds from the Promo Hygiene Review (calibrated).`}
          height={hbarHeight(Math.min(byIntensity.length, 10))}
          contentHeight={hbarHeight(byIntensity.length)}
        >
          <HBars
            data={byIntensity.map((c) => ({ label: c.label, value: c.intensity ?? 0, tip: [{ label: 'Promo intensity', value: `${pct(c.intensity)} · ${bandText(c.intensity)}` }] }))}
            format={(v) => pct(v)}
            valueLabel="Promo intensity"
            labelWidth={170}
            refs={[
              { x: INTENSITY.watch, label: `Watch ${pct(INTENSITY.watch, 0)}`, color: '#8a6100', anchor: 'end' },
              { x: INTENSITY.flag, label: `Flag ${pct(INTENSITY.flag, 0)}`, color: C.neg },
            ]}
          />
        </ChartCard>
      </ChartGrid>
      <TableCard
        label="Category summary"
        title={
          <>
            Category summary <Pending q={16} />
          </>
        }
        sub="One row per category: club card aggregates of its events (ratio of totals) and its promo intensity."
      >
        <HierTable
          hierarchy="Category"
          columns={[
            { key: 'events', label: 'Events' },
            { key: 'buyers', label: 'Promo Buyer Count' },
            { key: 'basket', label: 'Avg Basket Size $' },
            { key: 'ntc', label: 'New-to-Category Buyers %' },
            { key: 'prev', label: 'Buyers vs. previous week %', title: PREV_TIP },
            { key: 'ly', label: 'Buyers vs. same week LY %', title: LY_TIP },
            { key: 'intensity', label: 'Promo intensity %', title: `${INTENSITY_CHIP}: watch ${pct(INTENSITY.watch, 0)}, flag ${pct(INTENSITY.flag, 0)}.` },
            { key: 'band', label: 'Intensity band', left: true },
          ]}
          rows={cats.map((c) => ({
            id: `cat${c.cat}`,
            label: c.label,
            cells: { events: count(c.events.length), buyers: count(c.m.buyers), basket: moneyUnit(c.m.basket), ntc: pct(c.m.newToCat), prev: <Var value={c.m.buyersVsPrev} kind="pct" />, ly: <Var value={c.m.buyersVsLy} kind="pct" />, intensity: pct(c.intensity), band: bandText(c.intensity) },
            sort: { label: c.label, events: c.events.length, buyers: c.m.buyers, basket: c.m.basket, ntc: c.m.newToCat, prev: c.m.buyersVsPrev, ly: c.m.buyersVsLy, intensity: c.intensity, band: c.intensity },
          }))}
          defaultSort={{ key: 'buyers', dir: 'desc' }}
          exportTitle="Promo Shopper Impact - Category summary"
          maxHeight={480}
        />
      </TableCard>
    </>
  );
}

// ---------------------------------------------------------------- B · Event detail

function EventPanel({ events, ctx, selected, onSelect }: { events: number[]; ctx: EventCtx; selected: number; onSelect: (e: number) => void }) {
  const per = useMemo(() => events.map((e) => ({ e, m: deriveShopper(eventShopper(EVENTS[e], ctx)) })), [events, ctx]);
  const latestFirst = useMemo(() => [...per].sort((a, b) => EVENTS[b.e].start - EVENTS[a.e].start), [per]);
  // The event selected here, in C or in another view; else the latest whose 4 weeks after have passed.
  const latestComplete = latestFirst.find((x) => x.m.afterBuyers !== null) ?? latestFirst[0];
  const e = events.includes(selected) ? selected : latestComplete.e;
  const ev = EVENTS[e];
  const agg = useMemo(() => eventShopper(ev, ctx), [ev, ctx]);
  const m = deriveShopper(agg);
  const share = useMemo(() => brandShare(ev, ctx), [ev, ctx]);
  const sources = buyerSources(agg);
  const multi = multiItemBaskets(agg);
  const cats = alsoBoughtCategories(ev);
  const promos = sameAdPromos(ev);
  const name = PRICE_GROUPS[ev.pg].name;
  const after = agg.afterN > 0;
  const phases = [
    { x: 'Before (usual)', phase: 'baseline' as const, buyers: agg.usualBuyers, baskets: agg.usualTxns },
    { x: 'During', phase: 'promo' as const, buyers: agg.buyers, baskets: agg.txns },
    { x: 'After (4 wk)', phase: 'after' as const, buyers: after ? agg.afterBuyers : null, baskets: after ? agg.afterTxns : null },
  ];
  const tiles: Tile[] = [
    { label: 'Promo Buyer Count', info: 'Club card households that bought the promoted item during the promotion (#16).', value: count(m.buyers), sub: vsUsual(m.buyersChange), pending: 16 },
    { label: 'Basket lift %', info: 'Baskets (transactions) that include the promoted item during the event vs. the same buyers’ usual. Also the Basket Lift of the Hot Buy Score.', value: <Var value={m.txnsChange} kind="pct" />, pending: 16 },
    { label: 'Avg Basket Size $', info: BASKET_TIP, value: moneyUnit(m.basket), sub: vsUsual(m.basketChange), pending: 16 },
    { label: 'New-to-Category Buyers %', info: NTC_TIP, value: pct(m.newToCat), pending: 11 },
    {
      label: 'Brand share gain',
      labelNode: (
        <>
          <Term id="brandShare">Brand share</Term> gain
        </>
      ),
      info: `${NEW_METRIC_INFO} The promoted brand's share of category sales (Net Customer Sales) during the event minus its share before (the baseline window), in share points.`,
      chip: <NewMetricChip />,
      value: pts(share.gain === null ? null : share.gain * 100),
      sub: (
        <>
          {pct(share.before)} → {pct(share.during)} of category sales
        </>
      ),
    },
  ];
  return (
    <>
      <div className="panel-controls">
        <EventPicker inline value={String(e)} options={eventOptions(events, false)} onChange={(v) => onSelect(Number(v))} />
      </div>
      <KeyFigures tags={<SettingTags block="tiles" />} caption={`${name} · ${ev.id} · ${PROMO_LABEL[ev.type]} · ${eventDates(ev)}`} tiles={tiles} />
      <PrivacyNotes ctx={ctx} />
      <ChartGrid cols={2}>
        <ChartCard
          title="Buyers and baskets before, during and after"
          subtitle={`${name}, ${ev.id}`}
          tags={<SettingTags block="panels" />}
          legend={[
            { label: 'Promo buyers', color: C.s1, kind: 'rect' },
            { label: 'Baskets with the item', color: C.s3, kind: 'rect' },
          ]}
          table={{ head: ['Window', 'Promo buyers', 'Baskets with the item'], rows: phases.map((p) => [p.x, p.buyers === null ? '—' : Math.round(p.buyers), p.baskets === null ? '—' : Math.round(p.baskets)]) }}
          tableNote="Before = the same buyers' usual over the baseline window, scaled to the promo days; after = the 4 weeks after the promo, scaled to the promo days (— until they have passed). Shading: baseline, promo and after windows."
          height={240}
        >
          <PhaseBars
            data={phases}
            series={[
              { key: 'buyers', label: 'Promo buyers', color: C.s1 },
              { key: 'baskets', label: 'Baskets with the item', color: C.s3 },
            ]}
            format={count}
          />
        </ChartCard>
        <ChartCard
          title="Where buyers came from"
          titleChip={<NewMetricChip />}
          subtitle="Share of promo buyers; the three add up to 100 %"
          tags={<SettingTags block="panels" />}
          table={{ head: ['Source', 'Share of promo buyers'], rows: sources ? [['New to the category', pct(sources.newToCategory)], ['Already bought the item', pct(sources.existing)], ['Switched from another brand', pct(sources.switched)]] : [] }}
          tableNote="New to the category: no category purchase in the 52-week look-back. Already bought the item: the same buyers' usual count over the baseline window. Switched brand: the rest, buyers of the category who bought another brand before."
          height={hbarHeight(3)}
        >
          <HBars
            data={
              sources
                ? [
                    { label: 'New to the category', value: sources.newToCategory },
                    { label: 'Already bought the item', value: sources.existing },
                    { label: 'Switched from another brand', value: sources.switched },
                  ]
                : []
            }
            format={(v) => pct(v)}
            valueLabel="Share of promo buyers"
            labelWidth={190}
          />
        </ChartCard>
        <ChartCard
          title="Multi-item baskets"
          titleChip={<NewMetricChip />}
          subtitle="Baskets with 2 or more units of the promoted items, before vs. during"
          tags={<SettingTags block="panels" />}
          table={{ head: ['Window', 'Baskets with 2+ units %'], rows: [['Before (usual)', pct(multi.before)], ['During', pct(multi.during)]] }}
          tableNote="From the average units of the promoted items per basket u (club card aggregates): the extra units of a basket are taken as Poisson(u − 1), so the share with 2 or more is 1 − e^−(u − 1)."
          height={220}
        >
          <SignedColumns
            data={[
              { x: 'Before (usual)', value: multi.before },
              { x: 'During', value: multi.during },
            ]}
            format={(v) => pct(v, 0)}
            valueLabel="Baskets with 2+ units"
            neutral
          />
        </ChartCard>
        <ChartCard
          title="Also bought: categories"
          titleChip={<NewMetricChip />}
          titleNode={
            <>
              Also bought: categories that <Term id="overIndex">over-index</Term>
            </>
          }
          subtitle="Top 5 categories in the event's baskets vs. all baskets (100 = as usual)"
          table={{ head: ['Category', 'Index'], rows: cats.map((c) => [c.label, c.index]) }}
          tableNote="Index = share of the event's baskets that include the category ÷ its share of all baskets × 100. Basket affinity is simulated in the prototype; production reads it from the Weis T-log baskets."
          height={hbarHeight(cats.length)}
        >
          <HBars data={cats.map((c) => ({ label: c.label, value: c.index }))} format={(v) => String(Math.round(v))} valueLabel="Index" labelWidth={170} refs={[{ x: 100, label: 'Average 100' }]} />
        </ChartCard>
        <ChartCard
          title="Also bought: promotions in the same ad"
          titleChip={<NewMetricChip />}
          subtitle="Other promotions of the same ad week most often in the event's baskets"
          table={{ head: ['Promotion', 'Event', 'Share of the event baskets'], rows: promos.map((p) => [p.label, EVENTS[p.event].id, pct(p.share)]) }}
          tableNote="Share of the event's baskets that also include the other promotion. Basket affinity is simulated in the prototype; production reads it from the Weis T-log baskets."
          height={hbarHeight(Math.max(1, promos.length))}
        >
          <HBars data={promos.map((p) => ({ label: p.label, value: p.share, id: p.event }))} format={(v) => pct(v)} valueLabel="Share of the event baskets" labelWidth={190} />
        </ChartCard>
      </ChartGrid>
      <TableCard
        label="All events"
        title={
          <>
            All events <Pending q={16} />
          </>
        }
        sub="The same aggregates for every event. Click a row to show it above."
      >
        <HierTable hierarchy="Price group · event" columns={EVENT_COLS} rows={eventRows(latestFirst, e, onSelect)} defaultSort={{ key: 'dates', dir: 'desc' }} exportTitle="Promo Shopper Impact" maxHeight={480} />
      </TableCard>
    </>
  );
}

// ---------------------------------------------------------------- C · Executive snapshot

const promoPrice = (e: number, ctx: EventCtx) => {
  const r = derive(eventAgg(EVENTS[e], ctx), DEFAULT_BASIS).avgRetail;
  if (r.ea !== null) return `$${r.ea.toFixed(2)}`;
  return r.lb !== null ? `$${r.lb.toFixed(2)} / lb` : '—';
};

function SnapshotPanel({ events, ctx, weights, rangeLabel, onOpen }: { events: number[]; ctx: EventCtx; weights: 'current' | 'proposed'; rangeLabel: string; onOpen: (e: number) => void }) {
  const months = useMemo(() => hotBuyMonths(events), [events]);
  const [picked, setPicked] = useState('');
  // The Hot Buy Score (fixed 4-week pre-period, Net Customer Sales); only the weight set changes it.
  const scores = useMemo(() => hotBuyScores(events, { ...ctx, level: DEFAULT_CANN_LEVEL }, weights, DEFAULT_BASIS), [events, ctx, weights]);
  // The month picked here, else the latest month that has ended (the current one is still partial).
  const month: AdMonth | undefined = months.find((m) => m.key === picked) ?? months.find((m) => m.key !== formatMonth(AS_OF_DAY)) ?? months[0];
  if (!month)
    return (
      <>
        <EmptyState>No Hot Buys start in {rangeLabel} for the current filters, so there is no executive snapshot. Try a longer period or clear a filter.</EmptyState>
        <PrivacyNotes ctx={ctx} full={false} />
      </>
    );
  const list = [...month.events].sort((a, b) => (scores.get(b)?.score ?? -1) - (scores.get(a)?.score ?? -1) || EVENTS[a].start - EVENTS[b].start);
  const results = resultsOf(scores, month.events);
  const avg = averageScore(scores, month.events);
  const tiles: Tile[] = [
    { label: 'Hot Buys', info: 'Hot Buys whose ad week starts in the month.', value: count(month.events.length) },
    {
      label: 'Verdicts',
      info: `How many Hot Buys of the month got each verdict: RE-EXECUTE 85 or more, REFINE TACTIC 70 to 84, RECONSIDER SLOT below 70 (Weis Hot Buy Scoring Framework). ${SCORE_WINDOW_NOTE}`,
      value: <span className="verdict-counts">{verdictCountText(results)}</span>,
    },
    {
      label: 'Hot Buy Score',
      info: `Average of the month’s Hot Buys, 0–100. ${SCORE_WINDOW_NOTE} ${SCORE_MARGIN_NOTE}`,
      chip: <ScoreChip info={false} />,
      value: avg === null ? '—' : String(Math.round(avg)),
      sub: 'average',
    },
  ];
  return (
    <>
      <div className="panel-controls">
        <Select className="month-picker" label="Ad month" value={month.key} options={months.map((m) => ({ value: m.key, label: `${m.label} (${m.events.length} Hot Buy${m.events.length === 1 ? '' : 's'})` }))} onChange={setPicked} />
      </div>
      <KeyFigures tags={<SettingTags block="snapshot" />} caption={`${month.label} · ${month.events.length} Hot Buy${month.events.length === 1 ? '' : 's'}`} tiles={tiles} />
      <PrivacyNotes ctx={ctx} full={false} />
      <section aria-label="Executive snapshot">
        <div className="snapshot-head">
          <h3 className="secondary-title">
            Every Hot Buy of {month.label}, by Hot Buy Score <SettingTags block="snapshot" />
          </h3>
          <BlockSettings block="snapshot" />
        </div>
        <div className="shopper-grid snapshot-grid">
          {list.map((e) => {
            const s = scores.get(e);
            const part = (id: string) => s?.parts.find((p) => p.id === id)?.value ?? null;
            const name = PRICE_GROUPS[EVENTS[e].pg].name;
            return (
              <button key={e} type="button" className="card snapshot-card" data-event={e} onClick={() => onOpen(e)} aria-label={`${name}, ${EVENTS[e].id}: Hot Buy Score ${s?.score ?? 'none'}${s ? `, ${s.verdict.label}` : ''}. Open in Event detail.`}>
                <header>
                  <h4 title={name}>{name}</h4>
                  <p>
                    <span className="card-price">{promoPrice(e, ctx)}</span> · {EVENTS[e].id} · {eventDates(EVENTS[e])}
                  </p>
                </header>
                <ScoreInline s={s} />
                <dl>
                  <div>
                    <dt>Sales Lift</dt>
                    <dd>{pctChange(part('salesLift'))}</dd>
                  </div>
                  <div>
                    <dt>Unit Lift</dt>
                    <dd>{pctChange(part('unitLift'))}</dd>
                  </div>
                  <div>
                    <dt>Net Incremental GM $</dt>
                    <dd title={s?.netIncGm === undefined ? undefined : signedMoney(s.netIncGm ?? null)}>{moneyCompact(s?.netIncGm ?? null)}</dd>
                  </div>
                  <div>
                    <dt>New-to-Category</dt>
                    <dd>{pct(part('newToCat'))}</dd>
                  </div>
                </dl>
                <span className="card-open">Open in B · Event detail →</span>
              </button>
            );
          })}
        </div>
        <p className="table-note">Sales Lift, Unit Lift and New-to-Category are the score inputs (vs. the 4 weeks before, the method's fixed pre-period). Net Incremental GM $ is not part of the score (#19).</p>
      </section>
    </>
  );
}

function Heading() {
  return <SectionHeading title="Promo Shopper Impact" badge={<Pending q={16} />} objective={VIEW_INFO.shopper.objective} />;
}
