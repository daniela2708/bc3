import { heatColor, MONTHS, type HeatMap as HeatData } from '../lib/heatmap';
import { HoverCard } from './HoverCard';

/**
 * Promotion timing heat map: an HTML grid (rows × 12 months). Every filled cell has the value in its tooltip and in
 * its accessible name; empty cells (no event) stay blank. The colour scale is diverging around zero and has a
 * legend; the card's table view lists every value.
 */
export function HeatMap({
  data,
  format,
  measureLabel,
  rowLabel,
  highlight,
  width,
}: {
  data: HeatData;
  format: (v: number | null) => string;
  measureLabel: string;
  rowLabel: string;
  /** Row to outline (e.g. the price group the view is about). */
  highlight?: number;
  width?: number;
  height?: number;
}) {
  const max = data.maxAbs;
  return (
    <div className="heatmap" style={{ width }}>
      <div className="heat-legend" aria-label={`Colour scale: ${measureLabel} from ${format(-max)} to ${format(max)}, grey at zero`}>
        <span className="heat-legend-label">{measureLabel}</span>
        <span>{format(-max)}</span>
        <span className="heat-legend-bar" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${heatColor(-max, max)}, ${heatColor(0, max)}, ${heatColor(max, max)})` }} />
        <span>{format(max)}</span>
        <span className="heat-legend-empty">
          <span className="heat-swatch-empty" aria-hidden="true" /> No event
        </span>
      </div>
      <div className="heat-grid" role="table" aria-label={`${measureLabel} by ${rowLabel.toLowerCase()} and month`}>
        <div className="heat-row heat-head" role="row">
          <span className="heat-rowhead" role="columnheader">
            {rowLabel}
          </span>
          {MONTHS.map((m) => (
            <span key={m} className="heat-colhead" role="columnheader">
              {m}
            </span>
          ))}
        </div>
        {data.rows.map((r) => (
          <div key={r.key} className={`heat-row${r.key === highlight ? ' is-highlight' : ''}`} role="row">
            <span className="heat-rowhead" role="rowheader" title={`${r.label} · ${r.n} event${r.n === 1 ? '' : 's'}`}>
              {r.label} <small>({r.n})</small>
            </span>
            {r.cells.map((c, i) =>
              c.n === 0 || c.value === null ? (
                <span key={i} className="heat-cell is-empty" role="cell" aria-label={`${r.label}, ${MONTHS[i]}: no event`} />
              ) : (
                <span key={i} className="heat-cell-wrap" role="cell">
                  <HoverCard
                    className="heat-cell"
                    label={`${r.label}, ${MONTHS[i]}: ${measureLabel} ${format(c.value)}, ${c.n} event${c.n === 1 ? '' : 's'}`}
                    content={
                      <>
                        <p className="hovercard-title">
                          {r.label} <span>· {MONTHS[i]}</span>
                        </p>
                        <p>
                          {measureLabel}: <b>{format(c.value)}</b>
                        </p>
                        <p>
                          {c.n} event{c.n === 1 ? '' : 's'}
                        </p>
                      </>
                    }
                  >
                    <span className="heat-fill" style={{ background: heatColor(c.value, max) }} />
                  </HoverCard>
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
