/**
 * Promo event master: one row per promotion run of a price group. Built once, deterministically, from the seed.
 * Durations (approved): Hot Buy = one ad week; TPR 1–8 ad weeks; Price Lock 4–13 ad weeks; BOGO and Other 1–2.
 * Every event starts on a Thursday and ends on a Wednesday, and ends on or before the last complete ad week.
 */
import { adWeekEnd, adWeekLabel, adWeekOfDay, adWeekStart, dayFromYMD, fiscalOfDay, LAST_COMPLETE_AD_WEEK, monthOfDay } from './calendar';
import { hash01, mulberry32, nameKey, SEED } from './prng';
import { CATS, DEPTS, inSeason, ITEMS, pgByName, PRICE_GROUPS, VENDORS, type PriceGroup } from './products';

export type PromoType = 'HB' | 'TPR' | 'BOGO' | 'PL' | 'OTH';
export const PROMO_TYPES: { id: PromoType; label: string; short: string }[] = [
  { id: 'HB', label: 'Hot Buy', short: 'Hot Buy' },
  { id: 'TPR', label: 'TPR (temporary price reduction)', short: 'TPR' },
  { id: 'BOGO', label: 'BOGO', short: 'BOGO' },
  { id: 'PL', label: 'Price Lock', short: 'Price Lock' },
  { id: 'OTH', label: 'Other temporary price reduction', short: 'Other' },
];
export const PROMO_LABEL: Record<PromoType, string> = Object.fromEntries(PROMO_TYPES.map((t) => [t.id, t.short])) as Record<PromoType, string>;

export type AdType = 'front' | 'inside' | 'digital' | 'display' | 'none';
export const AD_TYPES: { id: AdType; label: string }[] = [
  { id: 'front', label: 'Front page' },
  { id: 'inside', label: 'Inside page' },
  { id: 'digital', label: 'Digital' },
  { id: 'display', label: 'Display' },
  { id: 'none', label: 'No ad' },
];
export const AD_LABEL: Record<AdType, string> = Object.fromEntries(AD_TYPES.map((t) => [t.id, t.label])) as Record<AdType, string>;

export type DepthBand = 'd0' | 'd15' | 'd25' | 'd35' | 'd50';
export const DEPTH_BANDS: { id: DepthBand; label: string; min: number }[] = [
  { id: 'd0', label: 'Under 15 %', min: 0 },
  { id: 'd15', label: '15–25 %', min: 0.15 },
  { id: 'd25', label: '25–35 %', min: 0.25 },
  { id: 'd35', label: '35–50 %', min: 0.35 },
  { id: 'd50', label: '50 % and over', min: 0.5 },
];
export function depthBandOf(depth: number): DepthBand {
  let band: DepthBand = 'd0';
  for (const b of DEPTH_BANDS) if (depth >= b.min - 1e-9) band = b.id;
  return band;
}

export type FundingType = 'scan' | 'bill' | 'other';
export const FUNDING_TYPES: { id: FundingType; label: string }[] = [
  { id: 'scan', label: 'Scan-down' },
  { id: 'bill', label: 'Bill-back' },
  { id: 'other', label: 'Other promo allowance' },
];

export interface PromoEvent {
  idx: number;
  id: string;
  pg: number;
  type: PromoType;
  /** First day (Thursday) and last day (Wednesday), inclusive. */
  start: number;
  end: number;
  adWeeks: number;
  /** (Regular retail − Promo retail) ÷ Regular retail. BOGO = 50 % effective. */
  depth: number;
  adType: AdType;
  /** Generator inputs (not shown): unit lift on the promoted items, cannibalization and post-promo dip. */
  lift: number;
  cannSub: number;
  cannOther: number;
  cannBrand: number;
  dip: number;
  /** Share of Promo Investment paid by the vendor, split by funding type. */
  fundingRate: number;
  fundingMix: Partial<Record<FundingType, number>>;
  /** Item weights inside the price group during this event (seasonal items weigh more in season). */
  planted?: string;
}

const TYPE_CODE: Record<PromoType, string> = { HB: 'HB', TPR: 'TPR', BOGO: 'BOGO', PL: 'PL', OTH: 'OTH' };
const AD_LIFT: Record<AdType, number> = { front: 1.25, inside: 1, digital: 0.9, display: 1.1, none: 0.7 };
/** Perishables and impulse items pantry-load less than shelf-stable stock-up items. */
const STOCK_UP_CATS = new Set(['Paper Products', 'Household Cleaning', 'Beverages', 'Pasta & Sauce', 'Oral Care', 'Pain Relief']);

const FIRST_AD_WEEK = 8;

interface Draft {
  pg: number;
  type: PromoType;
  startAw: number;
  weeks: number;
  depth?: number;
  adType?: AdType;
  lift?: number;
  cannSub?: number;
  cannOther?: number;
  cannBrand?: number;
  dip?: number;
  fundingRate?: number;
  fundingMix?: Partial<Record<FundingType, number>>;
  planted?: string;
}

const aw = (y: number, m: number, d: number) => adWeekOfDay(dayFromYMD(y, m, d));

/** Planted demo stories (numbers in the app always come from the generated data, not from these inputs). */
function plantedDrafts(): Draft[] {
  const out: Draft[] = [];
  const cheerios = pgByName('Cheerios Family Size').idx;
  const runs: [number, number, number, number][] = [
    [2024, 2, 15, 2.0],
    [2024, 5, 16, 1.95],
    [2024, 8, 15, 1.9],
    [2025, 2, 13, 1.75],
    [2025, 5, 15, 1.6],
    [2025, 8, 14, 1.45],
    [2026, 2, 12, 1.2],
    [2026, 5, 14, 0.95],
    [2026, 8, 13, 0.7],
  ];
  for (const [y, m, d, lift] of runs)
    out.push({ pg: cheerios, type: 'HB', startAw: aw(y, m, d), weeks: 1, depth: 0.3, adType: 'front', lift, cannSub: 0.12, cannOther: 0.01, cannBrand: 0.02, dip: 0.08, fundingRate: 0.7, fundingMix: { scan: 0.8, bill: 0.2 }, planted: 'cheerios' });

  const coke2l = pgByName('Coca-Cola 2 L').idx;
  for (const [y, m, d] of [
    [2026, 7, 2],
    [2026, 9, 3],
  ])
    out.push({ pg: coke2l, type: 'HB', startAw: aw(y, m, d), weeks: 1, depth: 0.39, adType: 'front', lift: 3.1, cannSub: 0.2, cannOther: 0.02, cannBrand: 0.24, dip: 0.06, fundingRate: 0.5, fundingMix: { scan: 1 }, planted: 'coke2l' });

  out.push({ pg: pgByName('Chobani Greek Yogurt 5.3 oz').idx, type: 'BOGO', startAw: aw(2026, 3, 12), weeks: 2, depth: 0.5, adType: 'inside', lift: 0.55, cannSub: 0.18, cannOther: 0.03, cannBrand: 0, dip: 0.04, fundingRate: 0.2, fundingMix: { bill: 1 }, planted: 'chobani' });

  out.push({ pg: pgByName('Tide Liquid Detergent 92 oz').idx, type: 'HB', startAw: aw(2026, 10, 8), weeks: 1, depth: 0.25, adType: 'front', lift: 1.4, cannSub: 0.16, cannOther: 0.01, cannBrand: 0, dip: 0.15, fundingRate: 1, fundingMix: { scan: 1 }, planted: 'tide' });

  const bounty = pgByName('Bounty Select-A-Size 6 Double Rolls').idx;
  out.push({ pg: bounty, type: 'HB', startAw: aw(2025, 4, 17), weeks: 1, depth: 0.33, adType: 'front', lift: 2.1, cannSub: 0.22, cannOther: 0.04, cannBrand: 0, dip: 0.4, fundingRate: 0.6, fundingMix: { scan: 0.7, other: 0.3 }, planted: 'bounty' });
  out.push({ pg: bounty, type: 'HB', startAw: aw(2026, 4, 16), weeks: 1, depth: 0.33, adType: 'front', lift: 2.2, cannSub: 0.24, cannOther: 0.04, cannBrand: 0, dip: 0.46, fundingRate: 0.6, fundingMix: { scan: 0.7, other: 0.3 }, planted: 'bounty' });

  const mm = pgByName("M&M's Sharing Size").idx;
  for (const [y, m, d] of [
    [2024, 10, 17],
    [2025, 10, 16],
    [2026, 10, 15],
  ])
    out.push({ pg: mm, type: 'HB', startAw: aw(y, m, d), weeks: 1, depth: 0.33, adType: 'front', lift: 1.5, cannSub: 0.1, cannOther: 0, cannBrand: 0, dip: 0.05, fundingRate: 0.7, fundingMix: { scan: 1 }, planted: 'mm' });
  out.push({ pg: mm, type: 'TPR', startAw: aw(2026, 3, 5), weeks: 4, depth: 0.17, adType: 'digital', lift: 0.45, cannSub: 0.06, cannOther: 0, cannBrand: 0, dip: 0.02, fundingRate: 0.6, fundingMix: { scan: 1 }, planted: 'mm' });

  out.push({ pg: pgByName('Clorox Disinfecting Wipes').idx, type: 'HB', startAw: aw(2026, 9, 17), weeks: 1, depth: 0.29, adType: 'front', lift: 1.8, cannSub: 0.2, cannOther: 0.02, cannBrand: 0.22, dip: 0.12, fundingRate: 0.65, fundingMix: { scan: 0.6, bill: 0.4 }, planted: 'clorox' });
  out.push({ pg: pgByName('Clorox Clean-Up').idx, type: 'HB', startAw: aw(2026, 6, 11), weeks: 1, depth: 0.27, adType: 'front', lift: 1.5, cannSub: 0.15, cannOther: 0.02, cannBrand: 0.05, dip: 0.1, fundingRate: 0.6, fundingMix: { scan: 1 }, planted: 'clorox' });

  const beef = pgByName('Ground Beef 80/20 Family Pack').idx;
  for (const [y, m, d] of [
    [2025, 5, 22],
    [2025, 7, 3],
    [2026, 5, 21],
    [2026, 7, 2],
  ])
    out.push({ pg: beef, type: 'HB', startAw: aw(y, m, d), weeks: 1, depth: 0.27, adType: 'front', lift: 1.35, cannSub: 0.14, cannOther: 0.04, cannBrand: 0.05, dip: 0.06, fundingRate: 0.25, fundingMix: { bill: 1 }, planted: 'beef' });

  out.push({ pg: pgByName('Ragú Pasta Sauce 24 oz').idx, type: 'TPR', startAw: aw(2026, 1, 15), weeks: 3, depth: 0.21, adType: 'inside', lift: 0.65, cannSub: 0.12, cannOther: -0.22, cannBrand: 0, dip: 0.05, fundingRate: 0.7, fundingMix: { scan: 0.5, bill: 0.5 }, planted: 'ragu' });

  out.push({ pg: pgByName('Weis Quality Water 24 pk 16.9 oz').idx, type: 'PL', startAw: aw(2026, 3, 12), weeks: 6, depth: 0.1, adType: 'display', lift: 0.22, cannSub: 0.05, cannOther: 0, cannBrand: 0, dip: 0.02, fundingRate: 0, fundingMix: {}, planted: 'water' });
  return out;
}

function pick<T>(r: number, opts: [T, number][]): T {
  let acc = 0;
  for (const [v, w] of opts) {
    acc += w;
    if (r < acc) return v;
  }
  return opts[opts.length - 1][0];
}

function randomDraft(pg: PriceGroup, startAw: number, rnd: () => number): Draft {
  const p = pg.profile;
  const type: PromoType =
    p === 'hot'
      ? pick(rnd(), [['HB', 0.5], ['TPR', 0.25], ['BOGO', 0.1], ['OTH', 0.15]])
      : p === 'std'
        ? pick(rnd(), [['HB', 0.12], ['TPR', 0.5], ['BOGO', 0.15], ['OTH', 0.23]])
        : p === 'lock'
          ? pick(rnd(), [['PL', 0.55], ['TPR', 0.45]])
          : pick(rnd(), [['TPR', 0.8], ['PL', 0.2]]);
  const weeks = type === 'HB' ? 1 : type === 'TPR' ? 1 + Math.floor(rnd() * 8) : type === 'PL' ? 4 + Math.floor(rnd() * 10) : 1 + Math.floor(rnd() * 2);
  return { pg: pg.idx, type, startAw, weeks };
}

function finish(d: Draft, idx: number): PromoEvent {
  const pg = PRICE_GROUPS[d.pg];
  const k = nameKey(`${pg.name}|${d.startAw}|${d.type}`);
  const h = (n: number) => hash01(k, n);
  const own = VENDORS[pg.vendor].startsWith('Weis');
  const depth =
    d.depth ??
    Math.round(
      (d.type === 'HB' ? 0.22 + 0.14 * h(1) : d.type === 'TPR' ? 0.1 + 0.12 * h(1) : d.type === 'BOGO' ? 0.5 : d.type === 'PL' ? 0.08 + 0.07 * h(1) : 0.15 + 0.15 * h(1)) * 100,
    ) / 100;
  const adType: AdType =
    d.adType ??
    (d.type === 'HB'
      ? pick(h(2), [['front', 0.7], ['inside', 0.2], ['digital', 0.1]])
      : d.type === 'TPR'
        ? pick(h(2), [['inside', 0.4], ['digital', 0.3], ['none', 0.3]])
        : d.type === 'BOGO'
          ? pick(h(2), [['front', 0.3], ['inside', 0.5], ['digital', 0.2]])
          : d.type === 'PL'
            ? pick(h(2), [['display', 0.4], ['none', 0.6]])
            : pick(h(2), [['inside', 0.4], ['display', 0.3], ['digital', 0.3]]));
  const baseLift = d.type === 'HB' ? 1.0 + 1.2 * h(3) : d.type === 'TPR' ? 0.25 + 0.45 * h(3) : d.type === 'BOGO' ? 0.7 + 0.7 * h(3) : d.type === 'PL' ? 0.12 + 0.18 * h(3) : 0.35 + 0.45 * h(3);
  const lift = d.lift ?? Math.round(baseLift * AD_LIFT[adType] * (0.75 + depth) * 100) / 100;
  const stock = STOCK_UP_CATS.has(catName(pg));
  const dip = d.dip ?? Math.round((stock ? 0.06 + 0.16 * h(4) : 0.01 + 0.06 * h(4)) * Math.min(1, depth * 3) * 100) / 100;
  const cannSub = d.cannSub ?? Math.round((0.05 + 0.2 * h(5)) * Math.min(1.3, lift / 1.2) * 100) / 100;
  const cannOther = d.cannOther ?? Math.round((0.03 * h(6) - 0.01) * 100) / 100;
  const cannBrand = d.cannBrand ?? Math.round(0.08 * h(7) * 100) / 100;
  let fundingRate = d.fundingRate;
  let fundingMix = d.fundingMix;
  if (fundingRate === undefined) {
    const lo = d.type === 'HB' ? 0.5 : d.type === 'BOGO' ? 0.6 : d.type === 'PL' ? 0 : 0.4;
    const hi = d.type === 'HB' ? 0.95 : d.type === 'BOGO' ? 1 : d.type === 'PL' ? 0.4 : 0.9;
    fundingRate = own ? 0 : Math.round((lo + (hi - lo) * h(8)) * 100) / 100;
    if (pg.dept === deptIdx('Meat') || pg.dept === deptIdx('Produce')) fundingRate = Math.round(fundingRate * 0.4 * 100) / 100;
  }
  if (!fundingMix) {
    const r = h(9);
    fundingMix = fundingRate === 0 ? {} : r < 0.45 ? { scan: 1 } : r < 0.7 ? { scan: 0.6, bill: 0.4 } : r < 0.88 ? { bill: 1 } : { scan: 0.5, other: 0.5 };
  }
  const start = adWeekStart(d.startAw);
  const end = adWeekEnd(d.startAw + d.weeks - 1);
  const f = fiscalOfDay(start);
  return {
    idx,
    id: `${TYPE_CODE[d.type]}-${String(f.fy).slice(2)}${String(f.week).padStart(2, '0')}-${String(d.pg + 1).padStart(3, '0')}`,
    pg: d.pg,
    type: d.type,
    start,
    end,
    adWeeks: d.weeks,
    depth,
    adType,
    lift,
    cannSub,
    cannOther,
    cannBrand,
    dip,
    fundingRate,
    fundingMix,
    planted: d.planted,
  };
}

function catName(pg: PriceGroup): string {
  return CATS[pg.cat].name;
}
function deptIdx(name: string): number {
  return DEPTS.findIndex((d) => d.name === name);
}

/** True when at least one item of the price group sells during the ad week (seasonal-only groups stay quiet off season). */
function sellsIn(pg: PriceGroup, startAw: number): boolean {
  const m = monthOfDay(adWeekStart(startAw) + 3);
  return pg.items.some((i) => inSeason(ITEMS[i], m));
}

type Span = [number, number];
const overlaps = (list: Span[] | undefined, a: number, b: number) => (list ?? []).some(([s, e]) => a <= e && b >= s);
function push(map: Map<number, Span[]>, key: number, span: Span) {
  const list = map.get(key) ?? [];
  list.push(span);
  map.set(key, list);
}

/**
 * Scheduling rules that keep stories readable: one event at a time per subcategory (with a week between), and the
 * category around a planted story stays free of other promos from 4 weeks before (its baseline) to a week after.
 */
function buildEvents(): PromoEvent[] {
  const planted = plantedDrafts();
  const drafts: Draft[] = [...planted];
  const byPg = new Map<number, Span[]>();
  const byCat = new Map<number, Span[]>();
  const bySub = new Map<number, Span[]>();
  for (const d of planted) {
    const pg = PRICE_GROUPS[d.pg];
    const end = d.startAw + d.weeks - 1;
    push(byPg, d.pg, [d.startAw - 5, end + 2]);
    push(byCat, pg.cat, [d.startAw - 4, end + 1]);
    push(bySub, pg.sub, [d.startAw, end + 1]);
  }
  /** Planted Hot Buy stories own their price group's Hot Buys; random Hot Buys there would blur the trend. */
  const noRandomHb = new Set(planted.filter((d) => d.type === 'HB').map((d) => d.pg));
  const rnd = mulberry32(SEED ^ 0x5eed);
  const order = [...PRICE_GROUPS].sort((a, b) => hash01(a.idx, 77) - hash01(b.idx, 77));
  for (const pg of order) {
    const gapLo = pg.profile === 'hot' ? 4 : pg.profile === 'std' ? 6 : pg.profile === 'lock' ? 8 : 14;
    const gapHi = pg.profile === 'hot' ? 9 : pg.profile === 'std' ? 13 : pg.profile === 'lock' ? 16 : 26;
    let a = FIRST_AD_WEEK + Math.floor(rnd() * gapHi);
    while (a <= LAST_COMPLETE_AD_WEEK) {
      const d = randomDraft(pg, a, rnd);
      if (noRandomHb.has(pg.idx) && d.type === 'HB') d.type = 'TPR';
      const endAw = a + d.weeks - 1;
      const clash = overlaps(byPg.get(pg.idx), a, endAw) || overlaps(byCat.get(pg.cat), a, endAw) || overlaps(bySub.get(pg.sub), a, endAw + 1);
      if (endAw <= LAST_COMPLETE_AD_WEEK && !clash && sellsIn(pg, a)) {
        drafts.push(d);
        push(bySub, pg.sub, [a, endAw + 1]);
        a = endAw + 1 + gapLo + Math.floor(rnd() * (gapHi - gapLo + 1));
      } else a += 1;
    }
  }
  drafts.sort((x, y) => x.startAw - y.startAw || x.pg - y.pg);
  const events = drafts.map((d, i) => finish(d, i));
  // Event ids must be unique; two runs of one price group never start in the same fiscal week.
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.id)) e.id = `${e.id}b`;
    seen.add(e.id);
  }
  return events;
}

export const EVENTS: PromoEvent[] = buildEvents();
export const EVENTS_BY_PG: number[][] = PRICE_GROUPS.map(() => []);
for (const e of EVENTS) EVENTS_BY_PG[e.pg].push(e.idx);

export function eventLabel(e: PromoEvent): string {
  return `${e.id} · ${adWeekLabel(adWeekOfDay(e.start))}${e.adWeeks > 1 ? ` + ${e.adWeeks - 1} wk` : ''}`;
}
