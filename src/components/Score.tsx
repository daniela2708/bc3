import { pct, pctChange, signedMoney } from '../lib/format';
import { SCORE_CHIP, SCORE_METHOD, type CriterionId, type ScoreResult } from '../lib/scoring';
import { HoverCard } from './HoverCard';
import { CellBar, InfoTip } from './ui';

const VALUE_FMT: Record<CriterionId, (v: number | null) => string> = {
  unitLift: (v) => pctChange(v),
  netIncGm: (v) => signedMoney(v),
  catImpact: (v) => signedMoney(v),
  cannRate: (v) => pct(v),
  newToCat: (v) => pct(v),
};

const pts = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** "Illustrative scoring · method to be defined with the business", with the method in its (i). */
export function ScoreChip({ info = true }: { info?: boolean }) {
  return (
    <span className="score-chip-wrap">
      <span className="chip status-proposed illustrative-chip">{SCORE_CHIP}</span>
      {info && <InfoTip text={SCORE_METHOD} label="How the illustrative Hot Buy Score is calculated" below />}
    </span>
  );
}

/** Text of the breakdown, for screen readers. */
function scoreText(s: ScoreResult): string {
  return `Hot Buy Score ${Math.round(s.score)} of 100 (illustrative). ${s.parts.map((p) => `${p.label} ${VALUE_FMT[p.id](p.value)}: ${pts(p.points)} of ${p.weight} points`).join('; ')}.`;
}

function Breakdown({ s }: { s: ScoreResult }) {
  return (
    <>
      <p className="hovercard-title">
        Hot Buy Score {Math.round(s.score)} <span>of 100 · illustrative</span>
      </p>
      <table className="score-breakdown">
        <thead>
          <tr>
            <th className="left">Criterion</th>
            <th>Value</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {s.parts.map((p) => (
            <tr key={p.id}>
              <td className="left">{p.label}</td>
              <td>{p.value === null ? 'no data' : VALUE_FMT[p.id](p.value)}</td>
              <td>
                {pts(p.points)} <small>/ {p.weight}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hovercard-note">Each criterion ranked against the other Hot Buys in the selection.</p>
    </>
  );
}

/** The score with a small bar; hover or focus shows the points and weight of each criterion. */
export function ScoreCell({ s }: { s: ScoreResult | undefined }) {
  if (!s) return <span className="flat">—</span>;
  return (
    <HoverCard className="score-cell" label={scoreText(s)} content={<Breakdown s={s} />}>
      <CellBar value={s.score} max={100} text={String(Math.round(s.score))} />
    </HoverCard>
  );
}

/** A compact score badge for cards (Shopper Impact proposal C), with the same breakdown on hover. */
export function ScoreBadge({ s }: { s: ScoreResult | undefined }) {
  if (!s) return <span className="score-badge is-empty">Score —</span>;
  return (
    <HoverCard className="score-badge" label={scoreText(s)} content={<Breakdown s={s} />}>
      <span className="score-badge-label">Hot Buy Score</span>
      <b>{Math.round(s.score)}</b>
      <span className="track" aria-hidden="true">
        <span className="fill" style={{ width: `${Math.max(0, Math.min(100, s.score)).toFixed(1)}%` }} />
      </span>
    </HoverCard>
  );
}
