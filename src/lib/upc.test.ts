import { describe, expect, it } from 'vitest';
import { gs1CheckDigit, isPlu, isValidGtin, normalizeCode, parseCodeList, PASTE_MAX_CHARS, PASTE_MAX_CODES, upcA } from './upc';

describe('UPC check digits', () => {
  it('computes the GS1 check digit', () => {
    expect(gs1CheckDigit('03600029145')).toBe(2);
    expect(upcA('03600029145')).toBe('036000291452');
  });
  it('validates UPC-A and EAN-13, rejects a wrong check digit', () => {
    expect(isValidGtin('036000291452')).toBe(true);
    expect(isValidGtin('036000291453')).toBe(false);
    expect(isValidGtin('0036000291452')).toBe(true);
    expect(isValidGtin('03600029145')).toBe(false);
    expect(isValidGtin('03600029145a')).toBe(false);
  });
  it('rejects a malformed body when building a UPC', () => {
    expect(() => upcA('123')).toThrow();
  });
  it('accepts 4- and 5-digit PLUs only', () => {
    expect(isPlu('4011')).toBe(true);
    expect(isPlu('21101')).toBe(true);
    expect(isPlu('401')).toBe(false);
    expect(isPlu('401100')).toBe(false);
  });
  it('treats an EAN-13 with a leading zero as its UPC-A', () => {
    expect(normalizeCode('0036000291452')).toBe('036000291452');
  });
});

describe('parseCodeList', () => {
  it('splits on new lines, commas, semicolons, tabs and spaces', () => {
    expect(parseCodeList('036000291452,4011;21101\t0036000291452 3283').valid).toEqual(['036000291452', '4011', '21101', '3283']);
  });
  it('reports invalid tokens, including markup, without keeping them as codes', () => {
    const r = parseCodeList('<script>alert(1)</script> 12345 abc 036000291453');
    expect(r.valid).toEqual(['12345']);
    expect(r.invalid).toEqual(['<script>alert(1)</sc', 'abc', '036000291453']);
  });
  it('counts duplicates once', () => {
    const r = parseCodeList('4011 4011 4011');
    expect(r.valid).toEqual(['4011']);
    expect(r.duplicates).toBe(2);
  });
  it('returns an empty result for empty or non-string input', () => {
    expect(parseCodeList('').valid).toEqual([]);
    expect(parseCodeList('   \n ').valid).toEqual([]);
    expect(parseCodeList(undefined).valid).toEqual([]);
    expect(parseCodeList(12345).valid).toEqual([]);
    expect(parseCodeList({ toString: () => '4011' }).valid).toEqual([]);
  });
  it('caps the number of codes and the input length', () => {
    const many = Array.from({ length: PASTE_MAX_CODES + 50 }, (_, i) => String(10000 + i)).join(' ');
    const r = parseCodeList(many);
    expect(r.valid.length).toBe(PASTE_MAX_CODES);
    expect(r.truncated).toBe(true);
    const long = parseCodeList('4011 '.padEnd(PASTE_MAX_CHARS + 500, 'x'));
    expect(long.truncated).toBe(true);
    expect(long.valid).toEqual(['4011']);
  });
  it('caps the list of invalid tokens it reports', () => {
    expect(parseCodeList(Array.from({ length: 100 }, () => 'bad').join(' ')).invalid.length).toBe(20);
  });
});
