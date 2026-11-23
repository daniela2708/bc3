/**
 * README tables generated from definitions.ts, so the README, the KPI definitions dialog and the code never drift.
 * readme.test.ts fails when the README tables differ from these; the failure message prints the expected table.
 */
import { KPI_DEFINITIONS, kpiStatus, OPEN_QUESTIONS } from './definitions';
import { TABS } from './filters';
import { AFFECTS, BLOCK_LABEL, SETTING_LABEL, type SettingKey } from './settings';

/** Markdown table cell: pipes escaped, line breaks flattened. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

/** "View → KPI → definition" traceability table, one row per KPI and view. */
export function traceabilityTable(): string {
  const lines = ['| View | KPI | Priority | Definition (workbook) | Calculation (workbook) | Prototype note | Status |', '|---|---|---|---|---|---|---|'];
  for (const tab of TABS) {
    for (const d of KPI_DEFINITIONS.filter((k) => k.views.includes(tab.id))) {
      lines.push(`| ${tab.label} | ${cell(d.name)} | ${d.priority} | ${cell(d.definition)} | ${cell(d.formula)} | ${cell(d.note ?? '')} | ${cell(kpiStatus(d))} |`);
    }
  }
  return lines.join('\n');
}

/** Layout rules 5 and 6: which blocks each calculation setting changes in each view, and where the control lives. */
export function settingsTable(): string {
  const lines = ['| View | Control | Where it lives | Blocks it changes (each shows the tag) |', '|---|---|---|---|'];
  for (const tab of TABS) {
    const uses = AFFECTS[tab.id];
    const keys = (['baseline', 'basis', 'cann'] as SettingKey[]).filter((k) => uses[k]);
    if (tab.id === 'hotbuy' || tab.id === 'other') lines.push(`| ${tab.label} | Rows | Table header | Table only (no tag) |`);
    if (keys.length === 0) lines.push(`| ${tab.label} | — | — | No calculation setting |`);
    for (const k of keys) {
      const u = uses[k]!;
      const where = u.blocks.length > 1 ? 'Calculation settings bar' : `${BLOCK_LABEL[u.blocks[0]]} header`;
      lines.push(`| ${tab.label} | ${SETTING_LABEL[k]} | ${where} | ${u.blocks.map((b) => BLOCK_LABEL[b]).join(', ')} |`);
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
