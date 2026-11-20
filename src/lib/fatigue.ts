/**
 * Promo fatigue in Promo History, ILLUSTRATIVE (requested in the prototype review): how often the same price group
 * was promoted before each event. The "Promoted often" threshold lives only here; it is to be aligned with the
 * Cognira promo fatigue and intensity calculations and is not part of the Hot Buy Score. Pure: callers pass the
 * events of the price group (EVENTS_BY_PG), so the KPI definitions can read this file without the data.
 */
import type { PromoEvent } from '../data/promos';

export const FATIGUE = {
  /** Look-back of "Promos in last 52 weeks". */
  lookbackWeeks: 52,
  /** "Promoted often" when this event and the ones of the same price group that started in the window before it reach minEvents… */
  windowWeeks: 13,
  minEvents: 4,
  /** …or when fewer than this many days passed since the previous promo ended. */
  minDaysBetween: 28,
};

export const FATIGUE_CHIP = 'Definition pending · threshold to align with Cognira promo fatigue';
export const FATIGUE_INFO = 'Cognira has promo fatigue and intensity calculations; this flag is illustrative and is not part of the Hot Buy Score.';
export const FATIGUE_RULE = `Promoted often: ${FATIGUE.minEvents} or more events of the same price group within ${FATIGUE.windowWeeks} weeks (this event and the ones that started in the ${FATIGUE.windowWeeks} weeks before it), or fewer than ${FATIGUE.minDaysBetween} days since the previous promo ended.`;

type Ev = Pick<PromoEvent, 'idx' | 'pg' | 'start' | 'end'>;

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

/** The "Promoted often" flag with the threshold above. */
export function promotedOften(e: Ev, list: Ev[]): boolean {
  const inWindow = promosBefore(e, FATIGUE.windowWeeks, list) + 1;
  const gap = daysSincePreviousPromo(e, list);
  return inWindow >= FATIGUE.minEvents || (gap !== null && gap < FATIGUE.minDaysBetween);
}
