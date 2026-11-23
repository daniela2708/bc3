/**
 * Hot Buy Score: the Weis Markets Hot Buy Scoring Framework (business method). Seven lift metrics, each scored 0–100
 * points, weighted into one 0–100 score with a verdict. Metrics, point rules, both weight sets and the verdict cut-offs
 * live only in this file. Pure: no data imports (the KPI definitions and the README read this file); hotBuyScore.ts
 * measures the events.
 *
 * Every metric is a lift: the promo week vs. the 4 weeks before (the method's fixed pre-period), as a fraction
 * (+41 % = 0.41). New-to-Category is a share of promo buyers.
 */

export const SCORE_CHIP = 'Scoring method: Weis Hot Buy Scoring Framework · weights pending (#19)';

/** The method's own pre-period, independent of the Baseline window setting. */
export const SCORE_WINDOW_WEEKS = 4;

export type WeightSet = 'current' | 'proposed';
export const WEIGHT_SETS: { id: WeightSet; label: string; note: string }[] = [
  { id: 'current', label: 'Current', note: 'the weights in use today' },
  { id: 'proposed', label: 'Proposed', note: 'proposal pending approval (#19)' },
];
export const DEFAULT_WEIGHTS: WeightSet = 'current';

export type MetricId = 'salesLift' | 'unitLift' | 'basketLift' | 'catSalesLift' | 'catTripLift' | 'newToCat' | 'catUnitsLift';
/** How a metric earns its points: scaled to the discount (sales, units) or directional. */
export type PointRule = 'sales' | 'units' | 'directional';

export interface ScoreMetric {
  id: MetricId;
  label: string;
  rule: PointRule;
  /** Share of the score, in percent, per weight set. Each set adds up to 100. */
  weights: Record<WeightSet, number>;
  /** What is measured. */
  measure: string;
}

export const SCORE_METRICS: ScoreMetric[] = [
  { id: 'salesLift', label: 'Sales Lift', rule: 'sales', weights: { current: 35, proposed: 46.5 }, measure: 'Sales of the promoted items' },
  { id: 'unitLift', label: 'Unit Lift', rule: 'units', weights: { current: 25, proposed: 31 }, measure: 'Units of the promoted items' },
  { id: 'basketLift', label: 'Basket Lift', rule: 'directional', weights: { current: 15, proposed: 10 }, measure: 'Baskets that include the promoted items' },
  { id: 'catSalesLift', label: 'Cat. Sales Lift', rule: 'directional', weights: { current: 5, proposed: 2.5 }, measure: 'Sales of the category' },
  { id: 'catTripLift', label: 'Cat. Trip Lift', rule: 'directional', weights: { current: 8, proposed: 4 }, measure: 'Category trips' },
  { id: 'newToCat', label: 'New-to-Category', rule: 'directional', weights: { current: 7, proposed: 3.5 }, measure: 'Share of promo buyers who did not buy the category in the 4 weeks before' },
  { id: 'catUnitsLift', label: 'Cat. Units', rule: 'directional', weights: { current: 5, proposed: 2.5 }, measure: 'Units of the category' },
];

/** How each rule scores, for the KPI definitions dialog and the README. */
export const RULE_TEXT: Record<PointRule, string> = {
  sales: 'Scaled to the discount d: floor F = d ÷ (1 − d). Lift ≥ 2F: 100 points; F ≤ lift < 2F: 60 + 40 × (lift − F) ÷ F; below F: lift ÷ F × 60 (at least 0).',
  units: 'Scaled to the discount d: minimum M = 2 × d. Lift ≥ 3M: 100 points; M ≤ lift < 3M: 60 + 40 × (lift − M) ÷ (2M); below M: lift ÷ M × 60 (at least 0).',
  directional: 'Directional: positive = 100 points; zero or negative = 0 points.',
};

export type VerdictId = 'reexecute' | 'refine' | 'reconsider';
export interface Verdict {
  id: VerdictId;
  label: string;
  /** Short word for counts, e.g. "8 Re-execute". */
  short: string;
  /** Lowest score with this verdict. */
  min: number;
  range: string;
}
/** Highest first: the first verdict whose minimum the score reaches. */
export const VERDICTS: Verdict[] = [
  { id: 'reexecute', label: 'RE-EXECUTE', short: 'Re-execute', min: 85, range: '85 or more' },
  { id: 'refine', label: 'REFINE TACTIC', short: 'Refine', min: 70, range: '70 to 84' },
  { id: 'reconsider', label: 'RECONSIDER SLOT', short: 'Reconsider', min: Number.NEGATIVE_INFINITY, range: 'below 70' },
];

export function verdictOf(score: number): Verdict {
  return VERDICTS.find((v) => score >= v.min)!;
}

export const SCORE_WINDOW_NOTE = "The score uses the method's fixed 4-week pre-period; the Baseline window setting does not change it.";
export const SCORE_MARGIN_NOTE = 'Margin is not part of the current scoring method; whether to add it is open (#19).';
export const SCORE_METHOD = `Weis Hot Buy Scoring Framework: seven lift metrics (promo week vs. the 4 weeks before), each scored 0–100 points and weighted into a 0–100 score, rounded. Sales Lift and Unit Lift are scaled to the discount; the other five are directional. Verdict: ${VERDICTS.map((v) => `${v.label} ${v.range}`).join(', ')}. Hot Buys only; whether it applies to price locks is pending (#19). Sales at Net Customer Sales. ${SCORE_WINDOW_NOTE} ${SCORE_MARGIN_NOTE}`;

const valid = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);
/** A usable discount: more than 0 and less than 100 %. */
const validDepth = (d: number | null | undefined): d is number => valid(d) && d > 0 && d < 1;

/** Sales Lift points, scaled to the discount. 0 with no lift or no usable discount. */
export function salesPoints(lift: number | null, d: number | null): number {
  if (!valid(lift) || !validDepth(d)) return 0;
  const f = d / (1 - d);
  if (lift >= 2 * f) return 100;
  if (lift >= f) return 60 + (40 * (lift - f)) / f;
  return Math.max(0, (lift / f) * 60);
}

/** Unit Lift points, scaled to the discount. 0 with no lift or no usable discount. */
export function unitPoints(lift: number | null, d: number | null): number {
  if (!valid(lift) || !validDepth(d)) return 0;
  const m = 2 * d;
  if (lift >= 3 * m) return 100;
  if (lift >= m) return 60 + (40 * (lift - m)) / (2 * m);
  return Math.max(0, (lift / m) * 60);
}

/** Directional points: positive = 100, zero, negative or missing = 0. */
export function directionalPoints(v: number | null): number {
  return valid(v) && v > 0 ? 100 : 0;
}

export type ScoreInput = Record<MetricId, number | null> & {
  /** Promo depth of the event (fraction). */
  depth: number | null;
};

export interface ScorePart {
  id: MetricId;
  label: string;
  value: number | null;
  /** 0–100 points of the metric. */
  points: number;
  /** Weight in percent (active set). */
  weight: number;
  /** points × weight ÷ 100: what the metric adds to the score. */
  contribution: number;
  /** Why the metric scored 0 when it is not the value itself (no data, no discount). */
  note?: string;
}

export interface ScoreResult {
  /** 0–100, rounded. */
  score: number;
  /** Unrounded sum of the contributions. */
  raw: number;
  verdict: Verdict;
  weights: WeightSet;
  depth: number | null;
  parts: ScorePart[];
  /** Net Incremental Gross Margin $ shown next to the score (view settings); not part of the method. */
  netIncGm?: number | null;
}

/** Thresholds of the scaled rules for a depth, e.g. for the breakdown ("floor 42.9 %"). */
export function scaledThresholds(d: number | null): { floor: number; min: number } | null {
  return validDepth(d) ? { floor: d / (1 - d), min: 2 * d } : null;
}

/** Scores one Hot Buy with one weight set. */
export function scoreEvent(input: ScoreInput, weights: WeightSet = DEFAULT_WEIGHTS, metrics: ScoreMetric[] = SCORE_METRICS): ScoreResult {
  const parts = metrics.map((m): ScorePart => {
    const value = input[m.id];
    const points = m.rule === 'sales' ? salesPoints(value, input.depth) : m.rule === 'units' ? unitPoints(value, input.depth) : directionalPoints(value);
    const weight = m.weights[weights];
    let note: string | undefined;
    if (!valid(value)) note = 'No data: 0 points.';
    else if (m.rule !== 'directional' && !validDepth(input.depth)) note = 'No discount on this event: scaled metrics score 0 points.';
    return { id: m.id, label: m.label, value: valid(value) ? value : null, points, weight, contribution: (points * weight) / 100, note };
  });
  const raw = parts.reduce((s, p) => s + p.contribution, 0);
  const score = Math.round(raw);
  return { score, raw, verdict: verdictOf(score), weights, depth: input.depth, parts };
}

/** Number of events per verdict, highest verdict first. */
export function verdictCounts(results: ScoreResult[]): { verdict: Verdict; n: number }[] {
  return VERDICTS.map((v) => ({ verdict: v, n: results.filter((r) => r.verdict.id === v.id).length }));
}

/** "8 Re-execute · 5 Refine · 2 Reconsider". */
export function verdictCountText(results: ScoreResult[]): string {
  return verdictCounts(results)
    .map((c) => `${c.n} ${c.verdict.short}`)
    .join(' · ');
}

/** The metrics and weights as one line, for the KPI definitions and the README. */
export function methodText(metrics: ScoreMetric[] = SCORE_METRICS): string {
  return metrics.map((m) => `${m.label} (${m.measure.toLowerCase()}) ${m.weights.current} % current / ${m.weights.proposed} % proposed, ${m.rule === 'directional' ? 'directional' : 'scaled to the discount'}`).join('; ');
}
