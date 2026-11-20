/**
 * README tables generated from definitions.ts, so the README, the KPI definitions dialog and the code never drift.
 * readme.test.ts fails when the README tables differ from these; the failure message prints the expected table.
 */
import { KPI_DEFINITIONS, kpiStatus, OPEN_QUESTIONS } from './definitions';
import { TABS } from './filters';

/** Markdown table cell: pipes escaped, line breaks flattened. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

/** "View → KPI → definition" traceability table, one row per KPI and view. */
export function traceabilityTable(): string {
  const lines = ['| View | KPI | Priority | Definition | Calculation | Status |', '|---|---|---|---|---|---|'];
  for (const tab of TABS) {
    for (const d of KPI_DEFINITIONS.filter((k) => k.views.includes(tab.id))) {
      lines.push(`| ${tab.label} | ${cell(d.name)} | ${d.priority} | ${cell(d.definition)} | ${cell(d.formula)} | ${cell(kpiStatus(d))} |`);
    }
  }
  return lines.join('\n');
}

/** Open questions and the assumption the prototype uses. */
export function assumptionsTable(): string {
  const lines = ['| # | Status | Item | Assumption in the prototype |', '|---|---|---|---|'];
  for (const q of OPEN_QUESTIONS) lines.push(`| ${q.id ?? '—'} | ${q.status} | ${cell(q.title)} | ${cell(q.assumption)} |`);
  return lines.join('\n');
}
