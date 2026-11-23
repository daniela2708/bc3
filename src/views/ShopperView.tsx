import { ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyFigures, SectionHeading, ViewSummary, type Tile } from '../components/Blocks';
import { C, ChartCard, ChartGrid, HBars, hbarHeight, SignedColumns } from '../components/Charts';
import { EventPicker } from '../components/EventPicker';
import { HierTable, type HierCol, type HierRow } from '../components/HierTable';
import { ScoreBadge, ScoreChip } from '../components/Score';
import { Select } from '../components/Select';
import { InfoTip, Pending, Segmented, Var } from '../components/ui';
import { AS_OF_DAY, formatMonth } from '../data/calendar';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { baselineText } from '../lib/baseline';
import { eventOptions } from '../lib/eventPick';
import { effectiveTime } from '../lib/filters';
import { useFilters } from '../lib/filterStore';
import { count, moneyUnit, pct, pctChange } from '../lib/format';
import { DEFAULT_BASIS, DEFAULT_CANN_LEVEL, type EventCtx } from '../lib/metrics';
import { averageScore, hotBuyScores, resultsOf } from '../lib/hotBuyScore';
import { SCORE_MARGIN_NOTE, SCORE_WINDOW_NOTE, verdictCountText, type ScoreResult } from '../lib/scoring';
import { getScope } from '../lib/selectors';
import { deriveShopper, eventShopper, REPEAT_WINDOW_DAYS, shopperOf, type ShopperMetrics } from '../lib/shopper';
import { categorySummary, DEFAULT_PROPOSAL, hotBuyMonths, PROPOSAL_CHIP, PROPOSALS, type AdMonth, type Proposal } from '../lib/shopperProposals';
import { VIEW_INFO } from '../lib/viewInfo';
import { BlockSettings, EmptyState, eventDates, SettingTags, ViewControls } from './common';

const SUM_LABEL = 'Sum across events (not unique households)';
const SUM_TIP = 'Each event counts its own buyers. A household that bought in two events counts twice, so this total is not a count of unique households. Unique households across events would need the club card data itself, which the dashboard does not hold (aggregates only).';
const PREV_TIP = 'Promo Buyer Count vs. the buyers of the same items over the same number of days right before the event (the previous week for a one-week Hot Buy).';
const LY_TIP = 'Promo Buyer Count vs. the buyers of the same items over the same days 52 weeks earlier; events with last-year data only.';

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

/** Key figures of a set of events (the period in A, one event in B). */
function shopperTiles(m: ShopperMetrics, many: boolean): Tile[] {
  return [
    {
      label: 'Promo Buyer Count',
      info: 'Club card households that bought the promoted item during the promotion. Household vs. card level per metric is pending; Promo Buyer Count uses households (#16).',
      value: count(m.buyers),
      sub: (
        <>
          {many && <SumLabel />}
          {vsUsual(m.buyersChange)}
        </>
      ),
      pending: 16,
    },
    { label: 'Avg Basket Size $', info: 'Average total transaction dollars for transactions that include the promoted item.', value: moneyUnit(m.basket), sub: vsUsual(m.basketChange), pending: 16 },
    { label: 'Promo Buyer Spend Change %', info: "Promo buyers' spend during the event vs. their usual spend.", value: <Var value={m.spendChange} kind="pct" />, pending: 16 },
    { label: 'Units per Basket', info: 'Average units in transactions that include the promoted item.', value: m.upb === null ? '—' : m.upb.toFixed(1), sub: vsUsual(m.upbChange), pending: 16 },
    { label: 'New-to-Category Buyers %', info: 'Share of promo buyers with no category purchase in the 52-week look-back.', value: pct(m.newToCat), pending: 11 },
    { label: 'Category Trips', info: 'Trips by promo buyers that included any item in the category, vs. their usual.', value: count(m.catTrips), sub: vsUsual(m.catTripsChange), pending: 16 },
    { label: 'Transaction Count', info: 'Total store transactions on promo days (store traffic indicator). Days shared by several events count once.', value: count(m.storeTxns), pending: 16 },
    { label: 'Repeat Purchase Rate %', info: `Level 2 (not MVP). Promo buyers who bought the item again at regular price within ${REPEAT_WINDOW_DAYS} days after the promotion. — until enough days have passed.`, value: pct(m.repeatRate), pending: 16 },
  ];
}

/** Every event as a table row (B's table). */
function eventRows(list: { e: number; m: ShopperMetrics }[], selected: number, onSelect: (e: number) => void): HierRow[] {
  return list.map(({ e, m }) => ({
    id: `e${e}`,
    label: PRICE_GROUPS[EVENTS[e].pg].name,
    sub: `${EVENTS[e].id} · ${PROMO_LABEL[EVENTS[e].type]}`,
    cells: { dates: eventDates(EVENTS[e]), buyers: count(m.buyers), basket: moneyUnit(m.basket), spend: <Var value={m.spendChange} kind="pct" />, upb: m.upb?.toFixed(1) ?? '—', ntc: pct(m.newToCat), trips: count(m.catTrips), txn: count(m.storeTxns), repeat: pct(m.repeatRate) },
    sort: { label: PRICE_GROUPS[EVENTS[e].pg].name, dates: EVENTS[e].start, buyers: m.buyers, basket: m.basket, spend: m.spendChange, upb: m.upb, ntc: m.newToCat, trips: m.catTrips, txn: m.storeTxns, repeat: m.repeatRate },
    onSelect: () => onSelect(e),
    selected: e === selected,
  }));
}

const EVENT_COLS: HierCol[] = [
  { key: 'dates', label: 'Dates', left: true },
  { key: 'buyers', label: 'Promo Buyer Count' },
  { key: 'basket', label: 'Avg Basket Size $' },
  { key: 'spend', label: 'Spend Change %' },
  { key: 'upb', label: 'Units per Basket' },
  { key: 'ntc', label: 'New-to-Category %' },
  { key: 'trips', label: 'Category Trips' },
  { key: 'txn', label: 'Transaction Count' },
  { key: 'repeat', label: 'Repeat Purchase Rate %' },
];

function TableCard({ label, title, sub, children }: { label: string; title: ReactNode; sub: ReactNode; children: ReactNode }) {
  return (
    <section className="card table-card" aria-label={label}>
      <header className="table-head">
        <div>
          <h3 className="chart-title">{title}</h3>
          <p className="block-tags">
            <SettingTags block="table" />
          </p>
          <p className="chart-sub">{sub}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function phases(before: number | null, during: number | null, after: number | null) {
  return [
    { x: 'Before (usual)', value: before },
    { x: 'During', value: during },
    { x: 'After (4 wk)', value: after },
  ];
}

/**
 * Promo Shopper Impact: the per-event panels did not work, so the view holds three layout proposals for review
 * (A Category summary, B Event detail, C Executive snapshot), picked with a local control (default A). All use club
 * card aggregates only.
 */
export default function ShopperView() {
  const { state, update } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const [proposal, setProposal] = useState<Proposal>(DEFAULT_PROPOSAL);
  const [pickedEvent, setPickedEvent] = useState(-1);
  const [pickedMonth, setPickedMonth] = useState('');

  const per = useMemo(() => scope.events.map((e) => ({ e, m: deriveShopper(eventShopper(EVENTS[e], scope.ctx)) })), [scope]);
  const latestFirst = useMemo(() => [...per].sort((a, b) => EVENTS[b.e].start - EVENTS[a.e].start), [per]);
  const all = useMemo(() => shopperOf(scope.events, scope.ctx), [scope]);
  const cats = useMemo(() => (proposal === 'A' ? categorySummary(scope.events, scope.ctx) : []), [proposal, scope]);
  const months = useMemo(() => hotBuyMonths(scope.events), [scope.events]);
  // C: the Hot Buy Score (fixed 4-week pre-period, Net Customer Sales); only the weight set changes it.
  const scores = useMemo(
    () => (proposal === 'C' ? hotBuyScores(scope.events, { ...scope.ctx, level: DEFAULT_CANN_LEVEL }, state.weights, DEFAULT_BASIS) : new Map<number, ScoreResult>()),
    [proposal, scope, state.weights],
  );

  if (scope.events.length === 0)
    return (
      <>
        <Heading />
        <EmptyState>No promotions start in {scope.range.label} for the current filters.</EmptyState>
      </>
    );

  // B: the event picked here, else the one selected in another view, else the latest whose 4 weeks after have passed.
  const latestComplete = latestFirst.find((x) => x.m.afterBuyers !== null) ?? latestFirst[0];
  const eventB = scope.events.includes(pickedEvent) ? pickedEvent : scope.events.includes(state.sel) ? state.sel : latestComplete.e;
  const mB = per.find((x) => x.e === eventB)!.m;
  const evB = EVENTS[eventB];
  // C: the month picked here, else the latest month that has ended (the current one is still partial).
  const month = months.find((m) => m.key === pickedMonth) ?? months.find((m) => m.key !== formatMonth(AS_OF_DAY)) ?? months[0];
  const open = (e: number) => update((s) => ({ ...s, tab: EVENTS[e].type === 'HB' ? 'hotbuy' : 'other', sel: e, event: -1, time: { ...effectiveTime(s), mode: 'all' } }));

  const desc = PROPOSALS.find((p) => p.id === proposal)!;
  const privacy = (
    <>
      <p className="privacy-note" role="note">
        <ShieldCheck size={15} aria-hidden="true" />
        Aggregates only: every figure is a total or average per promo event or category. No customer- or card-level detail is stored or shown. Club card data refreshed weekly; “usual” = the same buyers over the {baselineText(scope.ctx.baselineWeeks)} window.
      </p>
      <p className="privacy-note approval-note" role="note">
        Aggregates only. Individual-level detail requires approval (#16).
      </p>
    </>
  );

  return (
    <>
      <Heading />
      <ViewControls />
      <div className="card proposal-bar" role="group" aria-label="Layout proposal">
        <span className="toggle-group">
          <span className="toggle-label">Layout proposal</span>
          <Segmented<Proposal> small label="Layout proposal" value={proposal} onChange={setProposal} options={PROPOSALS.map((p) => ({ value: p.id, label: `${p.label} · ${p.name}` }))} />
        </span>
        <span className="chip status-proposed proposal-chip">{PROPOSAL_CHIP}</span>
        {proposal === 'B' && <EventPicker inline value={String(eventB)} options={eventOptions(scope.events, false)} onChange={(v) => setPickedEvent(Number(v))} />}
        {proposal === 'C' && month && (
          <Select className="month-picker" label="Ad month" value={month.key} options={months.map((m) => ({ value: m.key, label: `${m.label} (${m.events.length} Hot Buy${m.events.length === 1 ? '' : 's'})` }))} onChange={setPickedMonth} />
        )}
        <p className="proposal-desc">{desc.description}</p>
      </div>

      {proposal === 'A' && (
        <>
          <KeyFigures tags={<SettingTags block="tiles" />} caption={`${scope.range.name} · ${scope.events.length} events · club card households`} tiles={shopperTiles(all, all.events > 1)} />
          <ViewSummary>
            {scope.events.length} promotions in {cats.length} categories starting {scope.range.label}: <b>{count(all.buyers)}</b> promo buyers{scope.events.length > 1 ? ' (sum across events, not unique households)' : ''}, <b>{pct(all.newToCat)}</b> new to the category, buyers{' '}
            <b>
              <Var value={all.buyersVsPrev} kind="pct" />
            </b>{' '}
            vs. the week before.
          </ViewSummary>
          {privacy}
          <ChartGrid cols={2}>
            <ChartCard
              title="Promo Buyer Count by category"
              subtitle="Sum across events (not unique households); events in brackets"
              tags={<SettingTags block="panels" />}
              table={{ head: ['Category', 'Events', 'Promo Buyer Count'], rows: cats.map((c) => [c.label, c.events.length, Math.round(c.m.buyers)]) }}
              height={hbarHeight(Math.min(cats.length, 10), true)}
              contentHeight={hbarHeight(cats.length, true)}
            >
              <HBars data={cats.map((c) => ({ label: `${c.label} (${c.events.length})`, value: c.m.buyers }))} format={count} valueLabel="Promo Buyer Count" labelWidth={170} />
            </ChartCard>
            <ChartCard
              title="Promo buyer lift by category"
              subtitle="Vs. the previous week and vs. the same week last year"
              tags={<SettingTags block="panels" />}
              legend={[
                { label: 'Vs. previous week', color: C.s1, kind: 'rect' },
                { label: 'Vs. same week last year', color: C.s2, kind: 'rect' },
              ]}
              table={{ head: ['Category', 'Vs. previous week %', 'Vs. same week LY %'], rows: cats.map((c) => [c.label, pctChange(c.m.buyersVsPrev), pctChange(c.m.buyersVsLy)]) }}
              tableNote={`${PREV_TIP} ${LY_TIP}`}
              height={hbarHeight(Math.min(cats.length, 10), true)}
              contentHeight={hbarHeight(cats.length, true)}
            >
              <HBars
                data={cats.map((c) => ({ label: c.label, value: c.m.buyersVsPrev ?? 0, compare: c.m.buyersVsLy }))}
                format={(v) => pctChange(v)}
                valueLabel="Vs. previous week"
                compareLabel="Vs. same week last year"
                compareColor={C.s2}
                diverging
                labelWidth={170}
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
            sub="One row per category: club card aggregates of its events (ratio of totals)."
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
              ]}
              rows={cats.map((c) => ({
                id: `cat${c.cat}`,
                label: c.label,
                cells: { events: count(c.events.length), buyers: count(c.m.buyers), basket: moneyUnit(c.m.basket), ntc: pct(c.m.newToCat), prev: <Var value={c.m.buyersVsPrev} kind="pct" />, ly: <Var value={c.m.buyersVsLy} kind="pct" /> },
                sort: { label: c.label, events: c.events.length, buyers: c.m.buyers, basket: c.m.basket, ntc: c.m.newToCat, prev: c.m.buyersVsPrev, ly: c.m.buyersVsLy },
              }))}
              defaultSort={{ key: 'buyers', dir: 'desc' }}
              exportTitle="Promo Shopper Impact - Category summary"
              maxHeight={480}
            />
          </TableCard>
        </>
      )}

      {proposal === 'B' && (
        <>
          <KeyFigures tags={<SettingTags block="tiles" />} caption={`${PRICE_GROUPS[evB.pg].name} · ${evB.id} · ${PROMO_LABEL[evB.type]} · ${eventDates(evB)}`} tiles={shopperTiles(mB, false)} />
          {privacy}
          <ChartGrid cols={2}>
            <ChartCard
              title="Promo buyers before, during and after"
              subtitle={`${PRICE_GROUPS[evB.pg].name}, ${evB.id}`}
              tags={<SettingTags block="panels" />}
              table={{ head: ['Window', 'Promo buyers'], rows: phases(mB.usualBuyers, mB.buyers, mB.afterBuyers).map((p) => [p.x, p.value === null ? '—' : Math.round(p.value)]) }}
              tableNote="Before = the same buyers' usual (baseline window); after = the 4 weeks after the promo, scaled to the promo days (— until they have passed)."
              height={220}
            >
              <SignedColumns data={phases(mB.usualBuyers, mB.buyers, mB.afterBuyers)} format={count} valueLabel="Promo buyers" neutral />
            </ChartCard>
            <ChartCard
              title="Avg Basket Size $ before, during and after"
              subtitle={`${PRICE_GROUPS[evB.pg].name}, ${evB.id}`}
              tags={<SettingTags block="panels" />}
              table={{ head: ['Window', 'Avg Basket Size $'], rows: phases(mB.usualBasket, mB.basket, mB.afterBasket).map((p) => [p.x, moneyUnit(p.value)]) }}
              tableNote="Before = the same buyers' usual basket (baseline window); after = the 4 weeks after the promo."
              height={220}
            >
              <SignedColumns data={phases(mB.usualBasket, mB.basket, mB.afterBasket)} format={(v) => moneyUnit(v)} valueLabel="Avg Basket Size $" neutral />
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
            <HierTable hierarchy="Price group · event" columns={EVENT_COLS} rows={eventRows(latestFirst, eventB, setPickedEvent)} defaultSort={{ key: 'dates', dir: 'desc' }} exportTitle="Promo Shopper Impact" maxHeight={480} />
          </TableCard>
        </>
      )}

      {proposal === 'C' &&
        (month ? (
          <Snapshot month={month} per={per} scores={scores} ctx={scope.ctx} onOpen={open} />
        ) : (
          <EmptyState>No Hot Buys start in {scope.range.label} for the current filters, so there is no executive snapshot. Try a longer period or clear a filter.</EmptyState>
        ))}
    </>
  );
}

function Snapshot({ month, per, scores, ctx, onOpen }: { month: AdMonth; per: { e: number; m: ShopperMetrics }[]; scores: Map<number, ScoreResult>; ctx: EventCtx; onOpen: (e: number) => void }) {
  // Cards ordered by score, highest first (unscored last).
  const list = month.events.map((e) => ({ e, m: per.find((x) => x.e === e)!.m })).sort((a, b) => (scores.get(b.e)?.score ?? -1) - (scores.get(a.e)?.score ?? -1));
  const m = shopperOf(month.events, ctx);
  const avg = averageScore(scores, month.events);
  const tiles: Tile[] = [
    { label: 'Hot Buys', info: 'Hot Buys whose ad week starts in the month.', value: count(month.events.length) },
    { label: 'Promo Buyer Count', info: SUM_TIP, value: count(m.buyers), sub: <SumLabel />, pending: 16 },
    { label: 'Avg Basket Size $', info: 'Average total transaction dollars for transactions that include the promoted items.', value: moneyUnit(m.basket), sub: vsUsual(m.basketChange), pending: 16 },
    { label: 'New-to-Category Buyers %', info: 'Share of promo buyers with no category purchase in the 52-week look-back.', value: pct(m.newToCat), pending: 11 },
    {
      label: 'Hot Buy Score',
      info: `Average of the month’s Hot Buys, 0–100, and how many got each verdict (Weis Hot Buy Scoring Framework). ${SCORE_WINDOW_NOTE} ${SCORE_MARGIN_NOTE}`,
      chip: <ScoreChip info={false} />,
      value: avg === null ? '—' : String(Math.round(avg)),
      sub: <span className="verdict-counts">{verdictCountText(resultsOf(scores, month.events))}</span>,
    },
  ];
  return (
    <>
      <KeyFigures tags={<SettingTags block="snapshot" />} caption={`${month.label} · ${month.events.length} Hot Buy${month.events.length === 1 ? '' : 's'} · club card households`} tiles={tiles} />
      <p className="privacy-note approval-note" role="note">
        Aggregates only. Individual-level detail requires approval (#16).
      </p>
      <section aria-label="Executive snapshot">
        <div className="snapshot-head">
          <h3 className="secondary-title">
            Every Hot Buy of {month.label}, by Hot Buy Score <SettingTags block="snapshot" />
          </h3>
          <BlockSettings block="snapshot" />
        </div>
        <div className="shopper-grid snapshot-grid">
          {list.map(({ e, m: em }) => (
            <article key={e} className="card snapshot-card">
              <header>
                <h4 title={PRICE_GROUPS[EVENTS[e].pg].name}>{PRICE_GROUPS[EVENTS[e].pg].name}</h4>
                <p>
                  {EVENTS[e].id} · {eventDates(EVENTS[e])}
                </p>
              </header>
              <ScoreBadge s={scores.get(e)} />
              <dl>
                <div>
                  <dt>Promo buyers</dt>
                  <dd>{count(em.buyers)}</dd>
                  {vsUsual(em.buyersChange)}
                </div>
                <div>
                  <dt>Avg basket</dt>
                  <dd>{moneyUnit(em.basket)}</dd>
                  {vsUsual(em.basketChange)}
                </div>
                <div>
                  <dt>New to category</dt>
                  <dd>{pct(em.newToCat)}</dd>
                </div>
                <div>
                  <dt>Spend change</dt>
                  <dd>
                    <Var value={em.spendChange} kind="pct" />
                  </dd>
                </div>
              </dl>
              <button type="button" className="btn-link" onClick={() => onOpen(e)}>
                Show in Hot Buy Performance
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Heading() {
  return <SectionHeading title="Promo Shopper Impact" badge={<Pending q={16} />} objective={VIEW_INFO.shopper.objective} />;
}
