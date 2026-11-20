import { formatDay, weekStartDay } from '../data/calendar';
import type { Uom } from '../data/products';

/** Missing values (null denominators, no last-year history) render as an em dash. */
export const DASH = '—';
const MINUS = '−';
const NNBSP = ' ';

type N = number | null | undefined;
const ok = (n: N): n is number => typeof n === 'number' && Number.isFinite(n);

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function sign(n: number, s: string): string {
  return n < 0 ? `${MINUS}${s}` : s;
}

/** $58,933,695 */
export function money(n: N): string {
  if (!ok(n)) return DASH;
  const r = Math.round(n);
  return sign(r, `$${int.format(Math.abs(r))}`);
}

/** $502.1M · $1.24B · $812.4K · $950 */
export function moneyCompact(n: N): string {
  if (!ok(n)) return DASH;
  const a = Math.abs(n);
  let s: string;
  if (a >= 1e9) s = `$${dec2.format(a / 1e9)}B`;
  else if (a >= 1e6) s = `$${dec1.format(a / 1e6)}M`;
  else if (a >= 1e4) s = `$${dec1.format(a / 1e3)}K`;
  else s = `$${int.format(Math.round(a))}`;
  return sign(n, s);
}

/**
 * Money in key-figure tiles: millions and thousands with 2 decimals ($2.55M, $845.20K, $1.24B), smaller amounts as
 * whole dollars. Tables keep moneyCompact.
 */
export function moneyTile(n: N): string {
  if (!ok(n)) return DASH;
  const a = Math.abs(n);
  let s: string;
  if (a >= 1e9) s = `$${dec2.format(a / 1e9)}B`;
  else if (a >= 1e6) s = `$${dec2.format(a / 1e6)}M`;
  else if (a >= 1e3) s = `$${dec2.format(a / 1e3)}K`;
  else s = `$${int.format(Math.round(a))}`;
  return sign(n, s);
}

/** Signed tile money: +$144.72K, −$40.31K. */
export function signedMoneyTile(n: N): string {
  if (!ok(n)) return DASH;
  if (Math.abs(n) < 0.5) return '$0';
  return `${n > 0 ? '+' : MINUS}${moneyTile(Math.abs(n))}`;
}

/** $4.99 */
export function moneyUnit(n: N): string {
  if (!ok(n)) return DASH;
  return sign(n, `$${dec2.format(Math.abs(n))}`);
}

/** Fraction → 29.8 % */
export function pct(n: N, digits = 1): string {
  if (!ok(n)) return DASH;
  const r = Number((n * 100).toFixed(digits));
  return sign(r, `${Math.abs(r).toFixed(digits)}${NNBSP}%`);
}

/** Points → +0.4 pts / −0.6 pts */
export function pts(n: N, digits = 1): string {
  if (!ok(n)) return DASH;
  const r = Number(n.toFixed(digits));
  if (r === 0) return `0.${'0'.repeat(digits)} pts`;
  return `${r > 0 ? '+' : MINUS}${Math.abs(r).toFixed(digits)} pts`;
}

/** Signed percentage change: +3.1 % / −2.0 % */
export function pctChange(n: N): string {
  if (!ok(n)) return DASH;
  const r = Number((n * 100).toFixed(1));
  if (r === 0) return `0.0${NNBSP}%`;
  return `${r > 0 ? '+' : MINUS}${Math.abs(r).toFixed(1)}${NNBSP}%`;
}

/** 1,240 lb */
export function volume(n: N, uom: Uom): string {
  if (!ok(n)) return DASH;
  return `${int.format(Math.round(n))} ${uom}`;
}

/** 38.6M (no unit of measure; the tile tag carries it). */
export function numberCompact(n: N): string {
  if (!ok(n)) return DASH;
  const a = Math.abs(n);
  if (a >= 1e6) return `${dec1.format(n / 1e6)}M`;
  if (a >= 1e4) return `${dec1.format(n / 1e3)}K`;
  return int.format(Math.round(n));
}

/** 38.6M ea */
export function volumeCompact(n: N, uom: Uom): string {
  if (!ok(n)) return DASH;
  const a = Math.abs(n);
  if (a >= 1e6) return `${dec1.format(n / 1e6)}M ${uom}`;
  if (a >= 1e4) return `${dec1.format(n / 1e3)}K ${uom}`;
  return `${int.format(Math.round(n))} ${uom}`;
}

export function count(n: N): string {
  if (!ok(n)) return DASH;
  return int.format(Math.round(n));
}

/** Direction for variance styling. Positive is good unless `invert` (e.g. loss up is bad). */
export function tone(n: N, invert = false): 'pos' | 'neg' | 'flat' {
  if (!ok(n) || Math.abs(n) < 1e-9) return 'flat';
  return (n > 0) !== invert ? 'pos' : 'neg';
}

/** Short fiscal week label for chart axes: "W12", or "FY25 W40" when it is not the latest year shown. */
/** Chart axis label for a fiscal week: its week-beginning date (Sunday), MM/DD/YY. */
export function weekTick(w: number): string {
  const [mm, dd, yyyy] = formatDay(weekStartDay(w)).split('/');
  return `${mm}/${dd}/${yyyy.slice(2)}`;
}


/** Signed money: +$1.2K / −$350 */
export function signedMoney(n: N, compact = true): string {
  if (!ok(n)) return DASH;
  const s = (compact ? moneyCompact : money)(Math.abs(n));
  if (Math.abs(n) < 0.5) return '$0';
  return `${n > 0 ? '+' : MINUS}${s}`;
}

// ---------------------------------------------------------------- Chart axes

/** Round axis ticks (0, 50K, 100K…): about `target` steps of 1, 2, 2.5 or 5 × 10^k covering [min, max] and zero. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  const lo = Math.min(0, Number.isFinite(min) ? min : 0);
  const hi = Math.max(0, Number.isFinite(max) ? max : 0);
  if (hi - lo <= 0) return [0, 1];
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** 260.0 → "260", 2.50 → "2.5". */
function trimNumber(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

/** Axis money with no leftover ".0": $260K, $1.5M, $20M, $950. */
export function moneyAxis(n: number): string {
  if (!Number.isFinite(n)) return DASH;
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${trimNumber(a / 1e9, 1)}B` : a >= 1e6 ? `$${trimNumber(a / 1e6, 1)}M` : a >= 1e3 ? `$${trimNumber(a / 1e3, 1)}K` : `$${int.format(Math.round(a))}`;
  return sign(n, s);
}

/** Axis volume with no leftover ".0": 3,600 ea, 12K lb. */
export function volumeAxis(n: number, uom: Uom): string {
  if (!Number.isFinite(n)) return DASH;
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${trimNumber(a / 1e6, 1)}M` : a >= 1e4 ? `${trimNumber(a / 1e3, 1)}K` : int.format(Math.round(a));
  return `${n < 0 ? MINUS : ''}${s} ${uom}`;
}
