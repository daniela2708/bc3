/**
 * Colour bands for Sales Lift % and Unit Lift % in Promo Run Trend, ILLUSTRATIVE (requested in the prototype review).
 * Change the thresholds here. The value is always shown; the band adds a colour and a text label, never colour alone.
 */
export const LIFT_THRESHOLDS = {
  /** At or above: green. */
  good: 0.3,
  /** At or above (and below `good`): amber. Below: red. */
  watch: 0.1,
};

export const THRESHOLD_CHIP = 'Illustrative thresholds';

export type LiftBand = 'good' | 'watch' | 'low';

export const LIFT_BAND_LABEL: Record<LiftBand, string> = { good: 'High', watch: 'Medium', low: 'Low' };

/** The band of a lift value; null when there is no value. */
export function liftBand(v: number | null | undefined, t = LIFT_THRESHOLDS): LiftBand | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v >= t.good) return 'good';
  if (v >= t.watch) return 'watch';
  return 'low';
}

/** Text of the legend's (i): what the bands mean, with the thresholds above. */
export function liftBandsInfo(t = LIFT_THRESHOLDS): string {
  const p = (v: number) => `${Math.round(v * 100)} %`;
  return `Colour of Sales Lift % and Unit Lift % in each run: ${LIFT_BAND_LABEL.good} (green) at ${p(t.good)} or more, ${LIFT_BAND_LABEL.watch} (amber) from ${p(t.watch)} to under ${p(t.good)}, ${LIFT_BAND_LABEL.low} (red) under ${p(t.watch)}. The value is always shown next to the colour. Illustrative thresholds, to be defined by the business.`;
}

/** Legend lines, e.g. "High ≥ 30 %". */
export function liftLegend(t = LIFT_THRESHOLDS): { band: LiftBand; text: string }[] {
  const p = (v: number) => `${Math.round(v * 100)} %`;
  return [
    { band: 'good', text: `${LIFT_BAND_LABEL.good} ≥ ${p(t.good)}` },
    { band: 'watch', text: `${LIFT_BAND_LABEL.watch} ${p(t.watch)}–${p(t.good)}` },
    { band: 'low', text: `${LIFT_BAND_LABEL.low} < ${p(t.watch)}` },
  ];
}
