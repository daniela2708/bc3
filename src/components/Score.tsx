import { pct, pctChange, signedMoney } from '../lib/format';
import { scaledThresholds, SCORE_CHIP, SCORE_METHOD, WEIGHT_SETS, type MetricId, type ScoreResult, type Verdict } from '../lib/scoring';
import { HoverCard } from './HoverCard';
import { CellBar, InfoTip } from './ui';

const VALUE_FMT: Record<MetricId, (v: number | null) => string> = {
  salesLift: pctChange,
  unitLift: pctChange,
  basketLift: pctChange,
  catSalesLift: pctChange,
  catTripLift: pctChange,
  newToCat: (v) => pct(v),
  catUnitsLift: pctChange,
};

const num = (v: number, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
const weightText = (w: number) => `${Number.isInteger(w) ? w : num(w)} %`;
const setLabel = (s: ScoreResult) => WEIGHT_SETS.find((w) => w.id === s.weights)!.label;

/** "Scoring method: Weis Hot Buy Scoring Framework · weights pending (#19)", with the method in its (i). */
export function ScoreChip({ info = true }: { info?: boolean }) {
  return (
    <span className="score-chip-wrap">
      <span className="chip status-pending method-chip">{SCORE_CHIP}</span>
      {info && <InfoTip text={SCORE_METHOD} label="How the Hot Buy Score is calculated" below />}
    </span>
  );
}

/** The verdict as a chip with its text (the colour only repeats it). */
export function VerdictChip({ v }: { v: Verdict }) {
  return <span className={`verdict-chip verdict-${v.id}`}>{v.label}</span>;
}

/** Text of the breakdown, for screen readers. */
function scoreText(s: ScoreResult): string {
  const parts = s.parts.map((p) => `${p.label} ${p.value === null ? 'no data' : VALUE_FMT[p.id](p.value)}: ${num(p.points)} points × ${weightText(p.weight)} = ${num(p.contribution)}`).join('; ');
  const margin = s.netIncGm !== undefined ? ` Net Incremental Gross Margin $ ${signedMoney(s.netIncGm ?? null)}, not part of the score.` : '';
  return `Hot Buy Score ${s.score} of 100, ${s.verdict.label} (${setLabel(s)} weights). ${parts}.${margin}`;
}

function Breakdown({ s }: { s: ScoreResult }) {
  const t = scaledThresholds(s.depth);
  return (
    <>
      <p className="hovercard-title">
        Hot Buy Score {s.score} <span>of 100 · {s.verdict.label} · {setLabel(s)} weights</span>
      </p>
      <table className="score-breakdown">
        <thead>
          <tr>
            <th className="left">Metric</th>
            <th>Value</th>
            <th>Points</th>
            <th>Weight</th>
            <th>Adds</th>
          </tr>
        </thead>
        <tbody>
          {s.parts.map((p) => (
            <tr key={p.id}>
              <td className="left">{p.label}</td>
              <td>{p.value === null ? 'no data' : VALUE_FMT[p.id](p.value)}</td>
              <td>{num(p.points)}</td>
              <td>{weightText(p.weight)}</td>
              <td>{num(p.contribution)}</td>
            </tr>
          ))}
          <tr className="score-total">
            <td className="left" colSpan={4}>
              Total (rounded)
            </td>
            <td>{s.score}</td>
          </tr>
        </tbody>
      </table>
      <p className="hovercard-note">
        {t
          ? `Discount ${pct(s.depth, 0)}: Sales Lift floor ${pct(t.floor)}, Unit Lift minimum ${pct(t.min)}. `
          : 'No discount on this event: Sales Lift and Unit Lift score 0 points. '}
        Lifts vs. the 4 weeks before (fixed).
      </p>
      {s.netIncGm !== undefined && (
        <p className="hovercard-note">Net Incremental Gross Margin $ {signedMoney(s.netIncGm ?? null)}: not part of the score (#19).</p>
      )}
    </>
  );
}

/** The score with a small bar and its verdict; hover or focus shows the breakdown by metric. */
export function ScoreCell({ s }: { s: ScoreResult | undefined }) {
  if (!s) return <span className="flat">—</span>;
  return (
    <HoverCard className="score-cell" label={scoreText(s)} content={<Breakdown s={s} />}>
      <CellBar value={s.score} max={100} text={String(s.score)} />
      <VerdictChip v={s.verdict} />
    </HoverCard>
  );
}

/** A compact score badge for cards (Shopper Impact proposal C), with the verdict and the same breakdown on hover. */
export function ScoreBadge({ s }: { s: ScoreResult | undefined }) {
  if (!s) return <span className="score-badge is-empty">Score —</span>;
  return (
    <HoverCard className="score-badge" label={scoreText(s)} content={<Breakdown s={s} />}>
      <span className="score-badge-label">Hot Buy Score</span>
      <b>{s.score}</b>
      <span className="track" aria-hidden="true">
        <span className="fill" style={{ width: `${Math.max(0, Math.min(100, s.score)).toFixed(1)}%` }} />
      </span>
      <VerdictChip v={s.verdict} />
    </HoverCard>
  );
}
