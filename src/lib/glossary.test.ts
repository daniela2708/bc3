import { describe, expect, it } from 'vitest';
import { GLOSSARY, TERM_IDS } from './glossary';

/** Every source file of the app, as text (Vite raw import; no Node.js APIs needed). */
const SOURCES = import.meta.glob('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SOURCES_TS = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function usedIds(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const add = (id: string, file: string) => used.set(id, [...(used.get(id) ?? []), file]);
  for (const [file, text] of Object.entries({ ...SOURCES, ...SOURCES_TS })) {
    if (file.endsWith('.test.ts') || file.endsWith('glossary.ts')) continue;
    for (const m of text.matchAll(/<Term id="([^"]+)"/g)) add(m[1], file);
    for (const m of text.matchAll(/\bterm: '([^']+)'/g)) add(m[1], file);
    if (/<Pending [^>]*\bterm\b/.test(text)) add('definitionPending', file);
    if (/<Level2 term\b/.test(text)) add('level2', file);
  }
  return used;
}

describe('glossary', () => {
  it('every id used with <Term> exists in the glossary', () => {
    const used = usedIds();
    expect(used.size).toBeGreaterThan(10);
    for (const id of used.keys()) expect(TERM_IDS, `unknown term id "${id}"`).toContain(id);
  });
  it('every glossary term is used somewhere in the app', () => {
    const used = usedIds();
    for (const id of TERM_IDS) expect(used.has(id), `term "${id}" is never shown`).toBe(true);
  });
  it('has a plain-language text for every term, with no meeting dates', () => {
    for (const id of TERM_IDS) {
      expect(GLOSSARY[id].term.length).toBeGreaterThan(1);
      expect(GLOSSARY[id].text.length).toBeGreaterThan(20);
      expect(GLOSSARY[id].text).not.toMatch(/Nov(ember)? 1\d/);
    }
  });
});
