/**
 * Promo hygiene in Promo History, with the thresholds of the Promo Hygiene Review (calibrated). Every threshold lives
 * only in this file. Not part of the Hot Buy Score. Pure: callers pass the events of the price group (EVENTS_BY_PG) and
 * a function that returns an event's Unit Lift %, so the KPI definitions can read this file without the data.
 *
 * - Check A, discount floor: the event's depth is below the calibrated minimum for its promo type.
 * - Check C, frequency: promoted often (the window is not yet calibrated).
 * - Check D, efficiency: extra units per discount point, against a watch and a flag threshold per promo type.
 *
 * "Possible promo fatigue" = promoted often AND efficiency in flag; promoted often with efficiency in watch shows "Watch".
 */
import type { PromoEvent, PromoType } from '../data/promos';

/** Check C: frequency. The fatigue window is not yet calibrated. */
export const FATIGUE = {
  /** Look-back of "Promos in last 52 weeks". */
  lookbackWeeks: 52,
  /** Promoted often when this event and the ones of the same price group that started in the window before it reach minEvents… */
  windowWeeks: 13,
  minEvents: 4,
  /** …or when fewer than this many days passed since the previous promo ended. */
  minDaysBetween: 28,
};

export interface EfficiencyThreshold {
  /** Watch below this many extra units (%) per discount point. */
  watch: number;
  /** Flag below this. */
  flag: number;
  /** True when the type has no calibrated value of its own and uses the TPR values. */
  assumed?: boolean;
}

/** Check D thresholds per promo type. BOGO and Other temporary price reductions use the TPR values (assumption). */
export const EFFICIENCY: Record<PromoType, EfficiencyThreshold> = {
  HB: { watch: 3.1, flag: 1.8 },
  PL: { watch: 2.0, flag: 1.1 },
  TPR: { watch: 2.2, flag: 1.1 },
  BOGO: { watch: 2.2, flag: 1.1, assumed: true },
  OTH: { watch: 2.2, flag: 1.1, assumed: true },
};

/** Check A: minimum promo depth per promo type (fraction). */
export const DEPTH_FLOOR: Record<PromoType, number> = { HB: 0.15, PL: 0.1, TPR: 0.1, BOGO: 0.1, OTH: 0.1 };

/** Promo type names, kept here so this file needs no data import. */
const TYPE_NAME: Record<PromoType, string> = { HB: 'Hot Buys', PL: 'Price Locks', TPR: 'TPRs', BOGO: 'BOGOs', OTH: 'other temporary price reductions' };

const pctText = (v: number) => `${Math.round(v * 100)} %`;
const effText = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export const FATIGUE_LABEL = 'Possible promo fatigue';
export const WATCH_LABEL = 'Watch';
export const FLOOR_LABEL = 'Below floor';
export const FATIGUE_CHIP = 'Promo Hygiene Review thresholds';
export const FATIGUE_INFO = 'Thresholds from the Promo Hygiene Review (calibrated). The fatigue window is not yet calibrated. Not part of the Hot Buy Score.';
export const FREQUENCY_RULE = `Promoted often (check C; fatigue window not yet calibrated): ${FATIGUE.minEvents} or more events of the same price group within ${FATIGUE.windowWeeks} weeks (this event and the ones that started in the ${FATIGUE.windowWeeks} weeks before it), or fewer than ${FATIGUE.minDaysBetween} days since the previous promo ended.`;
export const EFFICIENCY_RULE = `Efficiency (check D): extra units per discount point = Unit Lift % ÷ Promo Depth % (e.g. +93 % units at 30 % off = 3.1). Watch / flag below: ${(['HB', 'PL', 'TPR'] as PromoType[]).map((t) => `${TYPE_NAME[t]} ${EFFICIENCY[t].watch} / ${EFFICIENCY[t].flag}`).join(', ')}; BOGOs and other temporary price reductions use the TPR values (assumption).`;
export const FATIGUE_RULE = `${FATIGUE_LABEL} when the item is promoted often and its efficiency is in flag; "${WATCH_LABEL}" when it is promoted often and its efficiency is in watch. ${FREQUENCY_RULE} ${EFFICIENCY_RULE}`;
export const FLOOR_RULE = `Discount below floor (check A): Promo Depth % below ${pctText(DEPTH_FLOOR.HB)} for Hot Buys and ${pctText(DEPTH_FLOOR.TPR)} for every other promo type.`;

type Ev = Pick<PromoEvent, 'idx' | 'pg' | 'type' | 'start' | 'end' | 'depth'>;

/** Events of the same price group (any promo type) that started in the `weeks` weeks before this event's start. */
export function promosBefore(e: Pick<Ev, 'idx' | 'pg' | 'start'>, weeks: number, list: Pick<Ev, 'idx' | 'pg' | 'start'>[]): number {
  const from = e.start - weeks * 7;
  return list.filter((o) => o.idx !== e.idx && o.pg === e.pg && o.start >= from && o.start < e.start).length;
}

/** "Promos in last 52 weeks": events of the same price group in the 52 weeks before the event starts. */
export function promosInLast52Weeks(e: Pick<Ev, 'idx' | 'pg' | 'start'>, list: Pick<Ev, 'idx' | 'pg' | 'start'>[]): number {
  return promosBefore(e, FATIGUE.lookbackWeeks, list);
}

/**
 * "Days since previous promo": days from the end of the latest earlier promo of the same price group to this start
 * (0 when they overlap); null when there is no earlier promo in the data.
 */
export function daysSincePreviousPromo(e: Pick<Ev, 'idx' | 'pg' | 'start'>, list: Pick<Ev, 'idx' | 'pg' | 'start' | 'end'>[]): number | null {
  const prev = list.filter((o) => o.idx !== e.idx && o.pg === e.pg && o.start < e.start);
  if (prev.length === 0) return null;
  const lastEnd = Math.max(...prev.map((o) => o.end));
  return Math.max(0, e.start - lastEnd);
}

/**
 * Check D: extra units (%) per discount point = Unit Lift % ÷ Promo Depth % (both fractions give the same ratio).
 * Null with no lift or no usable discount.
 */
export function efficiency(unitLift: number | null, depth: number | null): number | null {
  if (unitLift === null || depth === null || !Number.isFinite(unitLift) || !Number.isFinite(depth) || depth <= 0) return null;
  return unitLift / depth;
}

export type EfficiencyBand = 'flag' | 'watch' | 'ok';

/** The band of an efficiency for a promo type; null with no efficiency. */
export function efficiencyBand(type: PromoType, eff: number | null): EfficiencyBand | null {
  if (eff === null) return null;
  const t = EFFICIENCY[type];
  if (eff < t.flag) return 'flag';
  if (eff < t.watch) return 'watch';
  return 'ok';
}

/** Check A: the event's depth is below the calibrated minimum for its promo type. */
export function belowFloor(e: Pick<Ev, 'type' | 'depth'>): boolean {
  return Number.isFinite(e.depth) && e.depth < DEPTH_FLOOR[e.type];
}

export function floorText(e: Pick<Ev, 'type' | 'depth'>): string {
  return `Promo Depth ${pctText(e.depth)} is below the ${pctText(DEPTH_FLOOR[e.type])} floor for ${TYPE_NAME[e.type]}.`;
}

export interface FatigueCheck {
  /** Events in the window, this one included. */
  inWindow: number;
  daysSince: number | null;
  /** Frequency rules met. */
  byCount: boolean;
  byGap: boolean;
  frequent: boolean;
  unitLift: number | null;
  efficiency: number | null;
  band: EfficiencyBand | null;
  /** What the column shows: the flag, "Watch" or nothing. */
  status: 'fatigue' | 'watch' | null;
}

/** Applies checks C and D to one event. `liftOf` returns an event's Unit Lift % (same baseline and sales basis as the view). */
export function fatigueCheck<T extends Ev>(e: T, list: T[], liftOf: (ev: T) => number | null): FatigueCheck {
  const inWindow = promosBefore(e, FATIGUE.windowWeeks, list) + 1;
  const daysSince = daysSincePreviousPromo(e, list);
  const byCount = inWindow >= FATIGUE.minEvents;
  const byGap = daysSince !== null && daysSince < FATIGUE.minDaysBetween;
  const frequent = byCount || byGap;
  const unitLift = liftOf(e);
  const eff = efficiency(unitLift, e.depth);
  const band = efficiencyBand(e.type, eff);
  const status = !frequent ? null : band === 'flag' ? 'fatigue' : band === 'watch' ? 'watch' : null;
  return { inWindow, daysSince, byCount, byGap, frequent, unitLift, efficiency: eff, band, status };
}

/** The rules an event met, with its values, for the tooltip. Lists only the rules that were met. */
export function fatigueReasons(c: FatigueCheck, type: PromoType): string[] {
  const out: string[] = [];
  if (c.byCount) out.push(`Promoted often: ${c.inWindow} events in ${FATIGUE.windowWeeks} weeks (rule: ${FATIGUE.minEvents} or more; window not yet calibrated).`);
  if (c.byGap) out.push(`Promoted often: ${c.daysSince} days since the previous promo (rule: under ${FATIGUE.minDaysBetween}; window not yet calibrated).`);
  if (c.efficiency !== null && (c.band === 'flag' || c.band === 'watch')) {
    const t = EFFICIENCY[type];
    const limit = c.band === 'flag' ? `flag below ${t.flag}` : `watch below ${t.watch}`;
    out.push(`${c.band === 'flag' ? 'Low efficiency' : 'Efficiency to watch'}: ${effText(c.efficiency)} extra units (%) per discount point (${TYPE_NAME[type]}: ${limit}${t.assumed ? ', TPR values assumed' : ''}).`);
  }
  return out;
}
