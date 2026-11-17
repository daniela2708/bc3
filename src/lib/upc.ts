/**
 * UPC / PLU helpers and the parser for pasted code lists. Pure functions only.
 * Accepted codes: PLU (4 or 5 digits), UPC-A (12 digits) and EAN-13 (13 digits), both with a valid GS1 check digit.
 */

export const PASTE_MAX_CHARS = 4000;
export const PASTE_MAX_CODES = 200;

/** GS1 mod-10 check digit for the digits before the check digit. */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const n = body.charCodeAt(body.length - 1 - i) - 48;
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d{12,13}$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

export function isPlu(code: string): boolean {
  return /^\d{4,5}$/.test(code);
}

/** Builds a UPC-A from an 11-digit body by appending the check digit. */
export function upcA(body11: string): string {
  if (!/^\d{11}$/.test(body11)) throw new Error('UPC body must be 11 digits');
  return body11 + gs1CheckDigit(body11);
}

/** EAN-13 with a leading zero is the same item as its UPC-A. */
export function normalizeCode(code: string): string {
  return code.length === 13 && code.startsWith('0') ? code.slice(1) : code;
}

export interface ParsedCodes {
  /** Distinct valid codes, normalized (EAN-13 with a leading 0 becomes UPC-A), in input order. */
  valid: string[];
  /** Tokens that are not a PLU, UPC-A or EAN-13 (shown back to the user, truncated). */
  invalid: string[];
  /** True when the input had more than PASTE_MAX_CODES valid codes or more than PASTE_MAX_CHARS characters. */
  truncated: boolean;
  duplicates: number;
}

/**
 * Parses a pasted list. Separators: spaces, new lines, commas, semicolons and tabs. Never throws; anything other
 * than a string returns an empty result.
 */
export function parseCodeList(raw: unknown): ParsedCodes {
  const out: ParsedCodes = { valid: [], invalid: [], truncated: false, duplicates: 0 };
  if (typeof raw !== 'string') return out;
  let text = raw;
  if (text.length > PASTE_MAX_CHARS) {
    text = text.slice(0, PASTE_MAX_CHARS);
    out.truncated = true;
  }
  const seen = new Set<string>();
  for (const token of text.split(/[\s,;]+/)) {
    if (!token) continue;
    const t = token.trim();
    if (!(isPlu(t) || isValidGtin(t))) {
      if (out.invalid.length < 20) out.invalid.push(t.slice(0, 20));
      continue;
    }
    const code = normalizeCode(t);
    if (seen.has(code)) {
      out.duplicates++;
      continue;
    }
    if (out.valid.length >= PASTE_MAX_CODES) {
      out.truncated = true;
      break;
    }
    seen.add(code);
    out.valid.push(code);
  }
  return out;
}
