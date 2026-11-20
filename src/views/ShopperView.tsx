import { ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { KeyFigures, SectionHeading, type Tile } from '../components/Blocks';
import { HierTable, type HierCol, type HierRow } from '../components/HierTable';
import { InfoTip, Pending, Var } from '../components/ui';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { baselineText } from '../lib/baseline';
import { effectiveTime } from '../lib/filters';
import { useFilters } from '../lib/filterStore';
import { count, moneyUnit, pct } from '../lib/format';
import { getScope } from '../lib/selectors';
import { deriveShopper, eventShopper, REPEAT_WINDOW_DAYS, shopperOf, type ShopperMetrics } from '../lib/shopper';
import { EmptyState, eventDates, ViewControls, type ViewProps } from './common';

const STORY =
  'As a Category Manager I want to see how shoppers who bought my promoted items behaved (basket size, spend vs. their usual, new-to-category buyers and category trips) so that I can tell whether a promotion grew baskets and the category, not just the promoted item.';
const PANEL_LIMIT = 12;
export const SUM_LABEL = 'Sum across events (not unique households)';
const SUM_TIP = 'Each event counts its own buyers. A household that bought in two events counts twice, so this total is not a count of unique households. Unique households across events would need the club card data itself, which the dashboard does not hold (aggregates only).';

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

function Panel({ e, m, onOpen }: { e: number; m: ShopperMetrics; onOpen: () => void }) {
  const ev = EVENTS[e];
  return (
    <article className="card shopper-panel">
      <header>
        <h4>{PRICE_GROUPS[ev.pg].name}</h4>
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
          <dt>Promo Buyer Spend Change %</dt>
          <dd>
            <Var value={m.spendChange} kind="pct" />
          </dd>
          <span className="vs-usual">spend vs. their usual</span>
        </div>
        <div>
          <dt>Units per Basket</dt>
          <dd>{m.upb === null ? '—' : m.upb.toFixed(1)}</dd>
          {vsUsual(m.upbChange)}
        </div>
        <div>
          <dt>New-to-Category Buyers %</dt>
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
        Show in Hot Buy / Other Promo Performance
      </button>
    </article>
  );
}

export default function ShopperView({ openDefinitions }: ViewProps) {
  const { state, update } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const [showAll, setShowAll] = useState(false);
  const per = useMemo(() => scope.events.map((e) => ({ e, s: eventShopper(EVENTS[e], scope.ctx) })), [scope]);
  const all = useMemo(() => shopperOf(scope.events, scope.ctx), [scope]);
  const sorted = useMemo(() => [...per].sort((a, b) => EVENTS[b.e].start - EVENTS[a.e].start).map((x) => ({ e: x.e, m: deriveShopper(x.s) })), [per]);

  if (scope.events.length === 0)
    return (
      <>
        <Heading />
        <EmptyState>No promotions start in {scope.range.label} for the current filters.</EmptyState>
      </>
    );

  const tiles: Tile[] = [
    {
      label: 'Promo Buyer Count',
      info: 'Club card households that bought the promoted item during the promotion. Household vs. card level per metric is pending; Promo Buyer Count uses households (#16).',
      value: count(all.buyers),
      sub: (
        <>
          {all.events > 1 && <SumLabel />}
          {vsUsual(all.buyersChange)}
        </>
      ),
      pending: 16,
    },
    { label: 'Avg Basket Size $', info: 'Average total transaction dollars for transactions that include the promoted item.', value: moneyUnit(all.basket), sub: vsUsual(all.basketChange), pending: 16 },
    { label: 'Promo Buyer Spend Change %', info: "Promo buyers' spend during the event vs. their usual spend.", value: <Var value={all.spendChange} kind="pct" />, pending: 16 },
    { label: 'Units per Basket', info: 'Average units in transactions that include the promoted item.', value: all.upb === null ? '—' : all.upb.toFixed(1), sub: vsUsual(all.upbChange), pending: 16 },
    { label: 'New-to-Category Buyers %', info: 'Share of promo buyers with no category purchase in the 52-week look-back.', value: pct(all.newToCat), pending: 11 },
    { label: 'Category Trips', info: 'Trips by promo buyers that included any item in the category, vs. their usual.', value: count(all.catTrips), sub: vsUsual(all.catTripsChange), pending: 16 },
    { label: 'Transaction Count', info: 'Total store transactions on promo days (store traffic indicator). Days shared by several events count once.', value: count(all.storeTxns), pending: 16 },
    { label: 'Repeat Purchase Rate %', info: `Level 2 (not MVP). Promo buyers who bought the item again at regular price within ${REPEAT_WINDOW_DAYS} days after the promotion. — until enough days have passed.`, value: pct(all.repeatRate), pending: 16 },
  ];

  const cols: HierCol[] = [
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
  const rows: HierRow[] = sorted.map(({ e, m }) => ({
    id: `e${e}`,
    label: PRICE_GROUPS[EVENTS[e].pg].name,
    sub: `${EVENTS[e].id} · ${PROMO_LABEL[EVENTS[e].type]}`,
    cells: { dates: eventDates(EVENTS[e]), buyers: count(m.buyers), basket: moneyUnit(m.basket), spend: <Var value={m.spendChange} kind="pct" />, upb: m.upb?.toFixed(1) ?? '—', ntc: pct(m.newToCat), trips: count(m.catTrips), txn: count(m.storeTxns), repeat: pct(m.repeatRate) },
    sort: { label: PRICE_GROUPS[EVENTS[e].pg].name, dates: EVENTS[e].start, buyers: m.buyers, basket: m.basket, spend: m.spendChange, upb: m.upb, ntc: m.newToCat, trips: m.catTrips, txn: m.storeTxns, repeat: m.repeatRate },
  }));
  const open = (e: number) => update((s) => ({ ...s, tab: EVENTS[e].type === 'HB' ? 'hotbuy' : 'other', sel: e, event: -1, time: { ...effectiveTime(s), mode: 'all' } }));
  const panels = showAll ? sorted : sorted.slice(0, PANEL_LIMIT);

  return (
    <>
      <Heading>
        {scope.events.length} promotions starting {scope.range.label}: <b>{count(all.buyers)}</b> promo buyers{scope.events.length > 1 ? ' (sum across events, not unique households)' : ''} spent <b>{<Var value={all.spendChange} kind="pct" />}</b> vs. their usual, with <b>{pct(all.newToCat)}</b> new to the category.
      </Heading>
      <p className="privacy-note" role="note">
        <ShieldCheck size={15} aria-hidden="true" />
        Aggregates only: every figure is a total or average per promo event. No customer- or card-level detail is stored or shown. Club card data refreshed weekly; “usual” = the same buyers over the {baselineText(scope.ctx.baselineWeeks)} window.
      </p>
      <p className="privacy-note approval-note" role="note">
        Aggregates only. Individual-level detail requires approval (#16).
      </p>
      <ViewControls cann={false} basis={false} />
      <KeyFigures caption={`${scope.range.name} · ${scope.events.length} events · club card households`} tiles={tiles} />

      <section aria-label="Panel per event">
        <h3 className="secondary-title">One panel per event</h3>
        <div className="shopper-grid">
          {panels.map(({ e, m }) => (
            <Panel key={e} e={e} m={m} onOpen={() => open(e)} />
          ))}
        </div>
        {sorted.length > PANEL_LIMIT && (
          <button type="button" className="btn-outline more-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show the latest 12' : `Show all ${sorted.length} events`}
          </button>
        )}
      </section>

      <section className="card table-card" aria-label="All events">
        <header className="table-head">
          <div>
            <h3 className="chart-title">
              All events <Pending q={16} />
            </h3>
            <p className="chart-sub">
              The same aggregates for every event, plus Transaction Count and Repeat Purchase Rate %.{' '}
              <button type="button" className="btn-link" onClick={() => openDefinitions('buyers')}>
                Definitions
              </button>
            </p>
          </div>
        </header>
        <HierTable hierarchy="Price group · event" columns={cols} rows={rows} defaultSort={{ key: 'dates', dir: 'desc' }} exportTitle="Promo Shopper Impact" maxHeight={480} />
      </section>
    </>
  );
}

function Heading({ children }: { children?: React.ReactNode }) {
  return (
    <SectionHeading
      eyebrow="Should Have · View 5 of 5"
      title="Promo Shopper Impact"
      question="Did the promotion grow baskets and the category, not just the promoted item?"
      story={STORY}
      badge={<Pending q={16} />}
      validate="Symphony AI cannot be a data source, only a reference for comparison (#12); shopper metrics are calculated from the Weis T-log and Club Card tables. Household vs. card level per metric (#16). New-to-category logic from a third-party system (#11). About 6 to 8 core metrics, which ones pending (#9). Rewards and loyalty campaigns are out of scope."
    >
      {children}
    </SectionHeading>
  );
}
