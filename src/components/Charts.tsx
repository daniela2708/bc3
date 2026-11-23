/* eslint-disable react-refresh/only-export-components -- chart palette constants live with the charts */
import { ArrowDownWideNarrow, ArrowUpNarrowWide, BarChart3, Table2 } from 'lucide-react';
import { ExportButton, nodeText } from './ExportButton';
import { niceTicks } from '../lib/format';
import { cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Customized,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Chart palette. Categorical slots validated with the dataviz validator (light surface):
 * blue → orange → aqua passes CVD and normal-vision separation; aqua needs labels or the table view.
 * Last year and budgets-as-context use the neutral de-emphasis gray. Variances use the pos/neg tokens
 * and always carry ▲ / ▼ text.
 */
export const C = {
  // Sober categorical steps (validated: lightness, chroma, CVD and normal-vision separation pass on the light surface).
  s1: '#2d63a0',
  s2: '#c27530',
  s3: '#22907a',
  s4: '#bd9306',
  ly: '#a2a19c',
  grid: '#ecebe5',
  axis: '#797873',
  pos: '#2e7d4f',
  neg: '#c62828',
  soft: '#d5e0ec',
  /** Brand accent (promo window tint). */
  accent: '#e93d44',
  /** Muted change colours of the bridge (with a sign on every label, never colour alone). */
  posSoft: '#4f8a66',
  negSoft: '#b4524d',
  /** Recessive bars for a secondary panel (e.g. volume under a cost line). */
  qty: '#b3bfcc',
};

/** Categorical colors for series beyond the core four (ingredients, components). */
export const SERIES = [C.s1, C.s2, C.s3, '#6a5bbf', C.s4, '#c05380'];

export interface LegendItem {
  label: string;
  color: string;
  kind?: 'line' | 'rect' | 'dot';
}

export interface ChartTable {
  head: string[];
  rows: (string | number)[][];
}

export type RankOrder = 'top' | 'bottom';

/**
 * Ranking order for bar charts: sorts by `value` from highest to lowest and keeps the first `n` ("top"), or the
 * lowest `n` from lowest up ("bottom").
 */
export function rankSlice<T>(rows: T[], value: (r: T) => number, order: RankOrder, n = rows.length): T[] {
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  return order === 'top' ? sorted.slice(0, n) : sorted.reverse().slice(0, n);
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  height = 240,
  contentHeight,
  className,
  rank,
  tags,
  titleNode,
  titleChip,
  controls,
  tableNote,
}: {
  /** Title with glossary terms; `title` stays the plain text (aria-label, Excel file name). */
  titleNode?: ReactNode;
  /** Small chip right after the title (e.g. "Definition pending #3"). */
  titleChip?: ReactNode;
  /** Row 2: the card's own controls in one line (Event dropdown, Daily / Weekly, a control that changes only it). */
  controls?: ReactNode;
  /** Row 3: one line with the active calculation settings (SettingTags). */
  tags?: ReactNode;
  /** Technical notes kept out of the header: shown under the table view and added to the Excel export. */
  tableNote?: string;
  /** Ranking charts: a Top first | Bottom first switch in the header. */
  rank?: { order: RankOrder; onChange: (o: RankOrder) => void };
  /** Full height of the chart when it is taller than `height`; the body then scrolls. */
  contentHeight?: number;
  title: string;
  /** One short line that identifies the chart; cut with an ellipsis, full text in the tooltip. */
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: ChartTable;
  children: ReactNode;
  height?: number;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const subText = nodeText(subtitle);
  return (
    <section className={`card chart-card${className ? ` ${className}` : ''}`} aria-label={title}>
      <header className="chart-head">
        <div className="chart-row1">
          <h3 className="chart-title">{titleNode ?? title}</h3>
          {titleChip && <span className="chart-title-chip">{titleChip}</span>}
          {(table || rank) && (
            <span className="chart-actions">
              {rank && (
                <span className="rank-toggle" role="group" aria-label="Ranking order">
                  {(['top', 'bottom'] as const).map((o) => (
                    <button key={o} type="button" className={`rank-btn${rank.order === o ? ' is-on' : ''}`} aria-pressed={rank.order === o} onClick={() => rank.onChange(o)}>
                      {o === 'top' ? <ArrowDownWideNarrow size={13} aria-hidden="true" /> : <ArrowUpNarrowWide size={13} aria-hidden="true" />}
                      {o === 'top' ? 'Top first' : 'Bottom first'}
                    </button>
                  ))}
                </span>
              )}
              {table && (
                <>
                  <ExportButton
                    iconOnly
                    fileName={title}
                    getSheet={() => ({ title, subtitle: [subText, tableNote].filter(Boolean).join(' · '), head: table.head, rows: table.rows.map((r) => r.map((c) => c)) })}
                  />
                  <button
                    type="button"
                    className="chart-view-btn icon-only"
                    aria-pressed={asTable}
                    aria-label={asTable ? 'Show chart' : 'Show as table'}
                    title={asTable ? 'Show chart' : 'Show as table'}
                    onClick={() => setAsTable((v) => !v)}
                  >
                    {asTable ? <BarChart3 size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
                  </button>
                </>
              )}
            </span>
          )}
        </div>
        <div className="chart-sub" title={subText || undefined}>
          {subtitle}
        </div>
        <div className="chart-controls">{controls}</div>
        <div className="chart-settings">{tags}</div>
      </header>
      {legend && legend.length > 1 && !asTable && (
        <ul className="chart-legend">
          {legend.map((l) => (
            <li key={l.label}>
              <span className={`key key-${l.kind ?? 'line'}`} style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {asTable && table ? (
        <div className="chart-table-wrap" style={{ maxHeight: height + 24 }}>
          <table className="mini-table">
            <thead>
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={i === 0 ? 'left' : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j === 0 ? 'left' : undefined}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableNote && <p className="table-note chart-table-note">{tableNote}</p>}
        </div>
      ) : (
        <Sized height={height} contentHeight={contentHeight}>
          {children}
        </Sized>
      )}
    </section>
  );
}

/** Measures its width (on mount and on resize) and hands it to the chart, so charts never render at 0 × 0. */
function Sized({ height, contentHeight, children }: { height: number; contentHeight?: number; children: ReactNode }) {
  const scroll = !!contentHeight && contentHeight > height;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className={`chart-body${scroll ? ' is-scroll' : ''}`}
      ref={ref}
      // A scrolling chart does not set the row height: it fills whatever its neighbour in the grid needs.
      style={scroll ? undefined : { height: contentHeight ? Math.min(height, contentHeight) : height }}
      tabIndex={scroll ? 0 : undefined}
    >
      {width > 0 && isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width, height: contentHeight ?? height })
        : null}
    </div>
  );
}

// ---------------------------------------------------------------- Tooltip

export interface TipRow {
  label: string;
  value: string;
  color?: string;
}

export function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{title}</div>
      {rows.map((r) => (
        <div className="chart-tip-row" key={r.label}>
          {r.color && <span className="tip-key" style={{ background: r.color }} />}
          <b>{r.value}</b>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tick: { fill: C.axis, fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const;

// ---------------------------------------------------------------- Trend (lines over weeks)

interface EndLabelProps {
  formattedGraphicalItems?: { item?: { props?: { stroke?: string } }; props?: { stroke?: string; points?: { x: number; y: number | null; value?: unknown }[] } }[];
  format: (v: number) => string;
}

/** Value at the end of every line. Labels that would overlap are spread apart and tied back with a short leader. */
function EndLabels({ formattedGraphicalItems, format }: EndLabelProps) {
  const GAP = 15;
  const ends = (formattedGraphicalItems ?? [])
    .map((g) => {
      const pts = g.props?.points ?? [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        const v = Array.isArray(p.value) ? p.value[1] : p.value;
        if (p.y !== null && typeof p.y === 'number' && typeof v === 'number') return { x: p.x, y: p.y, v, color: g.item?.props?.stroke ?? g.props?.stroke ?? C.axis, ly: p.y };
      }
      return null;
    })
    .filter((e): e is { x: number; y: number; v: number; color: string; ly: number } => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < GAP) ends[i].ly = ends[i - 1].ly + GAP;
  return (
    <g>
      {ends.map((e, i) => (
        <g key={i}>
          {Math.abs(e.ly - e.y) > 1 && <line x1={e.x + 3} y1={e.y} x2={e.x + 10} y2={e.ly} stroke={e.color} strokeWidth={1} />}
          <circle cx={e.x + 14} cy={e.ly} r={3} fill={e.color} />
          <text x={e.x + 20} y={e.ly + 4} fontSize={12} fontWeight={800} fill="#211e1e">
            {format(e.v)}
          </text>
        </g>
      ))}
    </g>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
  width?: number;
}

/** 10 % of the data range as head- and footroom, so no line touches or leaves the plot. */
function padOf(_edge: number, data: Record<string, number | string | null>[], series: Series[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of data)
    for (const s of series) {
      const v = r[s.key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  return Number.isFinite(lo) ? Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.002, 1e-6) : 0;
}

export function TrendLines({
  width,
  height,
  data,
  series,
  format,
  tickFormat,
  reference,
}: {
  width?: number;
  height?: number;
  data: Record<string, number | string | null>[];
  series: Series[];
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  reference?: { y: number; label: string };
}) {
  return (
    <LineChart width={width} height={height} data={data} margin={{ top: 10, right: 70, bottom: 0, left: 4 }}>
      <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
      <YAxis
        {...axisProps}
        width={52}
        tickFormatter={tickFormat ?? format}
        domain={[(lo: number) => lo - padOf(lo, data, series), (hi: number) => hi + padOf(hi, data, series)]}
      />
      {reference && <ReferenceLine y={reference.y} stroke={C.axis} strokeWidth={1} label={{ value: reference.label, position: 'insideTopLeft', fill: C.axis, fontSize: 11 }} />}
      <Tooltip
        cursor={{ stroke: C.axis, strokeWidth: 1 }}
        content={({ active, payload, label }) =>
          active && payload?.length ? (
            <TipBox
              title={String(label)}
              rows={series
                .map((s): TipRow | null => {
                  const p = payload.find((x) => x.dataKey === s.key);
                  return p && typeof p.value === 'number' ? { label: s.label, value: format(p.value), color: s.color } : null;
                })
                .filter((r): r is TipRow => r !== null)}
            />
          ) : null
        }
      />
      {series.map((s) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          stroke={s.color}
          strokeWidth={s.width ?? 2}
          dot={false}
          activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
      <Customized component={(props: unknown) => <EndLabels {...(props as EndLabelProps)} format={format} />} />
    </LineChart>
  );
}

// ---------------------------------------------------------------- Columns with a last-year line

export function ColumnsVsLy({
  width,
  height,
  data,
  format,
  tickFormat,
  avg,
}: {
  width?: number;
  height?: number;
  data: { x: string; value: number; ly: number | null; note?: string }[];
  format: (v: number) => string;
  tickFormat: (v: number) => string;
  avg?: number;
}) {
  return (
    <ComposedChart width={width} height={height} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="22%">
      <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
      <YAxis {...axisProps} width={52} tickFormatter={tickFormat} />
      {avg !== undefined && (
        <ReferenceLine y={avg} stroke={C.axis} strokeWidth={1} label={{ value: `Avg ${tickFormat(avg)}`, position: 'insideTopRight', fill: C.axis, fontSize: 11 }} />
      )}
      <Tooltip
        cursor={{ fill: 'rgba(33,30,30,0.05)' }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload as { value: number; ly: number | null; note?: string };
          const rows: TipRow[] = [{ label: 'This year', value: format(row.value), color: C.s1 }];
          if (row.ly !== null) rows.push({ label: 'Last year', value: format(row.ly), color: C.ly });
          if (row.note) rows.push({ label: row.note, value: '' });
          return <TipBox title={String(label)} rows={rows} />;
        }}
      />
      <Bar dataKey="value" fill={C.s1} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      <Line type="monotone" dataKey="ly" stroke={C.ly} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
    </ComposedChart>
  );
}

// ---------------------------------------------------------------- Horizontal bars

export interface HBarDatum {
  label: string;
  value: number;
  /** Optional comparison value drawn as a second, gray bar. */
  compare?: number | null;
  color?: string;
  id?: string | number;
  tip?: TipRow[];
}

/** Height of a ranking chart with `n` rows (24 px bars, or a 20 px bar plus its comparison). */
export function hbarHeight(n: number, compare = false): number {
  return Math.max(1, n) * (compare ? 46 : 36) + 8;
}

/** Round domain that always includes zero, with room for labels. */
function divDomain(data: HBarDatum[]): [number, number] {
  const vals = data.map((d) => d.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span / 4)));
  return [Math.floor((lo - span * 0.08) / step) * step, Math.ceil((hi + span * 0.12) / step) * step];
}

export function HBars({
  width,
  height,
  data,
  format,
  onSelect,
  compareLabel,
  valueLabel = 'Value',
  diverging = false,
  arrows = false,
  labelWidth = 120,
  compareColor,
  refs = [],
}: {
  /** Vertical reference lines (e.g. watch / flag thresholds), labelled at the top. */
  refs?: { x: number; label: string; color?: string; anchor?: 'start' | 'end' }[];
  arrows?: boolean;
  /** When set, the comparison is a second full-size series in this color instead of a thin gray reference bar. */
  compareColor?: string;
  width?: number;
  height?: number;
  data: HBarDatum[];
  format: (v: number) => string;
  onSelect?: (d: HBarDatum) => void;
  compareLabel?: string;
  valueLabel?: string;
  diverging?: boolean;
  labelWidth?: number;
}) {
  return (
    <BarChart width={width} height={height} data={data} layout="vertical" margin={{ top: refs.length ? 20 : 4, right: 72, bottom: 4, left: 4 }} barCategoryGap={compareLabel ? 8 : 10} barGap={3}>
      <XAxis type="number" hide domain={diverging ? divDomain(data) : [0, (max: number) => Math.max(max, ...refs.map((r) => r.x * 1.15))]} />
      <YAxis type="category" dataKey="label" {...axisProps} width={labelWidth} interval={0} tick={{ fill: '#211e1e', fontSize: 12 }} />
      {diverging && <ReferenceLine x={0} stroke={C.axis} strokeWidth={1} />}
      {refs.map((r) => (
        <ReferenceLine
          key={r.label}
          x={r.x}
          stroke={r.color ?? C.axis}
          strokeDasharray="4 3"
          strokeWidth={1.5}
          ifOverflow="extendDomain"
          label={(p: { viewBox?: { x: number; y: number } }) => (
            // Above the plot, beside the line: "end" sits to its left, "start" to its right, so close lines never overlap.
            <text x={(p.viewBox?.x ?? 0) + (r.anchor === 'end' ? -4 : 4)} y={(p.viewBox?.y ?? 0) - 6} textAnchor={r.anchor ?? 'start'} fill={r.color ?? C.axis} fontSize={11} fontWeight={700}>
              {r.label}
            </text>
          )}
        />
      ))}
      <Tooltip
        cursor={{ fill: 'rgba(33,30,30,0.05)' }}
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload as HBarDatum;
          const rows: TipRow[] = d.tip ?? [{ label: valueLabel, value: format(d.value), color: d.color ?? C.s1 }];
          if (!d.tip && d.compare !== undefined && d.compare !== null && compareLabel) rows.push({ label: compareLabel, value: format(d.compare), color: compareColor ?? C.ly });
          return <TipBox title={d.label} rows={rows} />;
        }}
      />
      <Bar
        dataKey="value"
        radius={[0, 4, 4, 0]}
        maxBarSize={compareLabel ? 20 : 24}
        isAnimationActive={false}
        cursor={onSelect ? 'pointer' : undefined}
        onClick={(d) => onSelect?.(d as unknown as HBarDatum)}
      >
        {data.map((d) => (
          <Cell key={String(d.id ?? d.label)} fill={d.color ?? C.s1} />
        ))}
        <LabelList
          dataKey="value"
          content={(props) => {
            const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
            const arrow = arrows ? (value > 0.05 ? '▲ ' : value < -0.05 ? '▼ ' : '') : '';
            return (
              <text
                x={Math.max(x, x + width) + 6}
                y={y + height / 2 + 4}
                fontSize={11.5}
                fontWeight={700}
                fill="#211e1e"
                textAnchor="start"
              >
                {arrow}
                {format(value)}
              </text>
            );
          }}
        />
      </Bar>
      {compareLabel && (
        <Bar dataKey="compare" fill={compareColor ?? C.ly} radius={[0, 4, 4, 0]} maxBarSize={compareColor ? 20 : 10} isAnimationActive={false}>
          {compareColor && (
            <LabelList
              dataKey="compare"
              content={(props) => {
                const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
                return (
                  <text x={x + width + 6} y={y + height / 2 + 4} fontSize={11.5} fontWeight={700} fill="#211e1e">
                    {format(value)}
                  </text>
                );
              }}
            />
          )}
        </Bar>
      )}
    </BarChart>
  );
}

export const ChartGrid = ({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) => <div className={`chart-grid cols-${cols}`}>{children}</div>;

// ---------------------------------------------------------------- Cost over time: two stacked panels, one time axis

export interface CostQtyPoint {
  x: string;
  /** PO Cost / Unit for the bucket; null when nothing was bought (drawn as a gap). */
  cost: number | null;
  /** HQ Average Cost in force in the bucket. */
  hq: number;
  retail: number | null;
  qty: number;
}

/**
 * Real-time cost (line, with the HQ cost as a dashed reference and optional retail) above quantity
 * purchased (bars). Two panels instead of a dual axis; `syncId` keeps the crosshair and tooltip in step.
 */
export function CostQtyPanels({
  data,
  showRetail,
  fmtCost,
  fmtQty,
  qtyLabel,
  costLabel = 'PO cost / unit',
  width,
  height,
}: {
  data: CostQtyPoint[];
  costLabel?: string;
  showRetail: boolean;
  fmtCost: (v: number) => string;
  fmtQty: (v: number) => string;
  qtyLabel: string;
  width?: number;
  height?: number;
}) {
  const h = height ?? 380;
  const topH = Math.round(h * 0.62);
  const botH = h - topH;
  const costs = data.flatMap((d) => [d.cost, d.hq, showRetail ? d.retail : null]).filter((v): v is number => typeof v === 'number');
  const lo = Math.min(...costs);
  const hi = Math.max(...costs);
  const lastHq = data.length ? data[data.length - 1].hq : null;
  const pad = Math.max((hi - lo) * 0.1, hi * 0.02, 0.01);
  const tip = ({ active, payload, label }: { active?: boolean; payload?: { payload?: unknown }[]; label?: string | number }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as CostQtyPoint;
    const rows: TipRow[] = [
      { label: costLabel, value: p.cost === null ? 'No purchases (gap)' : fmtCost(p.cost), color: C.s1 },
      { label: 'HQ Average Cost', value: fmtCost(p.hq), color: C.axis },
    ];
    if (showRetail && p.retail !== null) rows.push({ label: 'Retail', value: fmtCost(p.retail), color: C.s3 });
    rows.push({ label: qtyLabel, value: fmtQty(p.qty), color: C.qty });
    return <TipBox title={String(label)} rows={rows} />;
  };
  return (
    <div style={{ width, height: h }}>
      <LineChart width={width} height={topH} data={data} syncId="itemcost" margin={{ top: 10, right: 76, bottom: 0, left: 4 }}>
        <XAxis dataKey="x" hide />
        <YAxis {...axisProps} width={60} tickFormatter={fmtCost} domain={[lo - pad, hi + pad]} allowDataOverflow />
        <Tooltip content={tip} cursor={{ stroke: C.axis, strokeWidth: 1 }} />
        <Line type="stepAfter" dataKey="hq" stroke={C.axis} strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} activeDot={false} />
        {lastHq !== null && (
          <ReferenceLine y={lastHq} stroke="none" label={{ value: `HQ ${fmtCost(lastHq)}`, position: 'right', fill: C.axis, fontSize: 11 }} />
        )}
        <Line
          type="linear"
          dataKey="cost"
          stroke={C.s1}
          strokeWidth={2}
          dot={data.length <= 16 ? { r: 2.5, fill: C.s1, strokeWidth: 0 } : false}
          connectNulls={false}
          isAnimationActive={false}
          activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }}
        />
        {showRetail && <Line type="stepAfter" dataKey="retail" stroke={C.s3} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
      </LineChart>
      <BarChart width={width} height={botH} data={data} syncId="itemcost" margin={{ top: 6, right: 76, bottom: 0, left: 4 }} barCategoryGap="20%">
        <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
        <YAxis {...axisProps} width={60} tickFormatter={fmtQty} />
        <Tooltip content={tip} cursor={{ fill: 'rgba(33,30,30,0.05)' }} />
        <Bar dataKey="qty" fill={C.qty} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}

// ---------------------------------------------------------------- Stacked columns

/** Stacked columns by category (e.g. each ingredient's contribution to unit cost by week), total in the tooltip. */
export function StackedBars({
  data,
  series,
  format,
  tickFormat,
  width,
  height,
  totalLabel = 'Total',
}: {
  data: Record<string, number | string>[];
  series: { key: string; label: string; color: string }[];
  format: (v: number) => string;
  tickFormat: (v: number) => string;
  width?: number;
  height?: number;
  totalLabel?: string;
}) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="18%">
      <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
      <YAxis {...axisProps} width={56} tickFormatter={tickFormat} />
      <Tooltip
        cursor={{ fill: 'rgba(33,30,30,0.05)' }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload as Record<string, number>;
          const rows: TipRow[] = [...series].reverse().map((sr) => ({ label: sr.label, value: format(row[sr.key] ?? 0), color: sr.color }));
          rows.push({ label: totalLabel, value: format(series.reduce((a, sr) => a + (row[sr.key] ?? 0), 0)) });
          return <TipBox title={String(label)} rows={rows} />;
        }}
      />
      {series.map((sr, n) => (
        <Bar
          key={sr.key}
          dataKey={sr.key}
          stackId="s"
          fill={sr.color}
          stroke="#fff"
          strokeWidth={1}
          maxBarSize={28}
          isAnimationActive={false}
          radius={n === series.length - 1 ? [3, 3, 0, 0] : undefined}
        />
      ))}
    </BarChart>
  );
}

// ---------------------------------------------------------------- Daily sales vs. baseline

/** One point of a promo-window chart (a day or an ad week); see src/lib/series.ts. */
export interface WindowPoint {
  x: string;
  actual: number;
  baseline: number;
  diff: number;
  phase: 'baseline' | 'promo' | 'after';
  days: number;
  partial: boolean;
}

/** Window shading: Baseline light neutral, Promo a soft tint of the brand accent, After an even lighter neutral. */
const WINDOW_SHADE = {
  baseline: { fill: C.grid, opacity: 0.75, label: 'Baseline' },
  promo: { fill: C.accent, opacity: 0.09, label: 'Promo' },
  after: { fill: C.grid, opacity: 0.35, label: 'After' },
} as const;

/**
 * Actuals (line) against the baseline (dashed, named at its right end) across the three windows. The window names sit
 * in a fixed band above the plot, never on the line. Round axis ticks, horizontal grid only, dots on hover only.
 */
export function PromoWindowChart({
  data,
  format,
  axisFormat,
  actualLabel,
  weekly,
  note,
  width,
  height,
}: {
  data: WindowPoint[];
  format: (v: number) => string;
  /** Round axis labels ($260K, not $260.0K). */
  axisFormat: (v: number) => string;
  actualLabel: string;
  weekly: boolean;
  /** Technical note shown at the end of the tooltip (baseline per week, windows). */
  note?: string;
  width?: number;
  height?: number;
}) {
  const span = (phase: WindowPoint['phase']) => {
    const p = data.filter((d) => d.phase === phase);
    return p.length ? { x1: p[0].x, x2: p[p.length - 1].x } : null;
  };
  const max = data.reduce((m, d) => Math.max(m, d.actual, d.baseline), 0);
  const ticks = niceTicks(0, max, 4);
  const last = data.length - 1;
  return (
    <ComposedChart width={width} height={height} data={data} margin={{ top: 22, right: 64, bottom: 0, left: 4 }}>
      <CartesianGrid vertical={false} stroke={C.grid} strokeOpacity={0.8} />
      <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={weekly ? 12 : 28} />
      <YAxis {...axisProps} width={56} tickFormatter={axisFormat} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} />
      {(['baseline', 'promo', 'after'] as const).map((ph) => {
        const sp = span(ph);
        const sh = WINDOW_SHADE[ph];
        return sp ? (
          <ReferenceArea key={ph} x1={sp.x1} x2={sp.x2} fill={sh.fill} fillOpacity={sh.opacity} ifOverflow="extendDomain" label={{ value: sh.label, position: 'top', fill: C.axis, fontSize: 11, fontWeight: 700 }} />
        ) : null;
      })}
      <Tooltip
        cursor={{ stroke: C.axis, strokeWidth: 1 }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const p = payload[0].payload as WindowPoint;
          const partial = p.partial ? ` · partial week (${p.days} of 7 days)` : '';
          return (
            <TipBox
              title={`${label} · ${WINDOW_SHADE[p.phase].label}${partial}`}
              rows={[
                { label: actualLabel, value: format(p.actual), color: C.s1 },
                { label: weekly ? (p.partial ? `Baseline (${p.days} days)` : 'Baseline (weekly)') : 'Baseline (daily average)', value: format(p.baseline), color: C.axis },
                { label: 'Difference', value: format(p.diff) },
                ...(note ? [{ label: note, value: '' }] : []),
              ]}
            />
          );
        }}
      />
      <Line
        type="stepAfter"
        dataKey="baseline"
        name="Baseline"
        stroke={C.axis}
        strokeDasharray="5 4"
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
        activeDot={false}
        label={(props: { index?: number; x?: number; y?: number }) =>
          props.index === last && props.x !== undefined && props.y !== undefined ? (
            <text key="baseline-end" x={props.x + 6} y={props.y} dy={4} fontSize={11} fontWeight={700} fill={C.axis}>
              Baseline
            </text>
          ) : (
            <g key={`b${props.index}`} />
          )
        }
      />
      <Line type="linear" dataKey="actual" name={actualLabel} stroke={C.s1} strokeWidth={2.5} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
    </ComposedChart>
  );
}

// ---------------------------------------------------------------- Bridge (waterfall)

export interface BridgeStep {
  label: string;
  value: number;
  /** "total" bars start at zero; "delta" bars float from the running total. */
  kind: 'delta' | 'total';
}

/** Waterfall: promo item lift → cannibalization → net, then the rest of the category → category incremental. */
/** Bars shorter than this many pixels are drawn at this height (from their baseline side) so they stay visible. */
const MIN_BAR_PX = 4;
/** Share of its slot a bridge bar takes (at most 60 %). */
const BAR_SHARE = 0.6;

/**
 * Waterfall: promo item lift → cannibalization → net incremental → rest of the category → category incremental.
 * Sober theme colours (muted green / red for changes, brand blue for totals), thin dotted connectors between bars,
 * a sign on every change label, round axis ticks and bars no wider than 60 % of their slot.
 */
export function Bridge({ steps, format, axisFormat = format, width, height }: { steps: BridgeStep[]; format: (v: number) => string; axisFormat?: (v: number) => string; width?: number; height?: number }) {
  let run = 0;
  const data = steps.map((s) => {
    let lo: number;
    let hi: number;
    if (s.kind === 'total') {
      lo = Math.min(0, s.value);
      hi = Math.max(0, s.value);
      run = s.value;
    } else {
      lo = Math.min(run, run + s.value);
      hi = Math.max(run, run + s.value);
      run += s.value;
    }
    return { ...s, range: [lo, hi] as [number, number], end: run };
  });
  const ticks = niceTicks(Math.min(...data.map((d) => d.range[0])), Math.max(...data.map((d) => d.range[1])), 4);
  const label = (d: BridgeStep) => (d.kind === 'delta' && d.value > 0 ? `+${format(d.value)}` : format(d.value));
  const fillOf = (d: BridgeStep) => (d.kind === 'total' ? C.s1 : d.value >= 0 ? C.posSoft : C.negSoft);
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 22, right: 12, bottom: 0, left: 4 }} barCategoryGap={`${Math.round(((1 - BAR_SHARE) / 2) * 100)}%`}>
      <CartesianGrid vertical={false} stroke={C.grid} strokeOpacity={0.8} />
      <XAxis dataKey="label" {...axisProps} interval={0} tick={{ fill: '#211e1e', fontSize: 11.5 }} />
      <YAxis {...axisProps} width={58} tickFormatter={axisFormat} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} />
      <ReferenceLine y={0} stroke={C.axis} strokeWidth={1} />
      <Tooltip
        cursor={{ fill: 'rgba(33,30,30,0.05)' }}
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload as BridgeStep;
          return <TipBox title={d.label} rows={[{ label: d.kind === 'total' ? 'Total' : 'Change', value: label(d) }]} />;
        }}
      />
      <Bar
        dataKey="range"
        isAnimationActive={false}
        shape={(props: unknown) => {
          const { x, y, width: w, height: h, index, payload } = props as { x: number; y: number; width: number; height: number; index: number; payload: (typeof data)[number] };
          const up = payload.kind === 'total' ? payload.value >= 0 : payload.value >= 0;
          const hh = Math.max(Math.abs(h), MIN_BAR_PX);
          // A short bar grows away from its baseline side, so the running total stays where the scale puts it.
          const top = Math.abs(h) >= MIN_BAR_PX ? Math.min(y, y + h) : up ? Math.min(y, y + h) + Math.abs(h) - hh : Math.min(y, y + h);
          const endY = payload.kind === 'total' ? (up ? Math.min(y, y + h) : Math.max(y, y + h)) : up ? Math.min(y, y + h) : Math.max(y, y + h);
          // Recharts puts barCategoryGap on each side: bars take 60 % of their slot, so the next bar starts one slot (width ÷ 0.6) later.
          const next = index < data.length - 1 ? x + w / BAR_SHARE : null;
          return (
            <g>
              <rect x={x} y={top} width={w} height={hh} rx={3} fill={fillOf(payload)} />
              {next !== null && <line x1={x + w} x2={next} y1={endY} y2={endY} stroke={C.axis} strokeWidth={1} strokeDasharray="2 3" />}
            </g>
          );
        }}
      >
        {data.map((d) => (
          <Cell key={d.label} fill={fillOf(d)} />
        ))}
        <LabelList
          dataKey="value"
          content={(props) => {
            const { x, y, width, height: h, index } = props as { x: number; y: number; width: number; height: number; index: number };
            const d = data[index];
            const above = Math.min(y, y + h) - 6;
            return (
              <text x={x + width / 2} y={above} fontSize={11.5} fontWeight={700} fill="#211e1e" textAnchor="middle">
                {label(d)}
              </text>
            );
          }}
        />
      </Bar>
    </BarChart>
  );
}

// ---------------------------------------------------------------- Signed columns

/** Columns colored by sign (green above zero, red below), value labels on top. */
export function SignedColumns({
  data,
  format,
  width,
  height,
  valueLabel,
  neutral = false,
  labels = false,
}: {
  /** Value labels on top of each column (few columns only). */
  labels?: boolean;
  data: { x: string; value: number | null; tip?: TipRow[] }[];
  format: (v: number) => string;
  width?: number;
  height?: number;
  valueLabel: string;
  /** One neutral colour for values that are not a gain or a loss (e.g. buyers before, during and after). */
  neutral?: boolean;
}) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 20, right: 8, bottom: 0, left: 4 }} barCategoryGap="22%">
      <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
      <YAxis {...axisProps} width={58} tickFormatter={format} />
      <ReferenceLine y={0} stroke={C.axis} strokeWidth={1} />
      <Tooltip
        cursor={{ fill: 'rgba(33,30,30,0.05)' }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload as { value: number | null; tip?: TipRow[] };
          return <TipBox title={String(label)} rows={d.tip ?? [{ label: valueLabel, value: d.value === null ? '—' : format(d.value) }]} />;
        }}
      />
      <Bar dataKey="value" isAnimationActive={false} radius={[3, 3, 0, 0]} maxBarSize={36}>
        {data.map((d, i) => (
          <Cell key={i} fill={neutral ? C.s1 : (d.value ?? 0) >= 0 ? C.pos : C.neg} />
        ))}
        {labels && <LabelList dataKey="value" position="top" formatter={(v: number | null) => (v === null ? '—' : format(v))} fontSize={11.5} fontWeight={700} fill="#211e1e" />}
      </Bar>
    </BarChart>
  );
}

/**
 * Two series (e.g. buyers and baskets) across the Before / During / After windows, as grouped columns with each window
 * shaded like the promo window charts (Baseline neutral, Promo a soft accent tint, After lighter). Null values are gaps.
 */
export function PhaseBars({
  data,
  series,
  format,
  width,
  height,
}: {
  data: { x: string; phase: keyof typeof WINDOW_SHADE; [k: string]: number | null | string }[];
  series: { key: string; label: string; color: string }[];
  format: (v: number) => string;
  width?: number;
  height?: number;
}) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 20, right: 8, bottom: 0, left: 4 }} barCategoryGap="24%" barGap={4}>
      {data.map((d) => (
        <ReferenceArea key={d.x} x1={d.x} x2={d.x} fill={WINDOW_SHADE[d.phase].fill} fillOpacity={WINDOW_SHADE[d.phase].opacity} stroke="none" ifOverflow="extendDomain" />
      ))}
      <CartesianGrid vertical={false} stroke={C.grid} />
      <XAxis dataKey="x" {...axisProps} interval={0} />
      <YAxis {...axisProps} width={58} tickFormatter={format} />
      <Tooltip
        cursor={{ fill: 'rgba(33,30,30,0.05)' }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload as Record<string, number | null>;
          return <TipBox title={String(label)} rows={series.map((sr) => ({ label: sr.label, value: d[sr.key] === null ? '—' : format(d[sr.key] as number), color: sr.color }))} />;
        }}
      />
      {series.map((sr) => (
        <Bar key={sr.key} dataKey={sr.key} name={sr.label} fill={sr.color} isAnimationActive={false} radius={[3, 3, 0, 0]} maxBarSize={32} />
      ))}
    </BarChart>
  );
}
