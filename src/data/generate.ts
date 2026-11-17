/**
 * Seeded data generator (same approach as UC2): chain-level item × day "cubes", built once, plus store share
 * weights by department for the Region / District / Store filters. Store values are the chain value × the store's
 * share, so store rows never hold their own item rows.
 *
 * Cubes are stored as prefix sums (Float64Array, NI × (ND + 1)), so any item × date-range total is O(1):
 *   units  units (ea) or pounds (lb) sold
 *   gross  Gross Sales $ (shelf price paid, before discounts)
 *   net    Net Customer Sales $ (after coupons and other discounts)
 *   cost   cost of goods sold $
 *   invest markdown $ given up on promo days: (regular retail − promo retail) × units
 */
import { AS_OF_DAY, DAY_COUNT, fiscalOfDay, holidayWeeks, monthOfDay, weekday, weekOfDay, type HolidayId } from './calendar';
import { hash01, hashNormal } from './prng';
import { CATS, DEPTS, inSeason, ITEMS, PRICE_GROUPS, SUBS } from './products';
import { EVENTS } from './promos';
import { STORES } from './stores';

export const ND = DAY_COUNT;
export const NI = ITEMS.length;
const W = ND + 1;

/** Share of weekly volume by weekday, Sunday first. */
const DOW = [0.16, 0.12, 0.115, 0.125, 0.14, 0.16, 0.18];
/** Price level by fiscal year (current retail = FY2026). */
const PRICE_LEVEL: Record<number, number> = { 2024: 0.94, 2025: 0.97, 2026: 1 };
const BASE_DISCOUNT = 0.018;
const PROMO_DISCOUNT = 0.03;

const HOLIDAY_LIFT: Record<string, Partial<Record<HolidayId, number>>> = {
  Grocery: { valentines: 1.08, memorial: 1.1, july4: 1.15, laborday: 1.1, thanksgiving: 1.2, christmas: 1.15 },
  Dairy: { easter: 1.05, thanksgiving: 1.15, christmas: 1.15 },
  Frozen: { memorial: 1.06, july4: 1.12 },
  HBC: { christmas: 1.05 },
  GM: { thanksgiving: 1.06, christmas: 1.08 },
  Meat: { memorial: 1.25, july4: 1.3, laborday: 1.2, thanksgiving: 1.05, christmas: 1.12 },
  Produce: { easter: 1.1, memorial: 1.05, july4: 1.1, thanksgiving: 1.2, christmas: 1.1 },
};
/** Monthly seasonality by category (Jan … Dec). Categories not listed are flat. */
const MONTHLY: Record<string, number[]> = {
  'Ice Cream': [0.75, 0.75, 0.85, 0.95, 1.1, 1.3, 1.35, 1.3, 1.05, 0.9, 0.85, 0.85],
  Beverages: [0.9, 0.9, 0.95, 1, 1.05, 1.15, 1.2, 1.15, 1.0, 0.95, 0.9, 0.95],
  Fruit: [0.85, 0.85, 0.9, 1, 1.1, 1.2, 1.2, 1.15, 1.05, 1, 0.9, 0.85],
  Beef: [0.9, 0.9, 0.95, 1, 1.1, 1.15, 1.15, 1.1, 1.0, 0.95, 0.9, 0.95],
  'Cold Cereal': [1.1, 1.05, 1, 1, 0.95, 0.95, 0.95, 1.05, 1.05, 1, 0.95, 0.95],
};

export interface Model {
  units: Float64Array;
  gross: Float64Array;
  net: Float64Array;
  cost: Float64Array;
  invest: Float64Array;
}

/** Items of each category. */
export const CAT_ITEMS: number[][] = CATS.map((c) => ITEMS.filter((x) => x.cat === c.idx).map((x) => x.idx));

function build(): Model {
  const dUnits = new Float64Array(NI * ND);
  const dGross = new Float64Array(NI * ND);
  const dNet = new Float64Array(NI * ND);
  const dCost = new Float64Array(NI * ND);
  const dInvest = new Float64Array(NI * ND);
  const mult = new Float64Array(NI * ND).fill(1);
  const depth = new Float64Array(NI * ND);

  const holidayFactor = DEPTS.map((d) => {
    const f = new Float64Array(ND + 14).fill(1);
    for (const [id, lift] of Object.entries(HOLIDAY_LIFT[d.name] ?? {})) {
      for (const w of holidayWeeks(id as HolidayId)) for (let k = 0; k < 7; k++) if (w * 7 + k >= 0 && w * 7 + k < f.length) f[w * 7 + k] *= lift as number;
    }
    return f;
  });

  // Promo effects: lift on the promoted price group, cannibalization or halo on the rest of the category, and the
  // post-promo dip (pantry loading) in the ad week after the event.
  for (const e of EVENTS) {
    const pg = PRICE_GROUPS[e.pg];
    const members = new Set(pg.items);
    for (let day = e.start; day <= Math.min(e.end, ND - 1); day++) {
      const m = monthOfDay(day);
      for (const i of pg.items) {
        const it = ITEMS[i];
        const w = it.season && inSeason(it, m) ? 1.45 : 1;
        mult[i * ND + day] *= 1 + e.lift * w * (0.85 + 0.3 * hash01(i, e.idx, 5));
        depth[i * ND + day] = e.depth;
      }
      for (const j of CAT_ITEMS[pg.cat]) {
        if (members.has(j) || ITEMS[j].uom !== pg.uom) continue;
        const it = ITEMS[j];
        let c = it.sub === pg.sub ? e.cannSub : e.cannOther;
        if (it.brand === pg.brand) c += e.cannBrand;
        mult[j * ND + day] *= Math.max(0.2, 1 - c);
      }
    }
    for (let day = e.end + 1; day <= Math.min(e.end + 7, ND - 1); day++) for (const i of pg.items) mult[i * ND + day] *= 1 - e.dip;
  }

  for (const it of ITEMS) {
    const monthly = MONTHLY[CATS[it.cat].name] ?? MONTHLY[subName(it.sub)];
    for (let day = 0; day < ND; day++) {
      const k = it.idx * ND + day;
      const m = monthOfDay(day);
      if (!inSeason(it, m)) continue;
      const fy = fiscalOfDay(day).fy;
      const trend = 1 + 0.012 * (day / 364);
      const noise = Math.max(0.3, 1 + 0.08 * hashNormal(it.idx, day, 1));
      const units = it.weeklyUnits * DOW[weekday(day)] * trend * (monthly ? monthly[m - 1] : 1) * holidayFactor[it.dept][day] * mult[k] * noise;
      const q = it.uom === 'lb' ? Math.round(units * 10) / 10 : Math.round(units);
      const reg = it.retail * PRICE_LEVEL[fy];
      const price = reg * (1 - depth[k]);
      const unitCost = it.cost * PRICE_LEVEL[fy] * (1 + 0.01 * hashNormal(it.idx, weekOfDay(day), 2));
      dUnits[k] = q;
      dGross[k] = q * price;
      dNet[k] = q * price * (1 - (depth[k] > 0 ? PROMO_DISCOUNT : BASE_DISCOUNT));
      dCost[k] = q * unitCost;
      dInvest[k] = q * (reg - price);
    }
  }

  const prefix = (src: Float64Array) => {
    const out = new Float64Array(NI * W);
    for (let i = 0; i < NI; i++) {
      let acc = 0;
      for (let d = 0; d < ND; d++) {
        out[i * W + d] = acc;
        acc += src[i * ND + d];
      }
      out[i * W + ND] = acc;
    }
    return out;
  };
  return { units: prefix(dUnits), gross: prefix(dGross), net: prefix(dNet), cost: prefix(dCost), invest: prefix(dInvest) };
}

function subName(sub: number): string {
  return SUBS[sub].name;
}

let model: Model | null = null;
export function getModel(): Model {
  if (!model) model = build();
  return model;
}

/** Sum of one cube for an item over days [from, to] (inclusive), clipped to the data horizon. 0 for an empty range. */
export function rangeSum(cube: Float64Array, item: number, from: number, to: number): number {
  const a = Math.max(0, from);
  const b = Math.min(AS_OF_DAY, to);
  if (b < a) return 0;
  return cube[item * W + b + 1] - cube[item * W + a];
}

/** Store share of chain volume by department (sums to 1 over all stores). */
export const STORE_SHARE: Float64Array[] = DEPTS.map((d) => {
  const raw = new Float64Array(STORES.length);
  let t = 0;
  for (const s of STORES) {
    raw[s.idx] = s.size * (0.85 + 0.3 * hash01(s.id, d.idx, 21));
    t += raw[s.idx];
  }
  for (let i = 0; i < raw.length; i++) raw[i] /= t;
  return raw;
});
