/**
 * KPI definitions from the requirements workbook "UC3_KPIs_Definitions_and_Mapping_v3.xlsx" (UC3 Promo
 * Effectiveness, updated with the UC3 Technical Requirements review of Nov 17, 2026), the views that show them and
 * the open questions with the assumption the prototype uses. Question numbers follow the workbook tab
 * "UC #3 - Open Questions". Shown in the KPI definitions dialog and in the README.
 */
import type { TabId } from './filters';

export type Priority = 'Must Have' | 'Should Have' | 'Nice to have';

export interface KpiDef {
  id: string;
  name: string;
  unit: string;
  priority: Priority;
  definition: string;
  formula: string;
  views: TabId[];
  /** Main open question number when the definition is pending business confirmation. */
  pending?: number;
  /** Other open questions the definition also depends on. */
  alsoPending?: number[];
  /** Level 2: agreed as useful but not part of the MVP. */
  level2?: boolean;
  /** Source status when the KPI is not a row of the workbook's KPI sheet. */
  status?: string;
}

const PERF: TabId[] = ['hotbuy', 'other'];
const STORY3 = 'User story 3 (no KPI row yet)';

export const KPI_DEFINITIONS: KpiDef[] = [
  { id: 'gross', name: 'Total Gross Sales', unit: '$', priority: 'Must Have', definition: 'Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC2, applied to the promo period.', formula: 'SUM(Gross Sales) of the promoted items, promo start to end date', views: ['hotbuy', 'other', 'trend'] },
  { id: 'net', name: 'Total Net Customer Sales', unit: '$', priority: 'Must Have', definition: 'Promo Sales $ after discounts (coupons and other customer discounts). Default sales basis for lift, incremental and margin; the Sales basis control switches to Gross Sales.', formula: 'Gross Sales − Discounts', views: ['hotbuy', 'other'] },
  { id: 'units', name: 'Promo Units / Total Volume', unit: 'units', priority: 'Must Have', definition: 'Units sold of the promoted item(s) on the days the promotion is active. Random-weight items (Meat, loose Produce) count pounds; each and pounds are never added together.', formula: 'SUM(units) where sale date is between promo start and end date', views: ['hotbuy', 'other', 'trend'] },
  { id: 'baseSales', name: 'Baseline Sales $', unit: '$', priority: 'Must Have', definition: 'Expected sales dollars of the promoted item if it had not been on promotion.', formula: 'Average daily sales of the N weeks before the promo (default 4, adjustable) × promo days', views: PERF, pending: 4 },
  { id: 'baseUnits', name: 'Baseline Units', unit: 'units', priority: 'Must Have', definition: 'Expected units of the promoted item if it had not been on promotion.', formula: 'Same method as Baseline Sales $, using units', views: PERF, pending: 4 },
  { id: 'incSales', name: 'Incremental Sales $ / Units', unit: '$ / units', priority: 'Must Have', definition: 'Extra sales dollars (units) above baseline during the promotion.', formula: 'Promo Sales $ − Baseline Sales $ ; Promo Units − Baseline Units', views: PERF },
  { id: 'salesLift', name: 'Sales Lift %', unit: '%', priority: 'Must Have', definition: 'Percent increase in sales dollars vs. baseline.', formula: 'Incremental Sales $ ÷ Baseline Sales $', views: ['hotbuy', 'other', 'trend', 'history'] },
  { id: 'unitLift', name: 'Unit Lift %', unit: '%', priority: 'Must Have', definition: 'Percent increase in units vs. baseline.', formula: 'Incremental Units ÷ Baseline Units', views: ['hotbuy', 'other', 'trend', 'history'] },
  { id: 'avgRetail', name: 'Avg Promo Retail $ (Average Retail Price per Unit)', unit: '$', priority: 'Nice to have', definition: 'Average selling price per unit (or lb) during the promotion.', formula: 'Promo Gross Sales $ ÷ Promo Units', views: ['history'] },
  { id: 'depth', name: 'Promo Depth %', unit: '%', priority: 'Should Have', definition: 'How deep the discount is vs. regular retail. BOGO counts as 50 %.', formula: '(Regular retail − Promo retail) ÷ Regular retail', views: ['history'] },
  { id: 'gm', name: 'Promo Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin dollars on the promoted item(s) during the promotion, before vendor promo funding. Same GM definition as UC2; the cost logic across departments is pending (#15).', formula: 'Promo Sales $ − Cost of goods sold for promo units', views: ['hotbuy', 'other', 'trend'], pending: 15 },
  { id: 'gmPct', name: 'Promo Gross Margin %', unit: '%', priority: 'Must Have', definition: 'Gross margin rate during the promotion. Ratio of totals. Denominator pending (#5); cost logic also pending (#15).', formula: 'Promo Gross Margin $ ÷ Promo Sales $ (Net Customer Sales by default)', views: ['hotbuy', 'other', 'trend'], pending: 5, alsoPending: [15] },
  { id: 'baseGm', name: 'Baseline Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin the item would have earned at regular price without the promotion.', formula: 'Baseline Units × (Regular retail − Unit cost), from the baseline window', views: PERF, pending: 4 },
  { id: 'incGm', name: 'Incremental Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin impact of the promotion vs. baseline, before vendor funding.', formula: 'Promo Gross Margin $ − Baseline Gross Margin $', views: ['hotbuy', 'other', 'trend', 'history'] },
  { id: 'netGm', name: 'Net Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin after adding all vendor promo funding for the event (scan-downs, bill-backs and other promo allowances). Vendor Promo Funding $ is an internal input here, not a KPI of its own.', formula: 'Promo Gross Margin $ + Vendor Promo Funding $', views: PERF, pending: 7 },
  { id: 'catInc', name: 'Category Incremental Sales $ / Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Change in total category sales (gross margin) vs. baseline during the promotion, including the promoted items.', formula: 'Σ category items (promo window − baseline)', views: PERF },
  { id: 'cann', name: 'Cannibalized Sales $', unit: '$', priority: 'Must Have', definition: 'Change in sales of non-promoted items in the same group vs. their baseline during the promotion. Negative = cannibalization, positive = halo. The group follows the Cannibalization level control (brand, brand-category or category; same unit of measure).', formula: 'Σ group items (promo window − baseline)', views: PERF, pending: 3 },
  { id: 'cannRate', name: 'Cannibalization Rate %', unit: '%', priority: 'Must Have', definition: "Share of the promoted item's incremental units that came from other items in the group. Negative = halo.", formula: '−Cannibalized Units ÷ Incremental Units', views: ['hotbuy'], pending: 3 },
  { id: 'netIncSales', name: 'Net Incremental Sales $', unit: '$', priority: 'Must Have', definition: 'Promoted item incremental sales after taking out sales lost from other items.', formula: 'Incremental Sales $ + Cannibalized Sales $', views: ['hotbuy'] },
  { id: 'netIncGm', name: 'Net Incremental Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Incremental gross margin after cannibalization and vendor funding. The main "did it pay off" number.', formula: 'Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $', views: ['hotbuy', 'other', 'trend', 'history'], pending: 7 },
  { id: 'eventCount', name: 'Promo Event Count', unit: '#', priority: 'Should Have', definition: 'Number of times an item or price group was promoted in the selected period.', formula: 'COUNT(promo events)', views: ['trend', 'history'] },
  { id: 'ly', name: 'Last Year Gross Sales', unit: '$', priority: 'Must Have', definition: 'Gross sales of the same items over the same days last year (364 days earlier, as in UC2).', formula: 'SUM(Gross Sales) for promo days − 364', views: ['trend'], status: STORY3 },
  { id: 'yoy', name: 'YoY Gross Sales Growth ($ / %)', unit: '$ / %', priority: 'Must Have', definition: 'Growth of promo gross sales vs. the same days last year.', formula: '$: TY − LY ; %: (TY − LY) ÷ LY', views: ['trend'], status: STORY3 },
  { id: 'dip', name: 'Post-Promo Dip %', unit: '%', priority: 'Nice to have', definition: 'Change in units in the 4 weeks after the promotion ends vs. baseline (pantry loading). Default window agreed Nov 17; whether it varies by promo type will be reviewed on the prototype. Shown as — until the 4 weeks have passed.', formula: '(Units in the 28 days after the promo − Baseline Units for the same days) ÷ Baseline Units', views: ['trend'], level2: true },
  { id: 'buyers', name: 'Promo Buyer Count', unit: '#', priority: 'Should Have', definition: 'Number of club card households that bought the promoted item during the promotion.', formula: 'COUNT DISTINCT club card households with a promo item purchase', views: ['shopper'], pending: 12 },
  { id: 'basket', name: 'Avg Basket Size $', unit: '$', priority: 'Should Have', definition: 'Average total transaction dollars for transactions that include the promoted item.', formula: 'Σ transaction $ ÷ transactions with the promo item', views: ['shopper'], pending: 12 },
  { id: 'spend', name: 'Promo Buyer Spend Change %', unit: '%', priority: 'Should Have', definition: "Promo buyers' spend during the event vs. their usual spend.", formula: 'Spend during the event ÷ usual spend − 1', views: ['shopper'], pending: 12 },
  { id: 'upb', name: 'Units per Basket', unit: 'units', priority: 'Nice to have', definition: 'Average units in transactions that include the promoted item.', formula: 'Σ units ÷ transactions with the promo item', views: ['shopper'], pending: 12 },
  { id: 'ntc', name: 'New-to-Category Buyers %', unit: '%', priority: 'Should Have', definition: 'Share of promo buyers who had not bought the category in the look-back period (52 weeks). The new-shopper logic comes from a third-party system (#11).', formula: 'New-to-category buyers ÷ Promo Buyer Count', views: ['shopper'], pending: 11, alsoPending: [12] },
  { id: 'trips', name: 'Category Trips', unit: '#', priority: 'Should Have', definition: 'Trips by promo buyers that included any item in the category, vs. their usual.', formula: 'COUNT(trips with a category item) by promo buyers', views: ['shopper'], pending: 12 },
  { id: 'txn', name: 'Transaction Count', unit: '#', priority: 'Nice to have', definition: 'Total store transactions during the promotion. Store traffic indicator.', formula: 'COUNT(transactions) on promo days', views: ['shopper'], pending: 12 },
  { id: 'repeat', name: 'Repeat Purchase Rate %', unit: '%', priority: 'Nice to have', definition: 'Share of promo buyers who bought the item again at regular price within 28 days after the promotion. Level 2 (not MVP).', formula: 'Repeat buyers ÷ Promo Buyer Count', views: ['shopper'], pending: 12, level2: true },
  { id: 'score', name: 'Hot Buy Score', unit: 'score', priority: 'Nice to have', definition: "Overall rating of a Hot Buy's success built from the core metrics. Scoring method to be defined; shown as a placeholder only.", formula: 'Scoring method to be defined', views: ['hotbuy'] },
];

/** Status line for a KPI, shared by the definitions dialog and the README traceability table. */
export function kpiStatus(d: KpiDef): string {
  const parts: string[] = [];
  if (d.status) parts.push(d.status);
  if (d.pending) parts.push(`Definition pending #${d.pending}${d.alsoPending?.length ? ` (also #${d.alsoPending.join(', #')})` : ''}`);
  if (d.level2) parts.push('Level 2 · not MVP');
  if (d.id === 'score') parts.push('Placeholder');
  return parts.length ? parts.join(' · ') : 'Workbook';
}

export type QuestionStatus = 'Open' | 'Partially answered' | 'Answered' | 'Note';

export interface OpenQuestion {
  /** Number in the workbook tab "UC #3 - Open Questions"; null for a note with no question number yet. */
  id: number | null;
  status: QuestionStatus;
  title: string;
  assumption: string;
}

/** Open questions from the workbook that this prototype depends on, with the assumption it uses. */
export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 2, status: 'Answered', title: 'Promo Funding scope', assumption: 'Answered Nov 17: vendor funding analytics live in the DMP tool, so the Promo Funding view is not part of this prototype. (The workbook says "DNP tool" and the meeting transcript "DMP tool"; name to confirm.)' },
  { id: 3, status: 'Open', title: 'Cannibalization', assumption: 'Selector: brand, brand-category or category (default category), within the promo window, items with the same unit of measure. Source (Cognira vs. internal data) also pending (#19).' },
  {
    id: 4,
    status: 'Partially answered',
    title: 'Baseline',
    assumption:
      'The prototype keeps a 4-week default, adjustable to 2, 4, 8, 13 or 52 weeks; prior promo weeks inside the window are included. Nov 17: default to be set per promo type (e.g., 4 weeks for Hot Buys, about 3 months for TPRs / price locks) and easy to adjust; values pending confirmation by John Cooper. Inputs still conflict (4 prior weeks, previous promotion / same period LY, 104-week regular-price or rolling 52-week base).',
  },
  { id: 5, status: 'Open', title: 'Promo Gross Margin % denominator', assumption: 'Net Customer Sales (default sales basis); the Sales basis control switches to Gross Sales.' },
  {
    id: 7,
    status: 'Open',
    title: 'Which funding Net Gross Margin $ adds',
    assumption:
      'All vendor promo funding (scan-down, bill-back and other promo allowances), in Net GM $ and Net Incremental GM $. Vendor Promo Funding $ is an internal input, not a KPI of its own. CNS stores receive the same allowance as a store shipment recap (bill back) instead of off-invoice at the DC; it must be counted once, not twice.',
  },
  { id: 8, status: 'Answered', title: 'Promo Run Trend', assumption: 'Answered Nov 17: comparing the same promotion across runs or years is the MVP (Must Have). The before / during / after section and Post-Promo Dip % are level 2.' },
  { id: 9, status: 'Open', title: 'Core metrics', assumption: 'Narrow to about 6–8 for the prototype; list pending from John Cooper and Michael Green.' },
  { id: 10, status: 'Open', title: 'Promo History attributes and objective', assumption: 'Ad Type / Vehicle (front page, inside page, digital, display, no ad) and Promo Depth Band (under 15 %, 15–25 %, 25–35 %, 35–50 %, 50 % and over) as in the workbook; the objective of the view is pending.' },
  { id: 11, status: 'Open', title: 'New-to-Category Buyers logic', assumption: 'The new-shopper logic comes from a third-party system; the prototype uses a 52-week category look-back.' },
  {
    id: 12,
    status: 'Open',
    title: 'Promo Shopper Impact KPIs',
    assumption:
      'Source pending: Symphony AI vs. Weis Club Card data. Workbook definitions; aggregates per event only; "usual" = the same buyers over the baseline window. Nov 17: there is no Symphony AI data feed (Excel exports only); the intent is to calculate from Weis Club Card data. The view will be trimmed once the 6–8 core metrics are agreed (#9).',
  },
  { id: 13, status: 'Open', title: 'Price groups', assumption: 'Price association table in Retalix HQ / HQ Analytics; whether it keeps history is pending. The prototype uses a fixed price group per SKU.' },
  { id: 15, status: 'Open', title: 'Cost', assumption: 'Same cost logic in every department; Fresh has doubts about the margin. Affects Promo GM $ and Promo GM %.' },
  { id: 19, status: 'Open', title: 'Data source direction', assumption: 'Cognira vs. Weis internal data; affects baseline, cannibalization, the promo calendar and reconciliation.' },
  { id: null, status: 'Note', title: 'Promo Investment $', assumption: 'Removed from the prototype with the Promo Funding view; where it belongs is pending (Harrison asked for club spend at item level). The generator still produces it as the base of vendor funding.' },
];

export function pendingOf(id: string): number | undefined {
  return KPI_DEFINITIONS.find((k) => k.id === id)?.pending;
}
