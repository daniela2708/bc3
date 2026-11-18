/* eslint-disable react-refresh/only-export-components -- run rows and labels sit with the table that shows them */
import type { ReactNode } from 'react';
import { ExportButton, nodeText } from '../components/ExportButton';
import { fiscalOfDay } from '../data/calendar';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS, PROMO_LABEL } from '../data/promos';
import { moneyCompact, pct, pctChange } from '../lib/format';
import type { Metrics } from '../lib/metrics';
import { eventDates, unitsText, uomPct } from './common';

export interface RunRow {
  key: string;
  label: string;
  cell: (m: Metrics) => ReactNode;
  pending?: number;
  /** Level 2: useful but not part of the MVP. */
  level2?: boolean;
}

export const RUN_ROWS: RunRow[] = [
  { key: 'gross', label: 'Gross Sales $', cell: (m) => moneyCompact(m.gross) },
  { key: 'net', label: 'Net Customer Sales $', cell: (m) => moneyCompact(m.net) },
  { key: 'units', label: 'Volume', cell: (m) => unitsText(m.units) },
  { key: 'gm', label: 'Promo GM $', cell: (m) => moneyCompact(m.gm), pending: 15 },
  { key: 'gmPct', label: 'Promo GM %', cell: (m) => pct(m.gmPct), pending: 5 },
  { key: 'salesLift', label: 'Sales Lift %', cell: (m) => pctChange(m.salesLift) },
  { key: 'unitLift', label: 'Unit Lift %', cell: (m) => uomPct(m.unitLift, true) },
  { key: 'incGm', label: 'Incremental GM $', cell: (m) => moneyCompact(m.incGm) },
  { key: 'netIncGm', label: 'Net Incremental GM $', cell: (m) => moneyCompact(m.netIncGm), pending: 7 },
  { key: 'ly', label: 'LY Gross Sales $', cell: (m) => moneyCompact(m.ly) },
  { key: 'yoy', label: 'YoY Gross Sales $ / %', cell: (m) => (m.yoy.abs === null ? '—' : `${moneyCompact(m.yoy.abs)} · ${pctChange(m.yoy.pct)}`) },
  { key: 'dip', label: 'Post-Promo Dip % (4 weeks)', cell: (m) => uomPct(m.dip, true), level2: true },
];

export function runLabel(e: number): string {
  const ev = EVENTS[e];
  const f = fiscalOfDay(ev.start);
  return `Q${f.quarter} FY${String(f.fy).slice(2)}`;
}

/** Runs of the same promotion side by side: one column per run, metrics as rows. */
export function RunsCompare({ runs, metrics, rows = RUN_ROWS, selected, onSelect, title }: { runs: number[]; metrics: Metrics[]; rows?: RunRow[]; selected?: number; onSelect?: (e: number) => void; title: string }) {
  if (runs.length === 0) return <p className="empty">No runs for the current filters.</p>;
  const pg = PRICE_GROUPS[EVENTS[runs[0]].pg];
  const head = ['Metric', ...runs.map((e) => `${runLabel(e)} ${eventDates(EVENTS[e])}`)];
  return (
    <>
      <div className="table-export">
        <span className="table-buttons">
          <ExportButton
            fileName={title}
            getSheet={() => ({ title, subtitle: `${pg.name} · ${PROMO_LABEL[EVENTS[runs[0]].type]}`, head, rows: rows.map((r) => [r.label, ...metrics.map((m) => nodeText(r.cell(m)))]) })}
            label="Export to Excel"
          />
        </span>
      </div>
      <div className="table-scroll runs-scroll">
        <table className="hier runs-table">
          <thead>
            <tr>
              <th className="left" scope="col">
                Metric
              </th>
              {runs.map((e) => (
                <th key={e} scope="col" className={e === selected ? 'is-selected' : undefined}>
                  {onSelect ? (
                    <button type="button" className="sort-btn" onClick={() => onSelect(e)} title="Show this run in the charts">
                      {runLabel(e)}
                      <small>{eventDates(EVENTS[e])}</small>
                    </button>
                  ) : (
                    <>
                      {runLabel(e)}
                      <small>{eventDates(EVENTS[e])}</small>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="left">
                  {r.label}
                  {r.pending && <span className="pending-dot" title={`Definition pending #${r.pending}`}>*</span>}
                  {r.level2 && <span className="pending-dot level2-dot" title="Level 2 · not MVP">†</span>}
                </th>
                {metrics.map((m, i) => (
                  <td key={runs[i]} className={runs[i] === selected ? 'is-selected' : undefined}>
                    {r.cell(m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">* Definition pending (see KPI definitions). † Level 2 · not MVP.</p>
    </>
  );
}
