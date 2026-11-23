/**
 * Plain-language glossary: the only place these texts live. <Term id="…"> shows them in a popover (once per view,
 * on the first appearance of the term) and the KPI definitions dialog lists them under "Glossary".
 */
export type TermId =
  | 'event'
  | 'priceGroup'
  | 'baseline'
  | 'lift'
  | 'incremental'
  | 'cannibalization'
  | 'halo'
  | 'cannLevel'
  | 'netIncremental'
  | 'categoryIncremental'
  | 'bridge'
  | 'netCustomerSales'
  | 'grossSales'
  | 'salesBasis'
  | 'eaLb'
  | 'postPromoDip'
  | 'promoRun'
  | 'level2'
  | 'definitionPending'
  | 'promoIntensity';

export interface GlossaryEntry {
  term: string;
  text: string;
}

export const GLOSSARY: Record<TermId, GlossaryEntry> = {
  event: {
    term: 'Event',
    text: "One run of a promotion: one price group, one promo type, a start and end date, and its promo and regular price. If the same item is promoted again later, that's a new event. Every metric is calculated per event.",
  },
  priceGroup: {
    term: 'Price group',
    text: 'Items that are always promoted together at the same price, like all flavors of one product. Tables start at the price group and open to show each SKU.',
  },
  baseline: {
    term: 'Baseline',
    text: 'What the item would have sold without the promotion: its average daily sales in the weeks before the promo, times the promo days. Proposed default: 4 weeks for Hot Buys, 13 for other promotions (#4).',
  },
  lift: { term: 'Lift', text: 'How much more the promoted item sold than its baseline, in percent.' },
  incremental: { term: 'Incremental', text: 'Extra sales, units or margin above the baseline during the promotion.' },
  cannibalization: {
    term: 'Cannibalization',
    text: "Sales that similar items lost while the promoted item was on sale. We compare those items' sales during the promo with their baseline: a drop is cannibalization (negative).",
  },
  halo: { term: 'Halo', text: 'The opposite of cannibalization: similar items sold more during the promotion (positive).' },
  cannLevel: {
    term: 'Cannibalization level',
    text: 'Which items count as similar to the promoted price group: Subcategory (default), Brand, Brand-category or Category. Always the same unit of measure, never the promoted price group itself. Still open (#3).',
  },
  netIncremental: {
    term: 'Net incremental',
    text: "What the promotion really added: the promoted item's incremental sales or margin minus what similar items lost.",
  },
  categoryIncremental: {
    term: 'Category incremental',
    text: 'How much the whole category grew during the promotion, including the promoted items. It does not depend on the cannibalization level.',
  },
  bridge: {
    term: 'Bridge',
    text: 'Shows step by step whether the promotion grew the category or just moved sales around: promoted item lift, minus cannibalization, equals net incremental; plus the rest of the category equals category incremental.',
  },
  netCustomerSales: { term: 'Net Customer Sales', text: 'Sales after item and non-item discounts. The sales used by default, from the use case 1 table (#5).' },
  grossSales: { term: 'Gross Sales', text: 'Sales before discounts.' },
  salesBasis: {
    term: 'Sales basis',
    text: 'Which sales the margin and lift use: Net Customer Sales (default) or Gross Sales. The GM % denominator is still open (#5).',
  },
  eaLb: {
    term: 'ea / lb',
    text: 'ea (each) counts items sold by unit; lb counts pounds for random weight items, like meat or produce sold by the pound. They are never added together.',
  },
  postPromoDip: {
    term: 'Post-Promo Dip (pantry loading)',
    text: 'Change in units in the 4 weeks after the promotion vs. baseline. A drop suggests shoppers stocked up during the promo and bought less afterward.',
  },
  promoRun: { term: 'Promo run', text: 'The same promotion (price group and promo type) repeated over time. Promo Run Trend compares the runs side by side.' },
  level2: { term: 'Level 2', text: 'Useful, but not part of the first version (MVP).' },
  definitionPending: {
    term: 'Definition pending #N',
    text: 'The business still has to confirm this definition. N is the question number in the open questions list.',
  },
  promoIntensity: {
    term: 'Promo intensity',
    text: 'Average share of a category’s items on offer per day of the period. High intensity means shoppers see the category on deal most of the time.',
  },
};

export const TERM_IDS = Object.keys(GLOSSARY) as TermId[];
