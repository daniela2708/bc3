/**
 * KPI definitions from the requirements workbook "UC3_KPIs_Definitions_and_Mapping.xlsx" (UC3 Promo Effectiveness):
 * names, priorities, definitions and calculations follow its KPI sheet ("UC #3 - Promo Effecitiveness"); where the
 * prototype needs to say how it applies a row, a sentence follows the workbook text. Also the views that show each
 * KPI and the open questions with the assumption the prototype uses. Question numbers and statuses follow the
 * workbook tab "UC #3 - Open Questions". Shown in the KPI definitions dialog and in the README (see readme.ts).
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

/** Shown in the tooltips of Promo Units and of the margin metrics (#15). */
export const RANDOM_WEIGHT_NOTE = 'Random weight cost is being corrected; meat scope pending (#15).';

const PERF: TabId[] = ['hotbuy', 'other'];
const NOT_IN_SHEET = 'Not in the current KPI sheet (#4)';
const UC1_REUSED = 'UC1 definition (reused)';
const COST_NOTE = 'Cost (#15): DC items use the DC end-of-day average cost minus scan-downs; DSD items use the net replacement cost in the store that day.';
const FUNDING_NOTE =
  'Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2).';
const GROUP_NOTE = 'The group follows the Cannibalization level control (default Subcategory; also brand, brand-category or category), within the promo window, same unit of measure.';

export const KPI_DEFINITIONS: KpiDef[] = [
  {
    id: 'gross',
    name: 'Total Gross Sales',
    unit: '$',
    priority: 'Must Have',
    definition: 'Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC1, applied to the promo period.',
    formula: 'SUM(Gross Sales) of the promoted items, promo start to end date',
    views: ['hotbuy', 'other', 'trend'],
    status: 'UC1 definition (Total Gross Sales), used by the Sales basis control and LY / YoY (#5)',
  },
  {
    id: 'net',
    name: 'Net Customer Sales',
    unit: '$',
    priority: 'Must Have',
    definition:
      'Sales after item-level and non-item discounts, such as points (Day, WTD, Period-to-Date, QTD, 26-week rolling, YTD). The Category Performance Report (PowerBI) shows it. It is not accounting net sales. In the prototype: Promo Sales $ on promo days and the default sales basis for lift, incremental and margin (#5).',
    formula: 'Gross Sales − Discounts',
    views: PERF,
  },
  {
    id: 'units',
    name: 'Promo Units',
    unit: 'units',
    priority: 'Must Have',
    definition: `Units sold of the promoted item(s) on the days the promotion is active (within selected promo-timeframe). Random-weight items count pounds, as in Total Volume (UC2); each and pounds are never added together. ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Sum of units sold for promoted item(s) where sale date is between promo start and end date.',
    views: ['hotbuy', 'other', 'trend'],
  },
  {
    id: 'baseSales',
    name: 'Baseline Sales $',
    unit: '$',
    priority: 'Must Have',
    definition: 'Expected sales dollars of the promoted item if it had not been on promotion. Kept because the lift KPIs need it.',
    formula: 'Average daily sales of the N weeks before the promo × promo days. Proposed default N: 4 weeks for Hot Buys, 13 for TPRs, BOGOs and price locks (adjustable)',
    views: PERF,
    pending: 4,
    status: NOT_IN_SHEET,
  },
  {
    id: 'baseUnits',
    name: 'Baseline Units',
    unit: 'units',
    priority: 'Must Have',
    definition: 'Expected units of the promoted item if it had not been on promotion. Kept because the lift KPIs need it.',
    formula: 'Same method as Baseline Sales $, using units',
    views: PERF,
    pending: 4,
    status: NOT_IN_SHEET,
  },
  {
    id: 'incSales',
    name: 'Incremental Sales $',
    unit: '$',
    priority: 'Must Have',
    definition: 'Extra sales dollars of the promoted item above its baseline during the promotion (lift $) (within selected promo-timeframe).',
    formula: 'Promo Sales $ − Baseline Sales $',
    views: PERF,
  },
  {
    id: 'incUnits',
    name: 'Incremental Units',
    unit: 'units',
    priority: 'Must Have',
    definition: 'Extra units of the promoted item above its baseline during the promotion.',
    formula: 'Promo Units − Baseline Units',
    views: PERF,
  },
  {
    id: 'salesLift',
    name: 'Sales Lift %',
    unit: '%',
    priority: 'Must Have',
    definition: 'Percent increase in promoted item sales dollars vs. baseline.',
    formula: 'Incremental Sales $ ÷ Baseline Sales $, matching the lift CMs look at today. Confirm.',
    views: ['hotbuy', 'other', 'trend', 'history'],
  },
  {
    id: 'unitLift',
    name: 'Unit Lift %',
    unit: '%',
    priority: 'Must Have',
    definition: 'Percent increase in promoted item units vs. baseline.',
    formula: 'Incremental Units ÷ Baseline Units, matching the lift CMs look at today. Confirm.',
    views: ['hotbuy', 'other', 'trend', 'history'],
  },
  {
    id: 'avgRetail',
    name: 'Avg Promo Retail $',
    unit: '$',
    priority: 'Nice to have',
    definition: 'Average selling price per unit of the promoted item during the promotion. Per lb for random-weight items; Promo Sales $ on the selected sales basis.',
    formula: 'Promo Sales $ ÷ Promo Units',
    views: ['history'],
  },
  {
    id: 'depth',
    name: 'Promo Depth %',
    unit: '%',
    priority: 'Should Have',
    definition: 'How deep the promotional discount is vs. the regular retail. BOGO counts as 50 %.',
    formula: '(Regular retail − Promo retail) ÷ Regular retail',
    views: ['history'],
  },
  {
    id: 'gm',
    name: 'Promo Gross Margin $',
    unit: '$',
    priority: 'Must Have',
    definition: `Gross margin dollars earned on the promoted item(s) during the promotion, before vendor promo funding. ${COST_NOTE} ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Promo Sales $ − Cost of goods sold for promo units. Same GM definition as UC #2.',
    views: ['hotbuy', 'other', 'trend'],
    pending: 15,
    alsoPending: [7],
  },
  {
    id: 'gmPct',
    name: 'Promo Gross Margin %',
    unit: '%',
    priority: 'Must Have',
    definition: `Gross margin rate on the promoted item(s) during the promotion. Ratio of totals. The denominator is pending (#5); the prototype divides by the selected sales basis (Net Customer Sales by default). ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Promo Gross Margin $ ÷ Promo Sales $',
    views: ['hotbuy', 'other', 'trend'],
    pending: 5,
    alsoPending: [7, 15],
  },
  {
    id: 'baseGm',
    name: 'Baseline Gross Margin $',
    unit: '$',
    priority: 'Must Have',
    definition: `Gross margin dollars the promoted item would have earned at regular price without the promotion. ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Baseline Units × (Regular retail − Unit cost), using the existing baseline method.',
    views: PERF,
    pending: 4,
    alsoPending: [7],
  },
  {
    id: 'incGm',
    name: 'Incremental Gross Margin $',
    unit: '$',
    priority: 'Must Have',
    definition: `Gross margin dollar impact of the promotion vs. baseline for the promoted item. ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Promo Gross Margin $ − Baseline Gross Margin $',
    views: ['hotbuy', 'other', 'trend', 'history'],
    pending: 7,
  },
  {
    id: 'netGm',
    name: 'Net Gross Margin $',
    unit: '$',
    priority: 'Must Have',
    definition: `Gross margin dollars on the promoted item(s) after adding vendor promo funding for the event. ${FUNDING_NOTE} ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Promo Gross Margin $ + Vendor Promo Funding $',
    views: PERF,
    pending: 7,
  },
  {
    id: 'catIncSales',
    name: 'Category Incremental Sales $',
    unit: '$',
    priority: 'Must Have',
    definition: 'Change in total subcategory / category sales dollars vs. baseline during the promotion, including the promoted item. The prototype measures the category.',
    formula: "Category / subcategory sales $ during promo days vs. the existing baseline, as shown in Michael Green's Hot Buy slides. Confirm.",
    views: PERF,
  },
  {
    id: 'catIncGm',
    name: 'Category Incremental Gross Margin $',
    unit: '$',
    priority: 'Must Have',
    definition: `Change in total subcategory / category gross margin dollars vs. baseline during the promotion. The prototype measures the category. ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Category / subcategory GM $ during promo days vs. the existing baseline. Confirm.',
    views: PERF,
    pending: 7,
  },
  {
    id: 'cann',
    name: 'Cannibalized Sales $',
    unit: '$',
    priority: 'Must Have',
    definition: `Change in sales of non-promoted items in the same subcategory vs. their baseline during the promotion. Negative = cannibalization, positive = halo. ${GROUP_NOTE}`,
    formula: "Existing method from Michael Green's Hot Buy slides: change in sales of non-promoted like items vs. baseline on promo days. Confirm.",
    views: PERF,
    pending: 3,
  },
  {
    id: 'cannRate',
    name: 'Cannibalization Rate %',
    unit: '%',
    priority: 'Must Have',
    definition: `Share of the promoted item's incremental units that came from other items in the subcategory. Negative = halo. ${GROUP_NOTE}`,
    formula: "As calculated in Michael Green's Hot Buy slides. Confirm. Prototype: −Cannibalized Units ÷ Incremental Units.",
    views: PERF,
    pending: 3,
  },
  {
    id: 'netIncSales',
    name: 'Net Incremental Sales $',
    unit: '$',
    priority: 'Must Have',
    definition: 'Promoted item incremental sales after taking out sales lost from other items in the subcategory (the group set by the Cannibalization level control).',
    formula: 'Incremental Sales $ + Cannibalized Sales $',
    views: PERF,
  },
  {
    id: 'netIncGm',
    name: 'Net Incremental Gross Margin $',
    unit: '$',
    priority: 'Must Have',
    definition: `Promoted item incremental gross margin after cannibalization and vendor funding. The main 'did it pay off' number. ${FUNDING_NOTE} ${RANDOM_WEIGHT_NOTE}`,
    formula: 'Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $',
    views: ['hotbuy', 'other', 'trend', 'history'],
    pending: 7,
  },
  {
    id: 'eventCount',
    name: 'Promo Event Count',
    unit: '#',
    priority: 'Should Have',
    definition: 'Number of times an item or item group was promoted in the selected period.',
    formula: 'Distinct count of promo events for the item / item group',
    views: ['trend', 'history'],
  },
  {
    id: 'ly',
    name: 'Last Year Gross Sales',
    unit: '$',
    priority: 'Must Have',
    definition: 'Gross sales of the same items over the same days last year (364 days earlier, as in UC2).',
    formula: 'SUM(Gross Sales) for promo days − 364',
    views: ['trend'],
    status: UC1_REUSED,
  },
  {
    id: 'yoy',
    name: 'YoY Gross Sales Growth ($ / %)',
    unit: '$ / %',
    priority: 'Must Have',
    definition: 'Growth of promo gross sales vs. the same days last year.',
    formula: '$: TY − LY ; %: (TY − LY) ÷ LY',
    views: ['trend'],
    status: UC1_REUSED,
  },
  {
    id: 'dip',
    name: 'Post-Promo Dip %',
    unit: '%',
    priority: 'Nice to have',
    definition: 'Change in promoted item units after the promotion ends vs. baseline (pantry loading). Shown as — until the 4 weeks have passed.',
    formula: '(Units after the promo − Baseline Units for the same days) ÷ Baseline Units, using a 4-week post-promo window by default.',
    views: ['trend'],
    level2: true,
  },
  {
    id: 'buyers',
    name: 'Promo Buyer Count',
    unit: '#',
    priority: 'Should Have',
    definition: 'Number of club card households that bought the promoted item during the promotion.',
    formula: 'Distinct count of club card IDs with a promoted item in the transaction on promo days',
    views: ['shopper'],
    pending: 16,
  },
  {
    id: 'basket',
    name: 'Avg Basket Size $',
    unit: '$',
    priority: 'Should Have',
    definition: 'Average total transaction dollars for transactions that include the promoted item.',
    formula: 'Sum of transaction sales $ ÷ count of transactions containing the promoted item (promo days)',
    views: ['shopper'],
    pending: 16,
  },
  {
    id: 'spend',
    name: 'Promo Buyer Spend Change %',
    unit: '%',
    priority: 'Should Have',
    definition: 'Whether shoppers who bought on promotion spent more than they usually do.',
    formula: "Promo buyers' spend during the event vs. their usual spend, as shown in Michael Green's Hot Buy slides. Confirm.",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: 'upb',
    name: 'Units per Basket',
    unit: 'units',
    priority: 'Nice to have',
    definition: 'Average number of units in transactions that include the promoted item.',
    formula: 'Sum of units in transactions containing the promoted item ÷ count of those transactions',
    views: ['shopper'],
    pending: 16,
  },
  {
    id: 'ntc',
    name: 'New-to-Category Buyers %',
    unit: '%',
    priority: 'Should Have',
    definition: 'Share of promo buyers who had not bought the category in the look-back period. The new-shopper logic comes from a third-party system (#11); the prototype uses a 52-week category look-back.',
    formula: 'Share of promo buyers new to the category, per the existing club card / Symphony AI definition. Confirm.',
    views: ['shopper'],
    pending: 11,
    alsoPending: [16],
  },
  {
    id: 'trips',
    name: 'Category Trips',
    unit: '#',
    priority: 'Should Have',
    definition: 'Number of shopping trips by promo buyers that included any item in the category, vs. their usual.',
    formula: "Count of promo buyers' transactions with a category item during the event vs. same buyers' pre-period average",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: 'txn',
    name: 'Transaction Count',
    unit: '#',
    priority: 'Nice to have',
    definition: 'Total store transactions (customer count) during the promotion. Store traffic indicator.',
    formula: 'Count of POS transactions on promo days',
    views: ['shopper'],
    pending: 16,
  },
  {
    id: 'repeat',
    name: 'Repeat Purchase Rate %',
    unit: '%',
    priority: 'Nice to have',
    definition: 'Share of promo buyers who bought the item again at regular price after the promotion. The prototype uses 28 days after the promotion.',
    formula: 'Promo buyers who bought the item again at regular price after the event ÷ Promo Buyer Count, using the window CMs use today. Confirm.',
    views: ['shopper'],
    pending: 16,
    level2: true,
  },
  {
    id: 'score',
    name: 'Hot Buy Score',
    unit: 'score',
    priority: 'Nice to have',
    definition: "Overall rating of a Hot Buy's success built from the core metrics. Scoring method to be defined; shown as a placeholder only.",
    formula: 'Scoring method to be defined',
    views: ['hotbuy'],
  },
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

/** Status values of the workbook tracker; 'Note' is only for a note with no question number. */
export type QuestionStatus = 'Open' | 'Waiting on reply' | 'Partly answered' | 'Answered' | 'Note';

export interface OpenQuestion {
  /** Number in the workbook tab "UC #3 - Open Questions"; null for a note with no question number. */
  id: number | null;
  status: QuestionStatus;
  title: string;
  assumption: string;
}

/** Open questions from the workbook that this prototype depends on, with the assumption it uses. */
export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 1, status: 'Waiting on reply', title: 'Legacy reports', assumption: 'Reference reports are being collected; scan data comes from WMBI (sales line fact tables).' },
  {
    id: 2,
    status: 'Answered',
    title: 'Promo Funding scope',
    assumption:
      'Vendor funding analytics live in the DNP tool, so the Promo Funding view, the Funding Type filter, Vendor-Funded %, Weis-Funded Promo Cost $ and Promo ROI are not part of this dashboard. Their tables are still reviewed in the data review.',
  },
  {
    id: 3,
    status: 'Waiting on reply',
    title: 'Cannibalization',
    assumption:
      'Level and source pending (Cognira vs. Weis data). The workbook KPI rows measure at subcategory; Harrison proposed brand, brand-category and category. Selector with the four levels, default Subcategory, within the promo window, same unit of measure.',
  },
  {
    id: 4,
    status: 'Partly answered',
    title: 'Baseline',
    assumption:
      'Direction: one single baseline source for the company, leaning toward Cognira, pending confirmation. Proposed defaults, adjustable by the user: 4 weeks before the promo for Hot Buys, 13 weeks for TPRs, BOGOs and price locks. Prior promo weeks inside the window are still included; whether to exclude them is pending. The Baseline Sales $ and Baseline Units rows are not in the current KPI sheet; the prototype keeps them because the lift KPIs need them.',
  },
  {
    id: 5,
    status: 'Partly answered',
    title: 'Sales and Promo GM %',
    assumption:
      'Promo sales use the use case 1 table (Net Customer Sales) so sales match across dashboards; Cognira sales are not used. The GM % denominator is pending: UC1 answered Net Customer Sales and UC2 uses Gross Sales. The Sales basis control keeps both, default Net Customer Sales.',
  },
  {
    id: 6,
    status: 'Partly answered',
    title: 'Promo events',
    assumption:
      'Cognira holds the promo plan; promotions that actually ran come from HQ (simple promotions, price batches) and AMS (complex and points promotions). The Cognira feed keeps current and future promotions only, no history. HQ and AMS tables pending. The ad week is Thursday to Wednesday by default but must stay configurable; holiday exceptions in the ad calendar are not simulated.',
  },
  {
    id: 7,
    status: 'Waiting on reply',
    title: 'Margin scope and Net Gross Margin',
    assumption:
      'Whether margin metrics stay in the dashboard or only velocity metrics (units and sales) is pending with the SMEs. If net gross margin stays: HQ scan-downs at the expected amount (not vendor billing), bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, and CNS store shipment recaps and DC off-invoice are the same allowance, counted once.',
  },
  {
    id: 8,
    status: 'Answered',
    title: 'Promo Run Trend',
    assumption: 'Comparing the same promotion across runs or years is the MVP (Must Have). Post-Promo Trend and Post-Promo Dip % are level 2, with a 4-week post-promo window.',
  },
  { id: 9, status: 'Partly answered', title: 'Core metrics', assumption: 'The dashboard will show about 6 to 8 core metrics and no funding metrics; which ones is pending. Tables for all metrics are still reviewed.' },
  { id: 10, status: 'Waiting on reply', title: 'Promo History', assumption: 'Objective of the view pending. Ad Type / Vehicle and Promo Depth Band as in the workbook.' },
  { id: 11, status: 'Waiting on reply', title: 'New-to-Category Buyers logic', assumption: 'The new-shopper logic comes from a third-party system; the prototype uses a 52-week category look-back.' },
  {
    id: 12,
    status: 'Answered',
    title: 'Symphony AI',
    assumption: 'Symphony AI cannot be a data source; it is only a reference for comparison. Shopper metrics are calculated from the Weis T-log and Club Card tables.',
  },
  { id: 13, status: 'Answered', title: 'Price groups', assumption: 'The price association lives in HQ and has no history; the prototype uses a fixed price group per SKU.' },
  {
    id: 14,
    status: 'Waiting on reply',
    title: 'Promo type in the T-log',
    assumption: 'Examples pending of stores recording the change from hot buy to price lock differently. Promo sales are identified with the link code and price type.',
  },
  {
    id: 15,
    status: 'Partly answered',
    title: 'Cost',
    assumption:
      'Cost follows Power BI category reporting: DC items use the DC end-of-day average cost minus scan-downs; DSD items use the net replacement cost in the store that day. Random weight items are calculated incorrectly today and will be fixed. Whether meat is out of scope for UC3, as in UC2, is pending.',
  },
  {
    id: 16,
    status: 'Partly answered',
    title: 'Club Card',
    assumption:
      'Club Card data is personal data: the dashboard shows aggregates only, and any view with individual detail needs approval from Weis IT. Household vs. card level per metric is pending; Promo Buyer Count uses households.',
  },
  {
    id: 18,
    status: 'Partly answered',
    title: 'Reconciliation',
    assumption:
      'SMEs review first, then technical reconciliation against current reporting; sales reconcile to the Category Performance Report. The target for baseline and cannibalization depends on the Cognira vs. Weis data decision.',
  },
  {
    id: null,
    status: 'Note',
    title: 'Promo Investment $',
    assumption: 'Not shown: it only appeared in the Promo Funding view. Harrison asked for club spend at item level; where it belongs is pending. The generator still produces it as the base of vendor funding.',
  },
];

export function pendingOf(id: string): number | undefined {
  return KPI_DEFINITIONS.find((k) => k.id === id)?.pending;
}
