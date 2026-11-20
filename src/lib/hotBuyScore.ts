/** Hot Buy Score of the events of a selection (illustrative; criteria and method in scoring.ts). */
import { EVENTS } from '../data/promos';
import { derive, eventAgg, type Basis, type EventCtx } from './metrics';
import { scoreEvents, scoreInputOf, type ScoreResult } from './scoring';
import { deriveShopper, eventShopper } from './shopper';

/** Scores of the Hot Buys among `events` (other promo types are skipped), keyed by event index. */
export function hotBuyScores(events: number[], ctx: EventCtx, basis: Basis): Map<number, ScoreResult> {
  const hb = events.filter((e) => EVENTS[e].type === 'HB');
  const inputs = hb.map((e) => scoreInputOf(derive(eventAgg(EVENTS[e], ctx), basis), deriveShopper(eventShopper(EVENTS[e], ctx)).newToCat));
  const results = scoreEvents(inputs);
  return new Map(hb.map((e, i) => [e, results[i]]));
}

/** Average score of a set of events (null when none is scored). */
export function averageScore(scores: Map<number, ScoreResult>, events: number[] = [...scores.keys()]): number | null {
  const list = events.map((e) => scores.get(e)?.score).filter((s): s is number => s !== undefined);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

