/**
 * Promo fatigue in Promo History, ILLUSTRATIVE (requested in the prototype review). "Possible promo fatigue" combines
 * two ideas: the item is promoted often (frequency) AND its response is low or falling (Julian's proposal: lift below a
 * threshold). Every threshold lives only in FATIGUE below; they are examples to align with the Cognira promo fatigue and
 * intensity calculations, and the flag is not part of the Hot Buy Score. Pure: callers pass the events of the price
 * group (EVENTS_BY_PG) and a function that returns an event's Unit Lift %, so the KPI definitions can read this file
 * without the data.
 */
import type { PromoEvent } from '../data/promos';

export const FATIGUE = {
  /** Look-back of "Promos in last 52 weeks". */
  lookbackWeeks: 52,
  /** Frequency: promoted often when this event and the ones of the same price group that started in the window before it reach minEvents… */
  windowWeeks: 13,
  minEvents: 4,
  /** …or when fewer than this many days passed since the previous promo ended. */
  minDaysBetween: 28,
  /** Response: low when the event's Unit Lift % is below this… */
  minUnitLift: 0.1,
  /** …or falling when Unit Lift % dropped by this share or more vs. the previous run of the same price group and promo type. */
  minLiftDrop: 0.3,
};

const pctText = (v: number) => `${Math.round(v * 100)} %`;

export const FATIGUE_LABEL = 'Possible promo fatigue';
export const FATIGUE_CHIP = 'Definition pending · thresholds to align with Cognira promo fatigue and intensity';
export const FATIGUE_INFO =
  'Illustrative: flags items promoted often whose lift is low or falling. Cognira has promo fatigue and intensity calculations; thresholds to be aligned. Not part of the Hot Buy Score.';
export const FATIGUE_RULE = `${FATIGUE_LABEL} when both apply. Promoted often: ${FATIGUE.minEvents} or more events of the same price group within ${FATIGUE.windowWeeks} weeks (this event and the ones that started in the ${FATIGUE.windowWeeks} weeks before it), or fewer than ${FATIGUE.minDaysBetween} days since the previous promo ended. Lift low or falling: Unit Lift % of the event below ${pctText(FATIGUE.minUnitLift)}, or down ${pctText(FATIGUE.minLiftDrop)} or more vs. the previous run of the same price group and promo type.`;

type Ev = Pick<PromoEvent, 'idx' | 'pg' | 'type' | 'start' | 'end'>;

/** Events of the same price group (any promo type) that started in the `weeks` weeks before this event's start. */
export function promosBefore(e: Ev, weeks: number, list: Ev[]): number {
  const from = e.start - weeks * 7;
  return list.filter((o) => o.idx !== e.idx && o.pg === e.pg && o.start >= from && o.start < e.start).length;
}

/** "Promos in last 52 weeks": events of the same price group in the 52 weeks before the event starts. */
export function promosInLast52Weeks(e: Ev, list: Ev[]): number {
  return promosBefore(e, FATIGUE.lookbackWeeks, list);
}

/**
 * "Days since previous promo": days from the end of the latest earlier promo of the same price group to this start
 * (0 when they overlap); null when there is no earlier promo in the data.
 */
export function daysSincePreviousPromo(e: Ev, list: Ev[]): number | null {
  const prev = list.filter((o) => o.idx !== e.idx && o.pg === e.pg && o.start < e.start);
  if (prev.length === 0) return null;
  const lastEnd = Math.max(...prev.map((o) => o.end));
  return Math.max(0, e.start - lastEnd);
}

/** The previous run: the latest earlier event of the same price group AND promo type; null when there is none. */
export function previousRun<T extends Ev>(e: T, list: T[]): T | null {
  let best: T | null = null;
  for (const o of list) if (o.idx !== e.idx && o.pg === e.pg && o.type === e.type && o.start < e.start && (!best || o.start > best.start)) best = o;
  return best;
}

/**
 * Relative drop in Unit Lift % vs. the previous run: (previous − current) / previous. Positive = falling. Null when a
 * lift is missing or the previous lift is not above 0 (a relative drop has no meaning then).
 */
export function liftDrop(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return (previous - current) / previous;
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
  previous: { start: number; unitLift: number | null } | null;
  drop: number | null;
  /** Response rules met. */
  lowLift: boolean;
  falling: boolean;
  weakResponse: boolean;
  /** Possible promo fatigue: frequent AND weak response. */
  flagged: boolean;
}

/** Applies both rules to one event. `liftOf` returns an event's Unit Lift % (same baseline and sales basis as the view). */
export function fatigueCheck<T extends Ev>(e: T, list: T[], liftOf: (ev: T) => number | null): FatigueCheck {
  const inWindow = promosBefore(e, FATIGUE.windowWeeks, list) + 1;
  const daysSince = daysSincePreviousPromo(e, list);
  const byCount = inWindow >= FATIGUE.minEvents;
  const byGap = daysSince !== null && daysSince < FATIGUE.minDaysBetween;
  const unitLift = liftOf(e);
  const prev = previousRun(e, list);
  const prevLift = prev ? liftOf(prev) : null;
  const drop = liftDrop(unitLift, prevLift);
  const lowLift = unitLift !== null && Number.isFinite(unitLift) && unitLift < FATIGUE.minUnitLift;
  const falling = drop !== null && drop >= FATIGUE.minLiftDrop;
  const frequent = byCount || byGap;
  const weakResponse = lowLift || falling;
  return {
    inWindow,
    daysSince,
    byCount,
    byGap,
    frequent,
    unitLift,
    previous: prev ? { start: prev.start, unitLift: prevLift } : null,
    drop,
    lowLift,
    falling,
    weakResponse,
    flagged: frequent && weakResponse,
  };
}

/** The rules an event met, with its values, for the flag's tooltip. `day` formats a day index (the previous run's start). */
export function fatigueReasons(c: FatigueCheck, day: (d: number) => string): string[] {
  const out: string[] = [];
  if (c.byCount) out.push(`Promoted often: ${c.inWindow} events in ${FATIGUE.windowWeeks} weeks (rule: ${FATIGUE.minEvents} or more).`);
  if (c.byGap) out.push(`Promoted often: ${c.daysSince} days since the previous promo (rule: under ${FATIGUE.minDaysBetween}).`);
  if (c.lowLift && c.unitLift !== null) out.push(`Low lift: Unit Lift % ${pctText(c.unitLift)} (rule: under ${pctText(FATIGUE.minUnitLift)}).`);
  if (c.falling && c.drop !== null && c.previous && c.previous.unitLift !== null && c.unitLift !== null)
    out.push(
      `Falling lift: Unit Lift % ${pctText(c.unitLift)} vs. ${pctText(c.previous.unitLift)} in the previous run (${day(c.previous.start)}), down ${pctText(c.drop)} (rule: ${pctText(FATIGUE.minLiftDrop)} or more).`,
    );
  return out;
}
