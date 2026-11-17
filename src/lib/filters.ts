/**
 * Filter state, URL (de)serialisation, time resolution and which filters each view uses. Pure functions only;
 * the React store lives in filterStore.tsx. Adapted from UC2 (same time modes) plus the ad week and promo filters.
 */
import {
  AS_OF_DAY,
  CURRENT_WEEK,
  adWeekEnd,
  adWeekLabel,
  adWeekOfDay,
  dayFromISO,
  FISCAL_YEARS,
  fiscalOfDay,
  formatDay,
  HOLIDAYS,
  holidayAvailable,
  holidaySpanFY,
  isoFromDay,
  LAST_COMPLETE_AD_WEEK,
  LAST_COMPLETE_WEEK,
  LY_OFFSET_DAYS,
  periodSpan,
  quarterSpan,
  snapToSunday,
  snapToThursday,
  adWeekStart,
  weekEndDay,
  weekStartDay,
  yearSpan,
  type HolidayId,
} from '../data/calendar';
import { BRANDS, CATS, DEPTS, ITEMS, PRICE_GROUPS, SUBS, VENDORS } from '../data/products';
import { AD_TYPES, DEPTH_BANDS, FUNDING_TYPES, PROMO_TYPES, type AdType, type DepthBand, type FundingType, type PromoType } from '../data/promos';
import { DISTRICTS, STORE_BY_ID, STORES } from '../data/stores';
import { BASELINE_WEEKS, DEFAULT_BASELINE_WEEKS, type BaselineWeeks } from './kpis';
import { DEFAULT_BASIS, type Basis, type CannLevel } from './metrics';

// ---------------------------------------------------------------- Views

export type TabId = 'hotbuy' | 'other' | 'trend' | 'funding' | 'history' | 'shopper';
/** The six views, in the order of the requirements (Must Have first). */
export const TABS: { id: TabId; label: string }[] = [
  { id: 'hotbuy', label: 'Hot Buy Performance' },
  { id: 'other', label: 'Other Promo Performance' },
  { id: 'trend', label: 'Promo Run Trend' },
  { id: 'funding', label: 'Promo Funding' },
  { id: 'history', label: 'Promo History' },
  { id: 'shopper', label: 'Promo Shopper Impact' },
];

export type FilterKey =
  | 'dept'
  | 'cat'
  | 'sub'
  | 'pg'
  | 'item'
  | 'vb'
  | 'promoType'
  | 'event'
  | 'adType'
  | 'depthBand'
  | 'funding'
  | 'holiday'
  | 'location';

/** Filters listed in the requirements workbook for each view. Anything else is greyed out there. */
const VIEW_FILTERS: Record<TabId, FilterKey[]> = {
  hotbuy: ['dept', 'cat', 'sub', 'pg', 'item', 'vb', 'promoType', 'event', 'location'],
  other: ['dept', 'cat', 'sub', 'pg', 'item', 'vb', 'promoType', 'event'],
  trend: ['dept', 'cat', 'sub', 'pg', 'item', 'vb', 'promoType', 'event'],
  funding: ['dept', 'cat', 'item', 'vb', 'promoType', 'event', 'funding'],
  history: ['dept', 'cat', 'sub', 'pg', 'item', 'vb', 'promoType', 'adType', 'depthBand', 'holiday'],
  shopper: ['dept', 'cat', 'sub', 'pg', 'item', 'promoType', 'event'],
};
export const NOT_IN_VIEW = 'Not a filter for this view in the requirements workbook.';

export function usesFilter(tab: TabId, key: FilterKey): boolean {
  return VIEW_FILTERS[tab].includes(key);
}
export function offReason(tab: TabId, key: FilterKey): string | undefined {
  return usesFilter(tab, key) ? undefined : NOT_IN_VIEW;
}

// ---------------------------------------------------------------- Time

export type TimeMode = 'todate' | 'rolling' | 'fiscal' | 'custom' | 'all';
export type ToDateOpt = 'day' | 'wtd' | 'ptd' | 'qtd' | 'ytd';
export type RollingOpt = 6 | 13 | 26 | 52;
export type FiscalGrain = 'year' | 'quarter' | 'period' | 'adweek' | 'week' | 'holiday';

export interface TimeSel {
  mode: TimeMode;
  toDate: ToDateOpt;
  rolling: RollingOpt;
  grain: FiscalGrain;
  fy: number;
  quarter: number;
  period: number;
  /** Thursday that starts the chosen ad week. */
  adWeek: number;
  /** Sunday that starts the chosen fiscal week (Week Beginning). */
  weekStart: number;
  holiday: HolidayId;
  from: number;
  to: number;
}

export const TO_DATE_LABEL: Record<ToDateOpt, string> = {
  day: 'Current Day',
  wtd: 'Week-to-Date',
  ptd: 'Period-to-Date',
  qtd: 'Quarter-to-Date',
  ytd: 'Year-to-Date',
};
export const ROLLING_OPTS: RollingOpt[] = [6, 13, 26, 52];
export const GRAIN_LABEL: Record<FiscalGrain, string> = {
  year: 'Year',
  quarter: 'Quarter',
  period: 'Period',
  adweek: 'Ad week',
  week: 'Week beginning',
  holiday: 'Holiday period',
};

const LAST_FY = FISCAL_YEARS[FISCAL_YEARS.length - 1];

export const BASE_TIME: TimeSel = {
  mode: 'rolling',
  toDate: 'ytd',
  rolling: 13,
  grain: 'period',
  fy: LAST_FY,
  quarter: fiscalOfDay(AS_OF_DAY).quarter,
  period: fiscalOfDay(AS_OF_DAY).period,
  adWeek: adWeekStart(LAST_COMPLETE_AD_WEEK),
  weekStart: weekStartDay(LAST_COMPLETE_WEEK),
  holiday: 'july4',
  from: adWeekStart(LAST_COMPLETE_AD_WEEK - 12),
  to: AS_OF_DAY,
};

export function tabDefaultTime(tab: TabId): TimeSel {
  switch (tab) {
    case 'trend':
    case 'history':
      // Run comparisons and promo history use all available promo history.
      return { ...BASE_TIME, mode: 'all' };
    case 'funding':
      return { ...BASE_TIME, mode: 'todate', toDate: 'ytd' };
    default:
      return { ...BASE_TIME };
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
export function clampDay(day: number): number {
  return Math.round(clamp(day, 0, AS_OF_DAY));
}

export interface ResolvedRange {
  start: number;
  end: number;
  label: string;
  name: string;
  lyStart: number;
  lyEnd: number;
}

function spanDays(startWeek: number, endWeek: number): [number, number] {
  return [weekStartDay(startWeek), Math.min(weekEndDay(endWeek), AS_OF_DAY)];
}

/** Events are included when they START inside the resolved range (metrics then use every day of the event). */
export function resolveTime(t: TimeSel, tab?: TabId): ResolvedRange {
  let start: number;
  let end: number;
  let name: string;
  const asOf = fiscalOfDay(AS_OF_DAY);
  switch (t.mode) {
    case 'all':
      start = 0;
      end = AS_OF_DAY;
      name = 'All promo history';
      break;
    case 'todate': {
      end = AS_OF_DAY;
      name = TO_DATE_LABEL[t.toDate];
      if (t.toDate === 'day') start = AS_OF_DAY;
      else if (t.toDate === 'wtd') start = weekStartDay(CURRENT_WEEK);
      else if (t.toDate === 'ptd') start = weekStartDay(periodSpan(asOf.fy, asOf.period).startWeek);
      else if (t.toDate === 'qtd') start = weekStartDay(quarterSpan(asOf.fy, asOf.quarter).startWeek);
      else start = weekStartDay(yearSpan(asOf.fy).startWeek);
      break;
    }
    case 'rolling': {
      // Rolling spans count complete ad weeks back from the last complete ad week.
      start = adWeekStart(LAST_COMPLETE_AD_WEEK - t.rolling + 1);
      end = adWeekEnd(LAST_COMPLETE_AD_WEEK);
      name = `Rolling ${t.rolling} weeks`;
      break;
    }
    case 'fiscal': {
      const fy = clamp(Math.round(t.fy), FISCAL_YEARS[0], LAST_FY);
      const grain = t.grain === 'holiday' && tab && !usesFilter(tab, 'holiday') ? 'period' : t.grain;
      if (grain === 'year') {
        const sp = yearSpan(fy);
        [start, end] = spanDays(sp.startWeek, sp.endWeek);
        name = `FY${fy}`;
      } else if (grain === 'quarter') {
        const q = clamp(Math.round(t.quarter), 1, 4);
        const sp = quarterSpan(fy, q);
        [start, end] = spanDays(sp.startWeek, sp.endWeek);
        name = `Q${q} FY${fy}`;
      } else if (grain === 'period') {
        const p = clamp(Math.round(t.period), 1, 12);
        const sp = periodSpan(fy, p);
        [start, end] = spanDays(sp.startWeek, sp.endWeek);
        name = `P${p} FY${fy}`;
      } else if (grain === 'adweek') {
        const a = adWeekOfDay(snapToThursday(clampDay(t.adWeek)));
        start = adWeekStart(a);
        end = Math.min(adWeekEnd(a), AS_OF_DAY);
        name = `Ad week ${adWeekLabel(a)}`;
      } else if (grain === 'week') {
        start = snapToSunday(clampDay(t.weekStart));
        end = Math.min(start + 6, AS_OF_DAY);
        const f = fiscalOfDay(start);
        name = `FY${f.fy} W${f.week}`;
      } else {
        const sp = holidaySpanFY(t.holiday, fy);
        const label = HOLIDAYS.find((h) => h.id === t.holiday)?.label ?? 'Holiday';
        if (sp && holidayAvailable(t.holiday, fy)) [start, end] = spanDays(sp.startWeek, sp.endWeek);
        else [start, end] = [AS_OF_DAY, AS_OF_DAY];
        name = `${label} FY${fy}`;
      }
      if (start > AS_OF_DAY) [start, end] = [AS_OF_DAY, AS_OF_DAY];
      break;
    }
    case 'custom': {
      let a = clampDay(t.from);
      let b = clampDay(t.to);
      if (a > b) [a, b] = [b, a];
      start = a;
      end = b;
      name = 'Custom range';
      break;
    }
  }
  return {
    start,
    end,
    name,
    label: start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`,
    lyStart: start - LY_OFFSET_DAYS,
    lyEnd: end - LY_OFFSET_DAYS,
  };
}

export function fiscalOptionAvailable(grain: 'quarter' | 'period', fy: number, n: number): boolean {
  return (grain === 'quarter' ? quarterSpan(fy, n) : periodSpan(fy, n)).startWeek <= CURRENT_WEEK;
}

// ---------------------------------------------------------------- State

export type Rollup = 'event' | 'sub' | 'cat' | 'dept';
export type PromoTypeFilter = 'all' | PromoType;

export interface FilterState {
  tab: TabId;
  /** null = the view's default period (user has not touched the time filter). */
  time: TimeSel | null;
  dept: number;
  cat: number;
  sub: number;
  pg: number;
  /** Items from a pasted UPC / PLU list (kept out of the URL). */
  codes: number[];
  item: number;
  /** Vendor / Brand: '' (all), 'v:<idx>' or 'b:<idx>'. */
  vb: string;
  promoType: PromoTypeFilter;
  event: number;
  adType: 'all' | AdType;
  depthBand: 'all' | DepthBand;
  funding: 'all' | FundingType;
  region: number;
  districts: string[];
  stores: number[];
  baseline: BaselineWeeks;
  level: CannLevel;
  basis: Basis;
  rollup: Rollup;
  /** Event picked in a table for the charts (-1 = the view's default). */
  sel: number;
  cols: Record<string, string[]>;
}

export const DEFAULT_STATE: FilterState = {
  tab: 'hotbuy',
  time: null,
  dept: -1,
  cat: -1,
  sub: -1,
  pg: -1,
  codes: [],
  item: -1,
  vb: '',
  promoType: 'all',
  event: -1,
  adType: 'all',
  depthBand: 'all',
  funding: 'all',
  region: 0,
  districts: [],
  stores: [],
  baseline: DEFAULT_BASELINE_WEEKS,
  level: 'category',
  basis: DEFAULT_BASIS,
  rollup: 'event',
  sel: -1,
  cols: {},
};

export function effectiveTime(s: FilterState): TimeSel {
  const t = s.time ?? tabDefaultTime(s.tab);
  if (t.mode === 'fiscal' && t.grain === 'holiday' && !usesFilter(s.tab, 'holiday')) return { ...t, grain: 'period' };
  return t;
}

/** Promo types a view can show: Hot Buy only on Hot Buy Performance, every other type on Other Promo Performance. */
export function promoTypesFor(tab: TabId): PromoType[] {
  if (tab === 'hotbuy') return ['HB'];
  if (tab === 'other') return ['TPR', 'BOGO', 'PL', 'OTH'];
  return PROMO_TYPES.map((t) => t.id);
}

export function categoriesOf(dept: number) {
  return dept < 0 ? CATS : CATS.filter((c) => c.dept === dept);
}
export function subcategoriesOf(cat: number) {
  return cat < 0 ? [] : SUBS.filter((s) => s.cat === cat);
}
export function districtsOf(region: number) {
  return region > 0 ? DISTRICTS.filter((d) => d.region === region) : DISTRICTS;
}

// ---------------------------------------------------------------- Input hygiene

export const SEARCH_MAX = 40;
export function sanitizeSearch(raw: string): string {
  return raw
    .slice(0, SEARCH_MAX * 2)
    .replace(/[^\p{L}\p{N} .&'/%-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, SEARCH_MAX);
}

/** SKU search by SKU Number, UPC / PLU or name. */
export function searchItems(raw: string, limit = 8): number[] {
  const q = sanitizeSearch(raw).trim().toLowerCase();
  if (q.length < 2) return [];
  const digits = /^\d+$/.test(q);
  const scored: [number, number][] = [];
  for (const it of ITEMS) {
    let score = -1;
    if (digits) {
      const codes = [it.sku, it.upc ?? '', it.plu ?? ''];
      if (codes.includes(q)) score = 0;
      else if (codes.some((c) => c.startsWith(q))) score = 1;
      else if (codes.some((c) => c.includes(q))) score = 2;
    } else {
      const n = it.name.toLowerCase();
      if (n.startsWith(q)) score = 0;
      else if (n.includes(` ${q}`)) score = 1;
      else if (n.includes(q)) score = 2;
    }
    if (score >= 0) scored.push([score, it.idx]);
  }
  scored.sort((a, b) => a[0] - b[0] || ITEMS[a[1]].name.localeCompare(ITEMS[b[1]].name));
  return scored.slice(0, limit).map((x) => x[1]);
}

// ---------------------------------------------------------------- URL sync

const TAB_IDS = TABS.map((t) => t.id);
const MODES: TimeMode[] = ['todate', 'rolling', 'fiscal', 'custom', 'all'];
const TO_DATES: ToDateOpt[] = ['day', 'wtd', 'ptd', 'qtd', 'ytd'];
const GRAINS: FiscalGrain[] = ['year', 'quarter', 'period', 'adweek', 'week', 'holiday'];
const HOLIDAY_IDS = HOLIDAYS.map((h) => h.id);
const PROMO_IDS: PromoTypeFilter[] = ['all', ...PROMO_TYPES.map((t) => t.id)];
const LEVELS: CannLevel[] = ['brand', 'brandcat', 'category'];
const ROLLUPS: Rollup[] = ['event', 'sub', 'cat', 'dept'];

function oneOf<T extends string | number>(v: string | null, allowed: readonly T[]): T | undefined {
  if (v === null) return undefined;
  return allowed.find((a) => String(a) === v);
}
function intIn(v: string | null, min: number, max: number): number | undefined {
  if (v === null || !/^-?\d{1,7}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}
function dayParam(v: string | null): number | undefined {
  if (v === null || v.length > 10) return undefined;
  const d = dayFromISO(v);
  return d === null ? undefined : clampDay(d);
}

export function toQuery(s: FilterState): string {
  const p = new URLSearchParams();
  p.set('tab', s.tab);
  if (s.time) {
    const t = s.time;
    p.set('tm', t.mode);
    if (t.mode === 'todate') p.set('td', t.toDate);
    if (t.mode === 'rolling') p.set('rw', String(t.rolling));
    if (t.mode === 'fiscal') {
      p.set('fg', t.grain);
      p.set('fy', String(t.fy));
      if (t.grain === 'quarter') p.set('q', String(t.quarter));
      if (t.grain === 'period') p.set('p', String(t.period));
      if (t.grain === 'adweek') p.set('aw', isoFromDay(t.adWeek));
      if (t.grain === 'week') p.set('wk', isoFromDay(t.weekStart));
      if (t.grain === 'holiday') p.set('hol', t.holiday);
    }
    if (t.mode === 'custom') {
      p.set('from', isoFromDay(t.from));
      p.set('to', isoFromDay(t.to));
    }
  }
  if (s.dept >= 0) p.set('dept', String(s.dept));
  if (s.cat >= 0) p.set('cat', String(s.cat));
  if (s.sub >= 0) p.set('sub', String(s.sub));
  if (s.pg >= 0) p.set('pg', String(s.pg));
  if (s.item >= 0) p.set('sku', ITEMS[s.item].sku);
  if (s.vb) p.set('vb', s.vb);
  if (s.promoType !== 'all') p.set('pt', s.promoType);
  if (s.event >= 0) p.set('ev', String(s.event));
  if (s.adType !== 'all') p.set('ad', s.adType);
  if (s.depthBand !== 'all') p.set('db', s.depthBand);
  if (s.funding !== 'all') p.set('fu', s.funding);
  if (s.region > 0) p.set('reg', String(s.region));
  if (s.districts.length) p.set('dist', s.districts.join(','));
  if (s.stores.length) p.set('st', s.stores.join(','));
  if (s.baseline !== DEFAULT_BASELINE_WEEKS) p.set('bw', String(s.baseline));
  if (s.level !== 'category') p.set('lv', s.level);
  if (s.basis !== DEFAULT_BASIS) p.set('sb', s.basis);
  if (s.rollup !== 'event') p.set('ru', s.rollup);
  if (s.sel >= 0) p.set('sel', String(s.sel));
  const cols = Object.entries(s.cols)
    .map(([t, keys]) => `${t}:${keys.join('.')}`)
    .join(';');
  if (cols) p.set('cols', cols);
  return p.toString();
}

/** Parses a query string. Anything invalid, out of range or inconsistent falls back to the default. */
export function fromQuery(query: string, eventCount: number): FilterState {
  const p = new URLSearchParams(query.length > 2000 ? '' : query);
  const s: FilterState = structuredClone(DEFAULT_STATE);
  s.tab = oneOf(p.get('tab'), TAB_IDS) ?? s.tab;
  const mode = oneOf(p.get('tm'), MODES);
  if (mode) {
    const t: TimeSel = { ...tabDefaultTime(s.tab), mode };
    t.toDate = oneOf(p.get('td'), TO_DATES) ?? t.toDate;
    const rw = oneOf(p.get('rw'), ROLLING_OPTS.map(String));
    if (rw) t.rolling = Number(rw) as RollingOpt;
    t.grain = oneOf(p.get('fg'), GRAINS) ?? t.grain;
    t.fy = intIn(p.get('fy'), FISCAL_YEARS[0], LAST_FY) ?? t.fy;
    t.quarter = intIn(p.get('q'), 1, 4) ?? t.quarter;
    t.period = intIn(p.get('p'), 1, 12) ?? t.period;
    const aw = dayParam(p.get('aw'));
    if (aw !== undefined) t.adWeek = snapToThursday(aw);
    const wk = dayParam(p.get('wk'));
    if (wk !== undefined) t.weekStart = snapToSunday(wk);
    t.holiday = oneOf(p.get('hol'), HOLIDAY_IDS) ?? t.holiday;
    t.from = dayParam(p.get('from')) ?? t.from;
    t.to = dayParam(p.get('to')) ?? t.to;
    s.time = t;
  }
  s.dept = intIn(p.get('dept'), 0, DEPTS.length - 1) ?? -1;
  const cat = intIn(p.get('cat'), 0, CATS.length - 1);
  if (cat !== undefined && (s.dept < 0 || CATS[cat].dept === s.dept)) {
    s.cat = cat;
    s.dept = CATS[cat].dept;
  }
  const sub = intIn(p.get('sub'), 0, SUBS.length - 1);
  if (sub !== undefined && s.cat >= 0 && SUBS[sub].cat === s.cat) s.sub = sub;
  s.pg = intIn(p.get('pg'), 0, PRICE_GROUPS.length - 1) ?? -1;
  const sku = p.get('sku');
  if (sku && /^\d{6}$/.test(sku)) s.item = ITEMS.find((x) => x.sku === sku)?.idx ?? -1;
  const vb = p.get('vb');
  if (vb && /^[vb]:\d{1,3}$/.test(vb)) {
    const n = Number(vb.slice(2));
    if ((vb[0] === 'v' && n < VENDORS.length) || (vb[0] === 'b' && n < BRANDS.length)) s.vb = vb;
  }
  s.promoType = oneOf(p.get('pt'), PROMO_IDS) ?? 'all';
  s.event = intIn(p.get('ev'), 0, eventCount - 1) ?? -1;
  s.adType = oneOf(p.get('ad'), AD_TYPES.map((a) => a.id)) ?? 'all';
  s.depthBand = oneOf(p.get('db'), DEPTH_BANDS.map((d) => d.id)) ?? 'all';
  s.funding = oneOf(p.get('fu'), FUNDING_TYPES.map((f) => f.id)) ?? 'all';
  s.region = intIn(p.get('reg'), 1, 3) ?? 0;
  const dist = (p.get('dist') ?? '').split(',').filter((d) => DISTRICTS.some((x) => x.id === d && (s.region === 0 || x.region === s.region)));
  s.districts = [...new Set(dist)].slice(0, DISTRICTS.length);
  const stores = (p.get('st') ?? '')
    .split(',')
    .filter((x) => /^\d{1,3}$/.test(x))
    .map(Number)
    .filter((id) => STORE_BY_ID.has(id));
  s.stores = [...new Set(stores)].slice(0, STORES.length);
  const bw = intIn(p.get('bw'), 1, 52);
  s.baseline = (BASELINE_WEEKS as readonly number[]).includes(bw ?? -1) ? (bw as BaselineWeeks) : DEFAULT_BASELINE_WEEKS;
  s.level = oneOf(p.get('lv'), LEVELS) ?? 'category';
  s.basis = p.get('sb') === 'gross' ? 'gross' : DEFAULT_BASIS;
  s.rollup = oneOf(p.get('ru'), ROLLUPS) ?? 'event';
  s.sel = intIn(p.get('sel'), 0, eventCount - 1) ?? -1;
  const colsRaw = p.get('cols');
  if (colsRaw && colsRaw.length <= 1000) {
    for (const part of colsRaw.split(';').slice(0, 10)) {
      const [t, keys] = part.split(':');
      if (!t || !/^[a-z]{1,12}$/.test(t) || keys === undefined) continue;
      s.cols[t] = keys
        .split('.')
        .filter((k) => /^[A-Za-z0-9]{1,16}$/.test(k))
        .slice(0, 60);
    }
  }
  return s;
}
