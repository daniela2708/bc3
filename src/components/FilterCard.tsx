import { CalendarDays, RotateCcw } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AS_OF_DAY, dayFromISO, dayFromUS, formatDay, FISCAL_YEARS, HOLIDAYS, holidayAvailable, isoFromDay, snapToSunday, snapToThursday } from '../data/calendar';
import { BRANDS, DEPTS, VENDORS } from '../data/products';
import { AD_TYPES, DEPTH_BANDS, EVENTS, eventLabel, FUNDING_TYPES, PROMO_TYPES } from '../data/promos';
import { REGIONS } from '../data/stores';
import {
  categoriesOf,
  clampDay,
  effectiveTime,
  fiscalOptionAvailable,
  GRAIN_LABEL,
  offReason,
  promoTypesFor,
  resolveTime,
  ROLLING_OPTS,
  subcategoriesOf,
  TO_DATE_LABEL,
  usesFilter,
  type FiscalGrain,
  type RollingOpt,
  type TimeMode,
  type ToDateOpt,
} from '../lib/filters';
import { actions, useFilters } from '../lib/filterStore';
import { candidateEvents, itemMaskOf } from '../lib/selectors';
import { PriceGroupPicker } from './PriceGroupPicker';
import { Select } from './Select';
import { SkuSearch } from './SkuSearch';
import { StorePopover } from './StorePopover';
import { Field, InfoTip, Segmented } from './ui';

const RANGE_TIP = `Use mm/dd/yyyy, from 12/31/2023 to ${formatDay(AS_OF_DAY)}`;

/** Date field typed as MM/DD/YYYY (validated on blur or Enter); the calendar button opens the native picker. */
function DateInput({ label, value, onChange, disabledReason }: { label: string; value: number; onChange: (d: number) => void; disabledReason?: string }) {
  const id = useId();
  const [text, setText] = useState(formatDay(value));
  const [invalid, setInvalid] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText(formatDay(value));
    setInvalid(false);
  }, [value]);
  const commit = () => {
    const d = dayFromUS(text);
    if (d === null) {
      setInvalid(text.trim() !== formatDay(value));
      return;
    }
    setInvalid(false);
    const c = clampDay(d);
    setText(formatDay(c));
    if (c !== value) onChange(c);
  };
  return (
    <Field label={label} htmlFor={id} disabledReason={disabledReason}>
      <div className={`date-field${invalid ? ' is-invalid' : ''}`}>
        <input
          id={id}
          className="text-input"
          type="text"
          inputMode="numeric"
          placeholder="mm/dd/yyyy"
          maxLength={10}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
          title={invalid ? RANGE_TIP : 'mm/dd/yyyy'}
          value={text}
          disabled={!!disabledReason}
          onChange={(e) => setText(e.target.value.replace(/[^\d/]/g, '').slice(0, 10))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <button
          type="button"
          className="date-btn"
          aria-label={`Pick ${label.toLowerCase()} from a calendar`}
          disabled={!!disabledReason}
          onClick={() => {
            try {
              picker.current?.showPicker();
            } catch {
              picker.current?.focus();
            }
          }}
        >
          <CalendarDays size={14} aria-hidden="true" />
        </button>
        <input
          ref={picker}
          className="date-native"
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          min={isoFromDay(0)}
          max={isoFromDay(AS_OF_DAY)}
          value={isoFromDay(value)}
          onChange={(e) => {
            const d = dayFromISO(e.target.value);
            if (d !== null) onChange(clampDay(d));
          }}
        />
        {invalid && (
          <span className="sr-only" id={`${id}-err`} role="alert">
            {RANGE_TIP}
          </span>
        )}
      </div>
    </Field>
  );
}

export function FilterCard() {
  const { state, update } = useFilters();
  const tab = state.tab;
  const t = effectiveTime(state);
  const range = resolveTime(t, tab);
  const setTime = (patch: Parameters<typeof actions.time>[0]) => update(actions.time(patch));
  const holidayOk = usesFilter(tab, 'holiday');

  const periodOptions = (() => {
    switch (t.mode) {
      case 'todate':
        return (Object.keys(TO_DATE_LABEL) as ToDateOpt[]).map((k) => ({ value: k, label: TO_DATE_LABEL[k] }));
      case 'rolling':
        return ROLLING_OPTS.map((n) => ({ value: String(n), label: `${n}-week rolling` }));
      case 'fiscal':
        return (Object.keys(GRAIN_LABEL) as FiscalGrain[]).map((k) => ({
          value: k,
          label: k === 'holiday' && !holidayOk ? `${GRAIN_LABEL[k]} (Promo History only)` : GRAIN_LABEL[k],
          disabled: k === 'holiday' && !holidayOk,
        }));
      default:
        return [];
    }
  })();
  const periodValue = t.mode === 'todate' ? t.toDate : t.mode === 'rolling' ? String(t.rolling) : t.grain;
  const onPeriod = (v: string) => {
    if (t.mode === 'todate') setTime({ toDate: v as ToDateOpt });
    else if (t.mode === 'rolling') setTime({ rolling: Number(v) as RollingOpt });
    else setTime({ grain: v as FiscalGrain });
  };

  const cats = categoriesOf(state.dept);
  const subs = subcategoriesOf(state.cat);
  const allowedTypes = promoTypesFor(tab);
  const mask = useMemo(() => itemMaskOf(state), [state]);
  const eventOptions = useMemo(() => {
    const list = candidateEvents({ ...state, event: -1 }, range, mask);
    return list.slice(-300).reverse();
  }, [state, range, mask]);

  return (
    <section className="card filter-card" aria-label="Filters">
      <div className="filter-row">
        <span className="row-label">
          Time
          <InfoTip
            text={`Ad weeks run Thursday to Wednesday; fiscal weeks (Week beginning, periods, quarters) run Sunday to Saturday on the Weis 4-4-5 calendar. An event is included when it starts in the range. Sales data through ${formatDay(AS_OF_DAY)}.`}
            below
          />
        </span>
        <Field label="View by">
          <Segmented<TimeMode>
            label="Time selection type"
            value={t.mode}
            onChange={(mode) => setTime({ mode })}
            options={[
              { value: 'todate', label: 'To Date' },
              { value: 'rolling', label: 'Rolling' },
              { value: 'fiscal', label: 'Fiscal Calendar' },
              { value: 'custom', label: 'Date Range' },
              { value: 'all', label: 'All history' },
            ]}
          />
        </Field>
        {(t.mode === 'todate' || t.mode === 'rolling' || t.mode === 'fiscal') && <Select label={t.mode === 'fiscal' ? 'Grain' : 'Span'} value={periodValue} options={periodOptions} onChange={onPeriod} />}
        {t.mode === 'fiscal' && (t.grain === 'year' || t.grain === 'quarter' || t.grain === 'period' || t.grain === 'holiday') && (
          <Select label="Year" value={String(t.fy)} options={FISCAL_YEARS.map((y) => ({ value: String(y), label: `FY${y}` }))} onChange={(v) => setTime({ fy: Number(v) })} />
        )}
        {t.mode === 'fiscal' && t.grain === 'quarter' && (
          <Select
            label="Quarter"
            value={String(t.quarter)}
            options={[1, 2, 3, 4].map((q) => ({ value: String(q), label: `Q${q} (P${q * 3 - 2}–P${q * 3})`, disabled: !fiscalOptionAvailable('quarter', t.fy, q) }))}
            onChange={(v) => setTime({ quarter: Number(v) })}
          />
        )}
        {t.mode === 'fiscal' && t.grain === 'period' && (
          <Select
            label="Period"
            value={String(t.period)}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `P${i + 1}`, disabled: !fiscalOptionAvailable('period', t.fy, i + 1) }))}
            onChange={(v) => setTime({ period: Number(v) })}
          />
        )}
        {t.mode === 'fiscal' && t.grain === 'adweek' && <DateInput label="Ad week (Thursday)" value={t.adWeek} onChange={(d) => setTime({ adWeek: snapToThursday(d) })} />}
        {t.mode === 'fiscal' && t.grain === 'week' && <DateInput label="Week beginning (Sunday)" value={t.weekStart} onChange={(d) => setTime({ weekStart: snapToSunday(d) })} />}
        {t.mode === 'fiscal' && t.grain === 'holiday' && (
          <Select
            label="Holiday period"
            value={t.holiday}
            options={HOLIDAYS.map((h) => ({ value: h.id, label: `${h.label}${holidayAvailable(h.id, t.fy) ? '' : ' · not yet'}`, disabled: !holidayAvailable(h.id, t.fy) }))}
            onChange={(v) => setTime({ holiday: v as typeof t.holiday })}
          />
        )}
        {t.mode === 'custom' && (
          <>
            <DateInput label="From" value={t.from} onChange={(d) => setTime({ from: d })} />
            <DateInput label="To" value={t.to} onChange={(d) => setTime({ to: d })} />
          </>
        )}
        <span className="range-hint">
          {range.name} · {range.label}
        </span>
        <span className="filter-spacer" />
        <button type="button" className="btn-outline" onClick={() => update(actions.reset())}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset filters
        </button>
      </div>

      <div className="filter-row">
        <span className="row-label">
          Product
          <InfoTip text="Department, Category and Subcategory cascade into Price Group (Item Group / Price Association). Paste a UPC / PLU list instead of picking a price group. Greyed-out filters are not listed for this view in the requirements workbook." below />
        </span>
        <Select
          className="w-dept"
          label="Department"
          value={String(state.dept)}
          options={[{ value: '-1', label: 'All departments' }, ...DEPTS.map((d) => ({ value: String(d.idx), label: d.name }))]}
          onChange={(v) => update(actions.dept(Number(v)))}
          disabledReason={offReason(tab, 'dept')}
        />
        <Select
          className="w-cat"
          label="Category"
          value={String(state.cat)}
          options={[{ value: '-1', label: 'All categories' }, ...cats.map((c) => ({ value: String(c.idx), label: state.dept < 0 ? `${DEPTS[c.dept].name} › ${c.name}` : c.name }))]}
          onChange={(v) => update(actions.cat(Number(v)))}
          disabledReason={offReason(tab, 'cat')}
        />
        <Select
          className="w-sub"
          label="Subcategory"
          value={String(state.sub)}
          options={[{ value: '-1', label: state.cat < 0 ? 'Choose a category' : 'All subcategories' }, ...subs.map((s) => ({ value: String(s.idx), label: s.name }))]}
          onChange={(v) => update(actions.sub(Number(v)))}
          disabledReason={offReason(tab, 'sub')}
          disabled={state.cat < 0}
        />
        <PriceGroupPicker
          pg={state.pg}
          codes={state.codes}
          dept={state.dept}
          cat={state.cat}
          sub={state.sub}
          onPg={(pg) => update(actions.pg(pg))}
          onCodes={(c) => update(actions.codes(c))}
          disabledReason={offReason(tab, 'pg')}
        />
        <SkuSearch item={state.item} onSelect={(i) => update(actions.item(i))} disabledReason={offReason(tab, 'item')} />
        <Select
          className="w-vb"
          label="Vendor / Brand"
          value={state.vb}
          options={[
            { value: '', label: 'All vendors and brands' },
            ...VENDORS.map((v, i) => ({ value: `v:${i}`, label: v, group: 'Vendor' })).sort((a, b) => a.label.localeCompare(b.label)),
            ...BRANDS.map((b, i) => ({ value: `b:${i}`, label: b, group: 'Brand' })).sort((a, b) => a.label.localeCompare(b.label)),
          ]}
          onChange={(v) => update((s) => ({ ...s, vb: v, sel: -1, event: -1 }))}
          disabledReason={offReason(tab, 'vb')}
        />
      </div>

      <div className="filter-row">
        <span className="row-label">
          Promotion
          <InfoTip text="Promo Event lists the runs that match the other filters (latest first). Location applies to Hot Buy Performance only, as in the workbook; store values are the chain value × the store's share of its department." below />
        </span>
        <Select
          className="w-type"
          label="Promo Type"
          value={allowedTypes.length === 1 ? allowedTypes[0] : state.promoType}
          options={[
            ...(allowedTypes.length > 1 ? [{ value: 'all', label: tab === 'other' ? 'All except Hot Buy' : 'All promo types' }] : []),
            ...PROMO_TYPES.filter((p) => allowedTypes.includes(p.id)).map((p) => ({ value: p.id, label: p.label })),
          ]}
          onChange={(v) => update((s) => ({ ...s, promoType: v as typeof s.promoType, event: -1, sel: -1 }))}
          disabled={allowedTypes.length === 1}
          disabledReason={offReason(tab, 'promoType')}
        />
        <Select
          className="w-event"
          label="Promo Event"
          value={String(state.event)}
          options={[{ value: '-1', label: `All events (${eventOptions.length})` }, ...eventOptions.map((e) => ({ value: String(e), label: eventLabel(EVENTS[e]) }))]}
          onChange={(v) => update((s) => ({ ...s, event: Number(v), sel: Number(v) }))}
          disabledReason={offReason(tab, 'event')}
        />
        <Select
          className="w-type"
          label="Ad Type / Vehicle"
          value={state.adType}
          options={[{ value: 'all', label: 'All ad types' }, ...AD_TYPES.map((a) => ({ value: a.id, label: a.label }))]}
          onChange={(v) => update((s) => ({ ...s, adType: v as typeof s.adType, sel: -1 }))}
          disabledReason={offReason(tab, 'adType')}
        />
        <Select
          className="w-type"
          label="Promo Depth Band"
          value={state.depthBand}
          options={[{ value: 'all', label: 'All depths' }, ...DEPTH_BANDS.map((d) => ({ value: d.id, label: d.label }))]}
          onChange={(v) => update((s) => ({ ...s, depthBand: v as typeof s.depthBand, sel: -1 }))}
          disabledReason={offReason(tab, 'depthBand')}
        />
        <Select
          className="w-type"
          label="Funding Type"
          value={state.funding}
          options={[{ value: 'all', label: 'All funding types' }, ...FUNDING_TYPES.map((f) => ({ value: f.id, label: f.label }))]}
          onChange={(v) => update((s) => ({ ...s, funding: v as typeof s.funding, sel: -1 }))}
          disabledReason={offReason(tab, 'funding')}
        />
        <Select
          className="w-region"
          label="Region"
          value={String(state.region)}
          options={[{ value: '0', label: 'All regions' }, ...REGIONS.map((r) => ({ value: String(r), label: `Region ${r}` }))]}
          onChange={(v) => update(actions.region(Number(v)))}
          disabledReason={offReason(tab, 'location')}
        />
        <StorePopover region={state.region} districts={state.districts} stores={state.stores} onChange={(d, s) => update(actions.places(d, s))} disabledReason={offReason(tab, 'location')} />
      </div>
    </section>
  );
}
