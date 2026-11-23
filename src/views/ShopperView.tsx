import { ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyFigures, SectionHeading, ViewSummary, type Tile } from '../components/Blocks';
import { C, ChartCard, ChartGrid, HBars, hbarHeight, PhaseBars } from '../components/Charts';
import { EventPicker } from '../components/EventPicker';
import { HierTable, type HierCol, type HierRow } from '../components/HierTable';
import { SubTabPanel, SubTabs } from '../components/SubTabs';
import { Term } from '../components/Term';
import { InfoTip, Pending, Var } from '../components/ui';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { baselineText } from '../lib/baseline';
import { eventOptions } from '../lib/eventPick';
import { INTENSITY, INTENSITY_CHIP, intensityBand } from '../lib/fatigue';
import { effectiveTime } from '../lib/filters';
import { useFilters } from '../lib/filterStore';
import { count, moneyUnit, pct, pctChange } from '../lib/format';
import type { EventCtx } from '../lib/metrics';
import { getScope } from '../lib/selectors';
import { deriveShopper, eventShopper, REPEAT_WINDOW_DAYS, shopperOf, type ShopperMetrics } from '../lib/shopper';
import { categoryIntensity } from '../lib/shopperDetail';
import { categorySummary, nextSubTab, PROPOSAL_CHIP, PROPOSALS, subTabLabel, type Proposal } from '../lib/shopperProposals';
import { VIEW_INFO } from '../lib/viewInfo';
import { EmptyState, eventDates, SettingTags, ViewControls } from './common';

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
function eventRows(list: { e: number; m: ShopperMetrics }[], selected = -1, onSelect?: (e: number) => void): HierRow[] {
  return list.map(({ e, m }) => ({
    id: `e${e}`,
    label: PRICE_GROUPS[EVENTS[e].pg].name,
    sub: `${EVENTS[e].id} · ${PROMO_LABEL[EVENTS[e].type]}`,
    cells: { dates: eventDates(EVENTS[e]), buyers: count(m.buyers), basketLift: <Var value={m.txnsChange} kind="pct" />, basket: moneyUnit(m.basket), spend: <Var value={m.spendChange} kind="pct" />, upb: m.upb?.toFixed(1) ?? '—', ntc: pct(m.newToCat), trips: count(m.catTrips), txn: count(m.storeTxns), repeat: pct(m.repeatRate) },
    sort: { label: PRICE_GROUPS[EVENTS[e].pg].name, dates: EVENTS[e].start, buyers: m.buyers, basketLift: m.txnsChange, basket: m.basket, spend: m.spendChange, upb: m.upb, ntc: m.newToCat, trips: m.catTrips, txn: m.storeTxns, repeat: m.repeatRate },
    onSelect: onSelect ? () => onSelect(e) : undefined,
    selected: onSelect ? e === selected : undefined,
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
 * Promo Shopper Impact: subtabs at the top of the view (URL `sp`): the current view (default) and two layout proposals
 * for review, A Category summary and B Event detail. Only the active panel renders. Club card aggregates only.
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
          tabs={PROPOSALS.map((p, i) => ({ id: p.id, label: subTabLabel(p), divider: p.proposal && !PROPOSALS[i - 1]?.proposal }))}
          value={sp}
          onChange={(v) => update((s) => ({ ...s, sp: v }))}
          next={nextSubTab}
          label="Promo Shopper Impact layouts"
          idPrefix={ID}
          aside={<span className="chip status-proposed proposal-chip">A–B · {PROPOSAL_CHIP}</span>}
        />
        <p className="subtab-desc">
          {info.proposal && <span className="subtab-kind">Proposal for review · </span>}
          {info.description}
        </p>
        <p className="subtab-look">What to look at: {info.look}</p>
      </div>
      <ViewControls />
      <SubTabPanel id={sp} idPrefix={ID}>
        {scope.events.length === 0 ? (
          <>
            <EmptyState>No promotions start in {scope.range.label} for the current filters.</EmptyState>
            <PrivacyNotes ctx={scope.ctx} full={false} />
          </>
        ) : sp === 'current' ? (
          <CurrentPanel events={scope.events} ctx={scope.ctx} range={scope.range} />
        ) : sp === 'A' ? (
          <CategoryPanel events={scope.events} ctx={scope.ctx} range={scope.range} />
        ) : (
          <EventPanel events={scope.events} ctx={scope.ctx} selected={state.sel} onSelect={(e) => update((s) => ({ ...s, sel: e }))} />
        )}
      </SubTabPanel>
    </>
  );
}

// ---------------------------------------------------------------- Current · Event panels (the view as it is today)

const PANEL_LIMIT = 12;

/** Key figures of the period (the current view): the eight workbook KPIs of the view. */
function periodTiles(m: ShopperMetrics): Tile[] {
  return [
    {
      label: 'Promo Buyer Count',
      info: 'Club card households that bought the promoted item during the promotion. Household vs. card level per metric is pending; Promo Buyer Count uses households (#16).',
      value: count(m.buyers),
      sub: (
        <>
          {m.events > 1 && <SumLabel />}
          {vsUsual(m.buyersChange)}
        </>
      ),
      pending: 16,
    },
    { label: 'Avg Basket Size $', info: BASKET_TIP, value: moneyUnit(m.basket), sub: vsUsual(m.basketChange), pending: 16 },
    { label: 'Promo Buyer Spend Change %', info: "Promo buyers' spend during the event vs. their usual spend.", value: <Var value={m.spendChange} kind="pct" />, pending: 16 },
    { label: 'Units per Basket', info: 'Average units in transactions that include the promoted item.', value: m.upb === null ? '—' : m.upb.toFixed(1), sub: vsUsual(m.upbChange), pending: 16 },
    { label: 'New-to-Category Buyers %', info: NTC_TIP, value: pct(m.newToCat), pending: 11 },
    { label: 'Category Trips', info: 'Trips by promo buyers that included any item in the category, vs. their usual.', value: count(m.catTrips), sub: vsUsual(m.catTripsChange), pending: 16 },
    { label: 'Transaction Count', info: 'Total store transactions on promo days (store traffic indicator). Days shared by several events count once.', value: count(m.storeTxns), pending: 16 },
    { label: 'Repeat Purchase Rate %', info: `Level 2 (not MVP). Promo buyers who bought the item again at regular price within ${REPEAT_WINDOW_DAYS} days after the promotion. — until enough days have passed.`, value: pct(m.repeatRate), pending: 16 },
  ];
}

function EventCard({ e, m, onOpen }: { e: number; m: ShopperMetrics; onOpen: () => void }) {
  const ev = EVENTS[e];
  return (
    <article className="card snapshot-card shopper-panel">
      <header>
        <h4 title={PRICE_GROUPS[ev.pg].name}>{PRICE_GROUPS[ev.pg].name}</h4>
        <p>
          {ev.id} · {PROMO_LABEL[ev.type]} · {eventDates(ev)}
        </p>
      </header>
      <dl>
        <div>
          <dt>Promo Buyer Count</dt>
          <dd>{count(m.buyers)}</dd>
          {vsUsual(m.buyersChange)}
        </div>
        <div>
          <dt>Avg Basket Size $</dt>
          <dd>{moneyUnit(m.basket)}</dd>
          {vsUsual(m.basketChange)}
        </div>
        <div>
          <dt>Spend Change %</dt>
          <dd>
            <Var value={m.spendChange} kind="pct" />
          </dd>
          <span className="vs-usual">vs. their usual</span>
        </div>
        <div>
          <dt>Units per Basket</dt>
          <dd>{m.upb === null ? '—' : m.upb.toFixed(1)}</dd>
          {vsUsual(m.upbChange)}
        </div>
        <div>
          <dt>New-to-Category %</dt>
          <dd>{pct(m.newToCat)}</dd>
          <span className="vs-usual">no category purchase in 52 wk</span>
        </div>
        <div>
          <dt>Category Trips</dt>
          <dd>{count(m.catTrips)}</dd>
          {vsUsual(m.catTripsChange)}
        </div>
      </dl>
      <button type="button" className="btn-link" onClick={onOpen}>
        Show in {ev.type === 'HB' ? 'Hot Buy' : 'Other Promo'} Performance
      </button>
    </article>
  );
}

function CurrentPanel({ events, ctx, range }: { events: number[]; ctx: EventCtx; range: { name: string; label: string } }) {
  const { update } = useFilters();
  const [showAll, setShowAll] = useState(false);
  const all = useMemo(() => shopperOf(events, ctx), [events, ctx]);
  const sorted = useMemo(() => events.map((e) => ({ e, m: deriveShopper(eventShopper(EVENTS[e], ctx)) })).sort((a, b) => EVENTS[b.e].start - EVENTS[a.e].start), [events, ctx]);
  const open = (e: number) => update((s) => ({ ...s, tab: EVENTS[e].type === 'HB' ? 'hotbuy' : 'other', sel: e, event: -1, time: { ...effectiveTime(s), mode: 'all' } }));
  const panels = showAll ? sorted : sorted.slice(0, PANEL_LIMIT);
  return (
    <>
      <KeyFigures tags={<SettingTags block="tiles" />} caption={`${range.name} · ${events.length} events · club card households`} tiles={periodTiles(all)} />
      <ViewSummary>
        {events.length} promotions starting {range.label}: <b>{count(all.buyers)}</b> promo buyers{events.length > 1 ? ' (sum across events, not unique households)' : ''} spent{' '}
        <b>
          <Var value={all.spendChange} kind="pct" />
        </b>{' '}
        vs. their usual, with <b>{pct(all.newToCat)}</b> new to the category.
      </ViewSummary>
      <PrivacyNotes ctx={ctx} />
      <section aria-label="Panel per event">
        <h3 className="secondary-title">
          One panel per <Term id="event">event</Term>, latest first <SettingTags block="panels" />
        </h3>
        <div className="shopper-grid snapshot-grid">
          {panels.map(({ e, m }) => (
            <EventCard key={e} e={e} m={m} onOpen={() => open(e)} />
          ))}
        </div>
        {sorted.length > PANEL_LIMIT && (
          <button type="button" className="btn-outline more-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show the latest ${PANEL_LIMIT}` : `Show all ${sorted.length} events`}
          </button>
        )}
      </section>
      <TableCard
        label="All events"
        title={
          <>
            All events <Pending q={16} />
          </>
        }
        sub="The same aggregates for every event, plus Transaction Count and Repeat Purchase Rate %."
      >
        <HierTable hierarchy="Price group · event" columns={EVENT_COLS.filter((c) => c.key !== 'basketLift')} rows={eventRows(sorted)} defaultSort={{ key: 'dates', dir: 'desc' }} exportTitle="Promo Shopper Impact" maxHeight={480} />
      </TableCard>
    </>
  );
}

// ---------------------------------------------------------------- A · Category summary

function CategoryPanel({ events, ctx, range }: { events: number[]; ctx: EventCtx; range: { start: number; end: number; name: string; label: string } }) {
  const all = useMemo(() => shopperOf(events, ctx), [events, ctx]);
  const cats = useMemo(() => categorySummary(events, ctx).map((c) => ({ ...c, intensity: categoryIntensity(c.cat, range.start, range.end) })), [events, ctx, range.start, range.end]);
  const byLift = [...cats].sort((a, b) => (b.m.buyersVsPrev ?? -Infinity) - (a.m.buyersVsPrev ?? -Infinity));
  const byIntensity = [...cats].sort((a, b) => (b.intensity ?? -1) - (a.intensity ?? -1));
  // Both charts of the row share one plot height (layout rule 8); longer lists scroll inside the card.
  const rowHeight = hbarHeight(Math.min(cats.length, 7), true);
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
          height={rowHeight}
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
          height={rowHeight}
          contentHeight={Math.max(rowHeight, hbarHeight(byIntensity.length) + 20)}
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

const B_CHART_HEIGHT = 260;

function EventPanel({ events, ctx, selected, onSelect }: { events: number[]; ctx: EventCtx; selected: number; onSelect: (e: number) => void }) {
  const per = useMemo(() => events.map((e) => ({ e, m: deriveShopper(eventShopper(EVENTS[e], ctx)) })), [events, ctx]);
  const latestFirst = useMemo(() => [...per].sort((a, b) => EVENTS[b.e].start - EVENTS[a.e].start), [per]);
  // The event selected here, in C or in another view; else the latest whose 4 weeks after have passed.
  const latestComplete = latestFirst.find((x) => x.m.afterBuyers !== null) ?? latestFirst[0];
  const e = events.includes(selected) ? selected : latestComplete.e;
  const ev = EVENTS[e];
  const agg = useMemo(() => eventShopper(ev, ctx), [ev, ctx]);
  const m = deriveShopper(agg);
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
  ];
  return (
    <>
      <div className="panel-controls">
        <EventPicker inline value={String(e)} options={eventOptions(events, false)} onChange={(v) => onSelect(Number(v))} />
      </div>
      <KeyFigures tags={<SettingTags block="tiles" />} caption={`${name} · ${ev.id} · ${PROMO_LABEL[ev.type]} · ${eventDates(ev)}`} tiles={tiles} />
      <PrivacyNotes ctx={ctx} />
      <ChartGrid cols={1}>
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
          height={B_CHART_HEIGHT}
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

function Heading() {
  return <SectionHeading title="Promo Shopper Impact" badge={<Pending q={16} />} objective={VIEW_INFO.shopper.objective} />;
}
