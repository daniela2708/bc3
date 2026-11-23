/**
 * Hot Buy Score of the events of a selection: measures the seven lifts of the Weis Hot Buy Scoring Framework and
 * scores them with scoring.ts. The measures always use the method's fixed 4-week pre-period, Net Customer Sales and
 * the default cannibalization level, so a Hot Buy has the same score in every view whatever the calculation settings.
 */
import { EVENTS, type PromoEvent } from '../data/promos';
import { categoryLifts, DEFAULT_BASIS, DEFAULT_CANN_LEVEL, derive, eventAgg, type Basis, type EventCtx } from './metrics';
import { DEFAULT_WEIGHTS, SCORE_WINDOW_WEEKS, scoreEvent, type ScoreInput, type ScoreResult, type WeightSet } from './scoring';
import { deriveShopper, eventShopper } from './shopper';

/** The context of the method: the filters of the selection with the fixed 4-week pre-period. */
export function scoreCtx(ctx: EventCtx): EventCtx {
  return { ...ctx, baselineWeeks: SCORE_WINDOW_WEEKS, level: DEFAULT_CANN_LEVEL };
}

/** The seven measures of one event, as fractions. */
export function scoreInputOf(e: PromoEvent, ctx: EventCtx): ScoreInput {
  const c = scoreCtx(ctx);
  const m = derive(eventAgg(e, c), DEFAULT_BASIS);
  const sh = deriveShopper(eventShopper(e, c));
  const cat = categoryLifts(e, c, DEFAULT_BASIS);
  return {
    salesLift: m.salesLift,
    unitLift: m.unitLift.ea ?? m.unitLift.lb,
    basketLift: sh.txnsChange,
    catSalesLift: cat.sales,
    catTripLift: sh.catTripsChange,
    newToCat: sh.newToCat4w,
    catUnitsLift: cat.units,
    depth: e.depth,
  };
}

/**
 * Scores of the Hot Buys among `events` (other promo types are skipped), keyed by event index. `basis` only sets the
 * Net Incremental Gross Margin $ shown next to the score (with the view's settings); it never changes the score.
 */
export function hotBuyScores(events: number[], ctx: EventCtx, weights: WeightSet = DEFAULT_WEIGHTS, basis: Basis = DEFAULT_BASIS): Map<number, ScoreResult> {
  const out = new Map<number, ScoreResult>();
  for (const e of events) {
    const ev = EVENTS[e];
    if (ev.type !== 'HB') continue;
    out.set(e, { ...scoreEvent(scoreInputOf(ev, ctx), weights), netIncGm: derive(eventAgg(ev, ctx), basis).netIncGm });
  }
  return out;
}

/** Average score of a set of events (null when none is scored). */
export function averageScore(scores: Map<number, ScoreResult>, events: number[] = [...scores.keys()]): number | null {
  const list = events.map((e) => scores.get(e)?.score).filter((s): s is number => s !== undefined);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

/** The scored results of a set of events. */
export function resultsOf(scores: Map<number, ScoreResult>, events: number[] = [...scores.keys()]): ScoreResult[] {
  return events.map((e) => scores.get(e)).filter((s): s is ScoreResult => s !== undefined);
}
