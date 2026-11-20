import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { money, moneyCompact, pctChange, pts, tone } from '../lib/format';
import { Term } from './Term';

export function InfoTip({ text, below = false, label = 'More information' }: { text: string; below?: boolean; label?: string }) {
  const id = useId();
  return (
    <span className={`tip${below ? ' below' : ''}`} tabIndex={0} aria-label={label} aria-describedby={id} role="button">
      <Info size={13} aria-hidden="true" />
      <span className="tip-body" role="tooltip" id={id}>
        {text}
      </span>
    </span>
  );
}

/** "Definition pending #N": the KPI or view depends on an open question in the tracker (#N). */
export function Pending({ q, label = 'Definition pending', term = false }: { q?: number; label?: string; term?: boolean }) {
  const text = `${label}${q ? ` #${q}` : ''}`;
  return (
    <span className="chip status-pending pending-chip" title={term ? undefined : q ? `Depends on open question #${q} in the tracker` : 'Not defined yet by the business'}>
      {term ? <Term id="definitionPending">{text}</Term> : text}
    </span>
  );
}

/** "Level 2 · not MVP": agreed as useful, outside the MVP (per the requirements, #8). */
export function Level2({ term = false }: { term?: boolean }) {
  return (
    <span className="chip neutral pending-chip" title={term ? undefined : 'Useful but not part of the MVP, per the requirements (#8)'}>
      {term ? <Term id="level2">Level 2 · not MVP</Term> : 'Level 2 · not MVP'}
    </span>
  );
}

/**
 * "How it works" popover: opens with a click or with the keyboard (Enter / Space on the button), closes with Esc,
 * a click outside or the button again. Focus moves into the panel and back to the button on Esc.
 */
export function HowItWorks({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !btn.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);
  return (
    <span className="howto">
      <button ref={btn} type="button" className="btn-link howto-btn" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        How it works
      </button>
      {open && (
        <div ref={panel} id={id} className="howto-pop" role="dialog" aria-label={title} tabIndex={-1}>
          {children}
        </div>
      )}
    </span>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  small = false,
  disabled = false,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`segmented${small ? ' small' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Variance with arrow and colour, so direction never relies on colour alone. */
export function Var({
  value,
  kind = 'pts',
  invert = false,
}: {
  value: number | null | undefined;
  kind?: 'pts' | 'pct';
  invert?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="flat">—</span>;
  // Direction follows the value as displayed (one decimal), so 0.0 never carries an arrow.
  const shown = kind === 'pts' ? Number(value.toFixed(1)) : Number((value * 100).toFixed(1));
  const t = shown === 0 ? 'flat' : tone(value, invert);
  const arrow = shown > 0 ? '▲' : shown < 0 ? '▼' : '';
  const text = kind === 'pts' ? pts(value) : pctChange(value);
  return (
    <span className={`var ${t}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      {text}
    </span>
  );
}

export function Field({
  label,
  children,
  disabledReason,
  htmlFor,
  className,
}: {
  label: string;
  children: ReactNode;
  disabledReason?: string | null;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={`field${disabledReason ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`} title={disabledReason ?? undefined}>
      <span className="field-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        {disabledReason && <InfoTip text={disabledReason} label={`${label} is not used here`} />}
      </span>
      {children}
    </div>
  );
}

/** Number with a small proportional bar, for scanning a column. */
export function CellBar({
  value,
  max,
  text,
  warm = false,
  band,
}: {
  value: number | null;
  max: number;
  text: string;
  warm?: boolean;
  /** Target band, drawn as a shaded range on the track. */
  band?: { lo: number; hi: number };
}) {
  const at = (v: number) => (max <= 0 ? 0 : Math.max(0, Math.min(1, v / max)) * 100);
  const w = value === null || !Number.isFinite(value) ? 0 : at(value);
  const below = band && value !== null && value < band.lo;
  return (
    <span className="cell-bar" title={band ? `Target ${(band.lo * 100).toFixed(0)}–${(band.hi * 100).toFixed(0)} %` : undefined}>
      {text}
      <span className={`track${band ? ' banded' : ''}`} aria-hidden="true">
        {band && <span className="band" style={{ left: `${at(band.lo)}%`, width: `${at(band.hi) - at(band.lo)}%` }} />}
        <span className={`fill${warm || below ? ' warm' : ''}`} style={{ width: `${w.toFixed(1)}%` }} />
      </span>
    </span>
  );
}

/** Signed dollar amount, green when positive and red when negative (always with the sign, never colour alone). */
export function Impact({ value, compact = false }: { value: number | null | undefined; compact?: boolean }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span>—</span>;
  const fmt = compact ? moneyCompact : money;
  const t = Math.abs(value) < 0.5 ? 'flat' : tone(value);
  const text = t === 'flat' ? '$0' : `${value > 0 ? '+' : '−'}${fmt(Math.abs(value))}`;
  return <span className={`impact ${t}`}>{text}</span>;
}
