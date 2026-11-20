/**
 * Hot Buy Score, ILLUSTRATIVE (requested in the prototype review): how a 0–100 score per Hot Buy could look before
 * the business defines the real method. Criteria, weights and the normalization live only in this file, so the real
 * method (John Evans) replaces this config without touching the views. No scoring method file exists in the repo yet
 * (docs/hot_buy_scoring.*), so the example criteria from the review are used. Pure: no data imports (the KPI
 * definitions read this file); hotBuyScore.ts scores the events.
 */
import type { Metrics } from './metrics';

export const SCORE_CHIP = 'Illustrative scoring · method to be defined with the business';

export type CriterionId = 'unitLift' | 'netIncGm' | 'catImpact' | 'cannRate' | 'newToCat';

export interface ScoreInput {
  unitLift: number | null;
  /** Net Incremental Gross Margin $, with vendor funding (Net Gross Margin, as the business asked). */
  netIncGm: number | null;
  /** Category Incremental Sales $ (positive = accretive to the category). */
  catImpact: number | null;
  cannRate: number | null;
  newToCat: number | null;
}

export interface Criterion {
  id: CriterionId;
  label: string;
  /** Share of the score, in percent. The weights add up to 100. */
  weight: number;
  /** Whether a higher value scores more points. */
  better: 'higher' | 'lower';
  description: string;
}

/** Example criteria and weights from the prototype review. Change them here when the real method arrives. */
export const SCORE_CRITERIA: Criterion[] = [
  { id: 'unitLift', label: 'Unit Lift %', weight: 25, better: 'higher', description: 'Incremental Units ÷ Baseline Units. Higher is better.' },
  { id: 'netIncGm', label: 'Net Incremental Gross Margin $', weight: 30, better: 'higher', description: 'Incremental GM $ + Cannibalized GM $ + vendor funding (Net Gross Margin). Higher is better.' },
  { id: 'catImpact', label: 'Category impact', weight: 20, better: 'higher', description: 'Category Incremental Sales $: positive means the Hot Buy was accretive to the category. Higher is better.' },
  { id: 'cannRate', label: 'Cannibalization Rate %', weight: 15, better: 'lower', description: 'Units lost by other items of the group ÷ incremental units. Lower is better.' },
  { id: 'newToCat', label: 'New-to-Category Buyers %', weight: 10, better: 'higher', description: 'Share of club card promo buyers with no category purchase in the 52-week look-back. Higher is better.' },
];

/** Points a criterion gets when the event has no value for it: the middle of the range, neither rewarded nor penalized. */
export const NEUTRAL_SHARE = 0.5;

export const SCORE_METHOD =
  'Illustrative score from 0 to 100. Each criterion is ranked against the other Hot Buys in the current selection (same period and filters) as a percentile: the best value gets the criterion’s full weight, the worst gets 0 and ties share the same rank (for Cannibalization Rate %, lower ranks higher). The score is the sum of the weighted points. A criterion with no value for an event (e.g. no cannibalization measure) gets half its weight. With a single Hot Buy every criterion gets half its weight.';

export interface ScorePart {
  id: CriterionId;
  label: string;
  weight: number;
  value: number | null;
  /** Percentile rank in [0, 1] after applying the direction (1 = best). */
  rank: number;
  points: number;
}

export interface ScoreResult {
  score: number;
  parts: ScorePart[];
}

/**
 * Midrank percentile of each value among the non-null values, in [0, 1]: (values below + (ties − 1) ÷ 2) ÷ (n − 1).
 * Null values and a single value give null (the caller uses the neutral share).
 */
export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const n = present.length;
  return values.map((v) => {
    if (v === null || !Number.isFinite(v) || n < 2) return null;
    let below = 0;
    let equal = 0;
    for (const p of present) {
      if (p < v) below++;
      else if (p === v) equal++;
    }
    return (below + (equal - 1) / 2) / (n - 1);
  });
}

/** Scores a set of peer events (the Hot Buys of the same selection). Output order follows the input. */
export function scoreEvents(inputs: ScoreInput[], criteria: Criterion[] = SCORE_CRITERIA): ScoreResult[] {
  const ranks = new Map(criteria.map((c) => [c.id, percentileRanks(inputs.map((i) => i[c.id]))]));
  return inputs.map((input, k) => {
    const parts = criteria.map((c) => {
      const r = ranks.get(c.id)![k];
      const rank = r === null ? NEUTRAL_SHARE : c.better === 'higher' ? r : 1 - r;
      return { id: c.id, label: c.label, weight: c.weight, value: input[c.id], rank, points: rank * c.weight };
    });
    return { score: parts.reduce((s, p) => s + p.points, 0), parts };
  });
}

/** The score inputs of one event, from its metrics and its club card aggregates. */
export function scoreInputOf(m: Pick<Metrics, 'unitLift' | 'netIncGm' | 'catIncSales' | 'cannRate'>, newToCat: number | null): ScoreInput {
  return { unitLift: m.unitLift.ea ?? m.unitLift.lb, netIncGm: m.netIncGm, catImpact: m.catIncSales, cannRate: m.cannRate.ea ?? m.cannRate.lb, newToCat };
}

/** The criteria and weights as one line, for the KPI definitions and the README. */
export function criteriaText(criteria: Criterion[] = SCORE_CRITERIA): string {
  return criteria.map((c) => `${c.label} ${c.weight} % (${c.description})`).join('; ');
}
