import { useMemo } from 'react';
import { BannerStack, Banner, KeyFigures, SectionHeading, type Tile } from '../components/Blocks';
import { C, ChartCard, ChartGrid, HBars, hbarHeight, StackedBars } from '../components/Charts';
import { HierTable, type HierRow } from '../components/HierTable';
import { Pending } from '../components/ui';
import { CATS, ITEMS, itemCode, PRICE_GROUPS, VENDORS } from '../data/products';
import { EVENTS, FUNDING_TYPES, PROMO_LABEL } from '../data/promos';
import { useFilters } from '../lib/filterStore';
import { moneyCompact, pct, ratio, signedMoney } from '../lib/format';
import { derive, eventAgg, sumAggs, type Agg, type Metrics } from '../lib/metrics';
import { getScope } from '../lib/selectors';
import { EmptyState, eventSub, METRIC_COLS, roiText, ViewControls, type MetricCol, type ViewProps } from './common';

const STORY = 'As a Category Manager I want to be able to track promo spend by vendor and category down to the item level so that I can efficiently track how much of my promotions are vendor funded.';

const fundCol = (id: 'scan' | 'bill' | 'other', label: string): MetricCol => ({
  key: id,
  label,
  group: 'Funding',
  defaultHidden: id === 'other',
  cell: (m: Metrics) => moneyCompact(m.fundingByType[id]),
  sort: (m: Metrics) => m.fundingByType[id],
});

const COLS: MetricCol[] = [
  { ...METRIC_COLS.type, defaultHidden: true },
  { ...METRIC_COLS.dates, defaultHidden: true },
  METRIC_COLS.invest,
  METRIC_COLS.funding,
  fundCol('scan', 'Scan-down $'),
  fundCol('bill', 'Bill-back $'),
  fundCol('other', 'Other allowance $'),
  METRIC_COLS.vendorPct,
  METRIC_COLS.weisCost,
  { ...METRIC_COLS.gm, label: 'GM $ before funding' },
  { ...METRIC_COLS.netGm, label: 'GM $ after funding (Net GM $)' },
  { ...METRIC_COLS.netIncGm, defaultHidden: true },
  METRIC_COLS.roi,
];

export default function FundingView({ openDefinitions }: ViewProps) {
  const { state } = useFilters();
  const scope = useMemo(() => getScope(state), [state]);
  const basis = state.basis;

  const data = useMemo(() => {
    const aggs = new Map<number, Agg>();
    for (const e of scope.events) aggs.set(e, eventAgg(EVENTS[e], scope.ctx));
    const cells = (m: Metrics, e?: (typeof EVENTS)[number]) => {
      const c: Record<string, React.ReactNode> = {};
      const s: Record<string, number | string | null> = {};
      for (const col of COLS) {
        c[col.key] = col.cell(m, e);
        s[col.key] = col.sort(m, e);
      }
      return { cells: c, sort: s };
    };
    const byVendor = new Map<number, Map<number, number[]>>();
    for (const e of scope.events) {
      const pg = PRICE_GROUPS[EVENTS[e].pg];
      const v = byVendor.get(pg.vendor) ?? new Map<number, number[]>();
      v.set(pg.cat, [...(v.get(pg.cat) ?? []), e]);
      byVendor.set(pg.vendor, v);
    }
    const rows: HierRow[] = [...byVendor.entries()].map(([v, cats]) => {
      const vm = derive(sumAggs([...cats.values()].flat().map((e) => aggs.get(e)!)), basis);
      return {
        id: `v${v}`,
        label: VENDORS[v],
        sub: `${[...cats.values()].flat().length} events`,
        ...cells(vm),
        children: [...cats.entries()].map(([c, evs]) => {
          const cm = derive(sumAggs(evs.map((e) => aggs.get(e)!)), basis);
          return {
            id: `v${v}c${c}`,
            label: CATS[c].name,
            sub: `${evs.length} events`,
            ...cells(cm),
            children: evs.map((e) => {
              const ev = EVENTS[e];
              const em = derive(aggs.get(e)!, basis);
              return {
                id: `e${e}`,
                label: PRICE_GROUPS[ev.pg].name,
                sub: `${eventSub(ev)} · ${Object.keys(ev.fundingMix).length ? Object.keys(ev.fundingMix).map((k) => FUNDING_TYPES.find((f) => f.id === k)!.label).join(' + ') : 'No vendor funding'}`,
                ...cells(em, ev),
                children: PRICE_GROUPS[ev.pg].items
                  .filter((i) => !scope.ctx.itemMask || scope.ctx.itemMask[i])
                  .map((i) => ({ id: `e${e}i${i}`, label: ITEMS[i].name, sub: `SKU ${ITEMS[i].sku} · ${itemCode(ITEMS[i])}`, ...cells(derive(eventAgg(ev, scope.ctx, i), basis)), className: 'sku-row' })),
              };
            }),
          };
        }),
      };
    });
    const total = derive(sumAggs([...aggs.values()]), basis);
    const vendorTotals = [...byVendor.entries()]
      .map(([v, cats]) => ({ v, m: derive(sumAggs([...cats.values()].flat().map((e) => aggs.get(e)!)), basis) }))
      .sort((a, b) => b.m.invest - a.m.invest);
    const catTotals = new Map<number, Agg[]>();
    for (const e of scope.events) {
      const c = PRICE_GROUPS[EVENTS[e].pg].cat;
      catTotals.set(c, [...(catTotals.get(c) ?? []), aggs.get(e)!]);
    }
    return { rows, total, vendorTotals, catTotals: [...catTotals.entries()].map(([c, list]) => ({ c, m: derive(sumAggs(list), basis) })) };
  }, [scope, basis]);

  const t = data.total;
  const own = data.vendorTotals.find((x) => VENDORS[x.v].startsWith('Weis'));
  const fully = scope.events.filter((e) => EVENTS[e].fundingRate >= 0.999);
  const filtered = state.funding !== 'all' ? FUNDING_TYPES.find((f) => f.id === state.funding)!.label : null;

  if (scope.events.length === 0)
    return (
      <>
        <Heading />
        <EmptyState>No promotions start in {scope.range.label} for the current filters.</EmptyState>
      </>
    );

  const tiles: Tile[] = [
    { label: 'Promo Investment $', info: '(Regular retail − Promo retail) × Promo Units: markdown dollars given up.', value: moneyCompact(t.invest), sub: `${scope.events.length} events`, pending: 2 },
    {
      label: 'Vendor Promo Funding $',
      info: 'Scan-downs, bill-backs and other promo allowances tied to the events. With the Funding Type filter, only that type.',
      value: moneyCompact(t.funding),
      sub: filtered ? `${filtered} only · all types ${moneyCompact(t.fundingAll)}` : FUNDING_TYPES.map((f) => `${f.label.split(' ')[0]} ${moneyCompact(t.fundingByType[f.id])}`).join(' · '),
      pending: 2,
    },
    { label: 'Vendor-Funded %', info: 'Vendor Promo Funding $ ÷ Promo Investment $.', value: pct(t.vendorPct), pending: 2 },
    { label: 'Weis-Funded Promo Cost $', info: 'Promo Investment $ − Vendor Promo Funding $.', value: moneyCompact(t.weisCost), pending: 2 },
    { label: 'Net GM $', info: 'Promo Gross Margin $ + Vendor Promo Funding $ (all funding types, whatever the Funding Type filter).', value: moneyCompact(t.netGm), sub: <>Before funding {moneyCompact(t.gm)}</>, pending: 3 },
    { label: 'Promo ROI', info: 'Net Incremental GM $ ÷ Weis-Funded Promo Cost $. Both use all vendor funding.', value: roiText(t), sub: <>Net Incremental GM {signedMoney(t.netIncGm)}</>, pending: 3 },
  ];

  const top = data.vendorTotals.slice(0, 10);
  return (
    <>
      <Heading>
        {scope.range.name}: Weis invested <b>{moneyCompact(t.invest)}</b> in markdowns across {scope.events.length} promotions; vendors funded <b>{pct(t.vendorPct)}</b> ({moneyCompact(t.funding)}), leaving <b>{moneyCompact(t.weisCost)}</b> to Weis. Each Weis dollar (after all vendor funding) returned{' '}
        <b>{ratio(t.roi)}</b> in Net Incremental GM.
      </Heading>
      <BannerStack>
        {filtered && (
          <Banner lead={`${filtered} only:`} kind="note">
            Vendor Promo Funding $, Vendor-Funded % and Weis-Funded Promo Cost $ count only {filtered.toLowerCase()} funding. Net GM $, Net Incremental GM $ and Promo ROI keep all vendor funding of these events (definition #3).
          </Banner>
        )}
        {fully.length > 0 && (
          <Banner lead="Fully vendor funded:" kind="note">
            {fully.length} event{fully.length > 1 ? 's were' : ' was'} paid entirely by the vendor (for example {PRICE_GROUPS[EVENTS[fully[fully.length - 1]].pg].name}, {EVENTS[fully[fully.length - 1]].id}); Promo ROI is not defined for {fully.length > 1 ? 'them' : 'it'} and shows —.
          </Banner>
        )}
        {own && own.m.invest > 0 && (
          <Banner lead="Own brand:" kind="note">
            Weis Quality promotions carry no vendor funding: {moneyCompact(own.m.invest)} of investment is fully Weis-funded.
          </Banner>
        )}
      </BannerStack>

      <ViewControls cann={false} basis />
      <KeyFigures caption={`${scope.range.name} · all funding types${state.funding !== 'all' ? ` · events with ${FUNDING_TYPES.find((f) => f.id === state.funding)!.label}` : ''}`} tiles={tiles} />

      <section className="card table-card" aria-label="Funding by vendor and category">
        <header className="table-head">
          <div>
            <h3 className="chart-title">Funding by vendor and category</h3>
            <p className="chart-sub">Vendor › Category › Promo Event › SKU Number. Vendor-funded vs. Weis-funded dollars and GM $ before and after vendor funding. The Funding Type filter keeps events that use that type; amounts always include all of an event's funding.</p>
          </div>
        </header>
        <HierTable hierarchy="Vendor › Category › Event › SKU" columns={COLS} rows={data.rows} total={{ id: 'total', label: 'Total', sub: `${scope.events.length} events`, cells: Object.fromEntries(COLS.map((c) => [c.key, c.cell(t)])), sort: {} }} defaultSort={{ key: 'invest', dir: 'desc' }} tableId="fund" exportTitle="Promo Funding" maxHeight={560} />
      </section>

      <ChartGrid cols={2}>
        <ChartCard
          title="Vendor-funded vs. Weis-funded"
          subtitle="Top 10 vendors by promo investment"
          legend={[
            { label: 'Vendor-funded', color: C.s1, kind: 'rect' },
            { label: 'Weis-funded', color: C.s2, kind: 'rect' },
          ]}
          table={{ head: ['Vendor', 'Vendor-funded $', 'Weis-funded $', 'Vendor-Funded %'], rows: top.map((x) => [VENDORS[x.v], Math.round(x.m.funding), Math.round(x.m.weisCost ?? 0), pct(x.m.vendorPct)]) }}
          height={280}
        >
          <StackedBars
            data={top.map((x) => ({ x: VENDORS[x.v].replace(/^The /, '').split(' ').slice(0, 2).join(' '), vendor: x.m.funding, weis: Math.max(0, x.m.weisCost ?? 0) }))}
            series={[
              { key: 'vendor', label: 'Vendor-funded', color: C.s1 },
              { key: 'weis', label: 'Weis-funded', color: C.s2 },
            ]}
            format={moneyCompact}
            tickFormat={moneyCompact}
            totalLabel="Promo Investment"
          />
        </ChartCard>
        <ChartCard title="Vendor-Funded % by category" subtitle={<>Share of promo investment paid by vendors <Pending q={2} /></>} table={{ head: ['Category', 'Vendor-Funded %'], rows: data.catTotals.map((x) => [CATS[x.c].name, pct(x.m.vendorPct)]) }} height={280} contentHeight={hbarHeight(data.catTotals.length)}>
          <HBars data={[...data.catTotals].sort((a, b) => (b.m.vendorPct ?? 0) - (a.m.vendorPct ?? 0)).map((x) => ({ label: CATS[x.c].name, value: x.m.vendorPct ?? 0 }))} format={(v) => pct(v, 0)} valueLabel="Vendor-Funded %" labelWidth={140} />
        </ChartCard>
      </ChartGrid>
      <p className="table-note">
        Promo types in scope: {[...new Set(scope.events.map((e) => PROMO_LABEL[EVENTS[e].type]))].join(', ')}.{' '}
        <button type="button" className="btn-link" onClick={() => openDefinitions('roi')}>
          How Promo ROI is calculated
        </button>
      </p>
    </>
  );
}

function Heading({ children }: { children?: React.ReactNode }) {
  return (
    <SectionHeading
      eyebrow="Should Have · View 4 of 6"
      title="Promo Funding"
      question="How much of each promotion did the vendor pay, and what did Weis get for its share?"
      story={STORY}
      badge={<Pending q={2} label="Scope pending confirmation" />}
      validate="The scope of this view is in discussion with the business (#2). Net GM $ and Promo ROI add all vendor funding: scan-down, bill-back and other promo allowances (#3)."
    >
      {children}
    </SectionHeading>
  );
}
