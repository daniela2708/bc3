/**
 * Business context of each view: priority, the question it answers, the user story from the requirements workbook and
 * what is still to validate (open question numbers). Shown in the "KPI definitions" dialog, not on top of the views
 * (layout rule 2: a view starts with its title and its key figures).
 */
import type { Priority } from './definitions';
import type { TabId } from './filters';

export interface ViewInfo {
  /** One line under the view title: what the view answers (layout rule 4). Not the user story. */
  objective: string;
  priority: Priority;
  /** Extra note next to the priority, e.g. the open question that set it. */
  priorityNote?: string;
  question: string;
  story: string;
  validate: string;
}

export const VIEW_INFO: Record<TabId, ViewInfo> = {
  hotbuy: {
    objective: 'Did each Hot Buy lift sales and margin above baseline, and how much of that came from other items?',
    priority: 'Must Have',
    question: 'Did each Hot Buy pay off, for the item and for the category?',
    story:
      'As a Category Manager, I want to track the effectiveness of Hot Buys starting at the price group level, with the ability to drill down to each item and roll up to category (including cannibalization), so that I can make better decisions on when to run certain promotions for certain items.',
    validate: 'Baseline (#4), cannibalization (#3), sales basis and GM % denominator (#5), margin scope and funding (#7), cost (#15).',
  },
  other: {
    objective: 'Did TPRs, BOGOs, price locks and other temporary price reductions lift sales and margin above baseline, and how much came from other items?',
    priority: 'Must Have',
    question: 'How did TPRs, BOGOs, price locks and other reductions perform, and which items drove the result?',
    story:
      'As a Category Manager, I want to track TPRs, BOGOs, price locks and other promotions by price group, with item-level drill down and a category-level view, so that I can evaluate overall program performance, see which items drive the result (e.g., seasonal vs. everyday items), and adjust future runs and orders.',
    validate: 'Baseline (#4), cannibalization (#3), sales basis and GM % denominator (#5), margin scope and funding (#7), cost (#15).',
  },
  post: {
    objective: 'What happens to units and sales in the 4 weeks after a promotion ends (pantry loading).',
    priority: 'Nice to have',
    priorityNote: 'Level 2 · not MVP, #8',
    question: 'What happens to the item after the promotion ends: pantry loading and repeat purchases?',
    story:
      'No user story of its own in the workbook. Post-Promo Dip % comes from user story 3 (Promo Run Trend) and Repeat Purchase Rate % from user story 6 (Promo Shopper Impact).',
    validate:
      'Post-Promo Trend and Post-Promo Dip % are level 2, with a 4-week post-promo window (#8). Repeat Purchase Rate % uses the window CMs use today; the prototype uses 28 days; household vs. card level (#16). Baseline (#4): each event uses the proposed default of its promo type.',
  },
  trend: {
    objective: 'How the same promotion performs from one run to the next, and vs. last year.',
    priority: 'Must Have',
    priorityNote: '#8',
    question: 'Is the same promotion trending up or down each time it runs?',
    story:
      'As a Category Manager, I want to compare how the same promotion performs each time it runs (e.g., a Hot Buy run in Q1, Q2 and Q3, and vs. prior years) at the price group level down to the item level, so that I can see whether it is trending up or down and adjust future runs.',
    validate: 'Baseline (#4), sales basis and GM % denominator (#5), margin scope and funding (#7), cost (#15). Last Year Gross Sales and YoY growth reuse the UC1 definition.',
  },
  funding: {
    objective: 'Not part of this dashboard: vendor funding analytics live in the DNP tool (#2).',
    priority: 'Should Have',
    priorityNote: 'not in this dashboard, #2',
    question: 'How much of each promotion do vendors fund?',
    story:
      'As a Category manager I want to be able to track promo spend by vendor and category down to the item level so that I can efficiently track how much of my promotions are vendor funded.',
    validate:
      'Not part of this dashboard: vendor funding analytics live in the DNP tool (#2). The tab is a notice with no numbers. Vendor Promo Funding $ is still an input to Net GM $ and Net Incremental GM $ (#7); where Promo Investment $ belongs is pending.',
  },
  history: {
    objective: 'Every past promotion for an item or price group, and how results change with discount depth and ad type.',
    priority: 'Should Have',
    question: 'When, how deep and with which ad type should this item be promoted?',
    story: 'As a Category Manager, I want to review historical promotions for the same items so that I can determine the best times / depths / ad types to run the promotion.',
    validate:
      'Ad Type / Vehicle and Promo Depth Band values follow the workbook; the objective of this view is pending (#10). Baseline (#4): each event uses the proposed default of its promo type. Margin scope and funding (#7), cost (#15).',
  },
  shopper: {
    objective: 'Did promotions bring more or new shoppers and bigger baskets? Club Card aggregates only.',
    priority: 'Should Have',
    question: 'Did the promotion grow baskets and the category, not just the promoted item?',
    story:
      'As a Category Manager I want to see how shoppers who bought my promoted items behaved (basket size, spend vs. their usual, new-to-category buyers and category trips) so that I can tell whether a promotion grew baskets and the category, not just the promoted item.',
    validate:
      'Symphony AI cannot be a data source, only a reference for comparison (#12); shopper metrics are calculated from the Weis T-log and Club Card tables. Household vs. card level per metric (#16). New-to-category logic from a third-party system (#11). About 6 to 8 core metrics, which ones pending (#9). Rewards and loyalty campaigns are out of scope.',
  },
};
