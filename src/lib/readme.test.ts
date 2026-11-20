import { describe, expect, it } from 'vitest';
import { KPI_DEFINITIONS, OPEN_QUESTIONS } from './definitions';
import { assumptionsTable, traceabilityTable } from './readme';
// Vite raw import: the README as text, with no Node.js types needed.
import README from '../../README.md?raw';

describe('README stays generated from definitions.ts', () => {
  it('has the traceability table', () => {
    expect(README).toContain(traceabilityTable());
  });
  it('has the open questions table', () => {
    expect(README).toContain(assumptionsTable());
  });
});

describe('workbook naming rules', () => {
  const texts = [README, ...KPI_DEFINITIONS.flatMap((d) => [d.name, d.definition, d.formula, d.status ?? '']), ...OPEN_QUESTIONS.flatMap((q) => [q.title, q.assumption])];
  it('names the workbook without a version and the funding tool "DNP tool"', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/_v\d+\.xlsx|DMP/);
    }
    expect(README).toContain('UC3_KPIs_Definitions_and_Mapping.xlsx');
  });
  it('mentions no meeting dates and no removed question numbers', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/Nov(ember)? 1[78]|renumbered|#19\b/);
    }
  });
  it('uses only the tracker status values', () => {
    for (const q of OPEN_QUESTIONS) {
      expect(['Open', 'Waiting on reply', 'Partly answered', 'Answered', 'Note']).toContain(q.status);
      expect(q.status === 'Note').toBe(q.id === null);
    }
  });
});
