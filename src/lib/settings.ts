/**
 * Calculation settings (layout rules 5 and 6): which blocks of each view a control changes, the "Affects: …" text of
 * its (i) and the tag each affected block shows with the active value. Single source for the settings bar, the tags
 * and the README table. Read from the code that each block uses (scope.ctx baseline and cannibalization level, and
 * the sales basis passed to derive / the charts).
 */
import { effectiveBaseline, viewBaselineDefault, type BaselineSetting } from './baseline';
import type { FilterState, TabId } from './filters';
import { CANN_LEVELS, DEFAULT_BASIS, DEFAULT_CANN_LEVEL } from './metrics';

export type SettingKey = 'baseline' | 'basis' | 'cann';
export type BlockId = 'tiles' | 'salesChart' | 'unitsChart' | 'bridge' | 'table' | 'runs' | 'liftChart' | 'netIncChart' | 'periodChart' | 'depthCharts' | 'adCharts' | 'heatmap' | 'panels';

export const SETTING_LABEL: Record<SettingKey, string> = { baseline: 'Baseline window', basis: 'Sales basis', cann: 'Cannibalization level' };

export interface SettingUse {
  blocks: BlockId[];
  /** What the control changes in this view, shown after "Affects: ". */
  text: string;
}

/** Per view: the blocks each setting changes. A setting with no entry is not shown in that view. */
export const AFFECTS: Record<TabId, Partial<Record<SettingKey, SettingUse>>> = {
  hotbuy: {
    baseline: { blocks: ['tiles', 'salesChart', 'bridge', 'table'], text: 'key figures (Promo Units baseline, Sales / Unit Lift %, Incremental GM $, Net Incremental GM $, Hot Buy Score), the sales vs. baseline chart, the category bridge and the baseline, lift, incremental, cannibalization and net columns of the table.' },
    basis: { blocks: ['tiles', 'salesChart', 'bridge', 'table'], text: 'key figures (Promo Sales $ order, Sales Lift %, Promo GM $ / %, Incremental GM $, Net Incremental GM $, Hot Buy Score), the sales vs. baseline chart, the category bridge and the sales, lift and margin columns of the table.' },
    cann: { blocks: ['tiles', 'bridge', 'table'], text: 'the Net Incremental GM $ and Hot Buy Score key figures, the Cannibalization step of the category bridge and the Cannibalized Sales $, Cannibalization Rate %, Net Incremental Sales $, Net Incremental GM $ and Hot Buy Score columns of the table.' },
  },
  other: {
    baseline: { blocks: ['tiles', 'salesChart', 'bridge', 'table', 'runs'], text: 'key figures (Promo Units baseline, Sales / Unit Lift %, Incremental GM $, Net Incremental GM $), the sales vs. baseline chart, the category bridge, the baseline, lift, incremental, cannibalization and net columns of the table and the runs of the same promo.' },
    basis: { blocks: ['tiles', 'salesChart', 'bridge', 'table', 'runs'], text: 'key figures (Promo Sales $ order, Sales Lift %, Promo GM $ / %, Incremental GM $, Net Incremental GM $), the sales vs. baseline chart, the category bridge, the sales, lift and margin columns of the table and the runs of the same promo.' },
    cann: { blocks: ['tiles', 'bridge', 'table', 'runs'], text: 'the Net Incremental GM $ key figure, the Cannibalization step of the category bridge, the cannibalization and net columns of the table and the Net Incremental GM $ row of the runs of the same promo.' },
  },
  post: {
    baseline: { blocks: ['tiles', 'unitsChart', 'salesChart', 'table'], text: 'the Post-Promo Dip % key figure, both vs. baseline charts and the Post-Promo Dip % column of the summary table.' },
    // One block only (layout rule 5): this control lives in the sales chart header.
    basis: { blocks: ['salesChart'], text: 'the sales vs. baseline chart only.' },
  },
  funding: {},
  history: {
    baseline: { blocks: ['tiles', 'periodChart', 'depthCharts', 'adCharts', 'heatmap', 'table'], text: 'key figures (Sales Lift %, Unit Lift %, Incremental GM $, Net Incremental GM $), the results by period or week, the charts by Promo Depth Band and by Ad Type / Vehicle, the timing heat map and the lift and margin columns of the table.' },
    basis: { blocks: ['tiles', 'periodChart', 'depthCharts', 'adCharts', 'heatmap', 'table'], text: 'key figures (Avg Promo Retail $, Sales Lift %, Incremental GM $, Net Incremental GM $), the results by period or week, the charts by Promo Depth Band and by Ad Type / Vehicle, the timing heat map and the sales, lift and margin columns of the table.' },
    cann: { blocks: ['tiles', 'periodChart', 'depthCharts', 'adCharts', 'heatmap', 'table'], text: 'the Net Incremental GM $ key figure, the Net Incremental GM $ of the results by period or week, of the charts by depth band and ad type and of the timing heat map, and the Net Incremental GM $ column of the table.' },
  },
  shopper: {
    baseline: { blocks: ['tiles', 'panels', 'table'], text: 'the "usual" behaviour of the same buyers (spend change and every vs. usual comparison) in the key figures, the event panels and the table.' },
  },
  trend: {
    baseline: { blocks: ['tiles', 'liftChart', 'netIncChart', 'table'], text: 'key figures (Sales / Unit Lift %, Net Incremental GM $), the lift and Net Incremental GM $ charts and the lift, incremental, net and Post-Promo Dip % rows of the runs table.' },
    basis: { blocks: ['tiles', 'liftChart', 'netIncChart', 'table'], text: 'key figures (Promo GM $ / %, Sales / Unit Lift %, Net Incremental GM $), the lift and Net Incremental GM $ charts and the sales, lift and margin rows of the runs table.' },
    cann: { blocks: ['tiles', 'netIncChart', 'table'], text: 'the Net Incremental GM $ key figure, the Net Incremental GM $ per run chart and the Net Incremental GM $ row of the runs table.' },
  },
};

/** Block names for the README table. */
export const BLOCK_LABEL: Record<BlockId, string> = {
  tiles: 'Key figures',
  salesChart: 'Sales vs. baseline chart',
  unitsChart: 'Units vs. baseline chart',
  bridge: 'Category bridge',
  table: 'Table',
  runs: 'Runs of the same promo',
  liftChart: 'Lift across runs',
  netIncChart: 'Net Incremental GM $ per run',
  periodChart: 'Results by period / week',
  depthCharts: 'Charts by Promo Depth Band',
  adCharts: 'Charts by Ad Type / Vehicle',
  heatmap: 'Promotion timing heat map',
  panels: 'Layout proposal (charts and cards)',
};

const ORDER: SettingKey[] = ['baseline', 'basis', 'cann'];

/** "Affects: …" for a control in a view, or undefined when the control is not used there. */
export function affectsText(tab: TabId, key: SettingKey): string | undefined {
  const u = AFFECTS[tab][key];
  return u ? `Affects: ${u.text}` : undefined;
}

/** Settings shown in the "Calculation settings" bar: the ones that change more than one block of the view. */
export function barSettings(tab: TabId): SettingKey[] {
  return ORDER.filter((k) => (AFFECTS[tab][k]?.blocks.length ?? 0) > 1);
}

/** Settings that live inside one block's header because they change only that block. */
export function blockSettings(tab: TabId, block: BlockId): SettingKey[] {
  return ORDER.filter((k) => AFFECTS[tab][k]?.blocks.length === 1 && AFFECTS[tab][k]!.blocks[0] === block);
}

export interface ActiveTag {
  key: SettingKey;
  text: string;
  changed: boolean;
  /** The "Affects: …" explanation, shown on hover or focus. */
  affects: string;
}

const baselineWord = (b: BaselineSetting) => (b === 'byType' ? 'by promo type' : `${b} wk`);
const baselineDefault = (b: BaselineSetting) => (b === 'byType' ? 'by promo type' : String(b));
const levelLabel = (id: string) => CANN_LEVELS.find((l) => l.id === id)!.label;

/** The tag of one setting with its active value; highlighted and explicit when it differs from the default. */
export function activeTag(tab: TabId, key: SettingKey, s: Pick<FilterState, 'baseline' | 'basis' | 'level'>): ActiveTag {
  const affects = affectsText(tab, key) ?? '';
  if (key === 'baseline') {
    const def = viewBaselineDefault(tab);
    const cur = effectiveBaseline(tab, s.baseline);
    const changed = cur !== def;
    return { key, affects, changed, text: changed ? `Baseline ${baselineWord(cur)} (default ${baselineDefault(def)})` : `Baseline ${baselineWord(cur)}` };
  }
  if (key === 'basis') {
    const changed = s.basis !== DEFAULT_BASIS;
    return { key, affects, changed, text: changed ? 'Gross Sales (default Net Customer)' : 'Net Customer Sales' };
  }
  const changed = s.level !== DEFAULT_CANN_LEVEL;
  return { key, affects, changed, text: changed ? `${levelLabel(s.level)} level (default ${levelLabel(DEFAULT_CANN_LEVEL)})` : `${levelLabel(s.level)} level` };
}

/** Tags a block shows: one per setting that changes it, none when no setting does. */
export function tagsFor(tab: TabId, block: BlockId, s: Pick<FilterState, 'baseline' | 'basis' | 'level'>): ActiveTag[] {
  return ORDER.filter((k) => AFFECTS[tab][k]?.blocks.includes(block)).map((k) => activeTag(tab, k, s));
}
