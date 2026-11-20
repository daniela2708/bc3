/**
 * KPI definitions from the requirements workbook "UC3_KPIs_Definitions_and_Mapping.xlsx" (UC3 Promo Effectiveness):
 * names, priorities, definitions and calculations are copied verbatim from its KPI sheet ("UC #3 - Promo
 * Effecitiveness"); how the prototype applies a row is in `note`, never mixed into the workbook text. Also the views that show each
 * KPI and the open questions with the assumption the prototype uses. Question numbers and statuses follow the
 * workbook tab "UC #3 - Open Questions". Shown in the KPI definitions dialog and in the README (see readme.ts).
 */
import { FATIGUE_INFO, FATIGUE_RULE } from './fatigue';
import type { TabId } from './filters';
import { criteriaText, SCORE_CHIP, SCORE_METHOD } from './scoring';
import { LIFT_THRESHOLDS, THRESHOLD_CHIP } from './thresholds';

/** The requirements workbook on the Weis SharePoint (opens with a Weis account). A fixed https URL, not user input. */
export const WORKBOOK_NAME = 'UC3_KPIs_Definitions_and_Mapping.xlsx';
export const WORKBOOK_URL =
  'https://weismarketsinc.sharepoint.com/:x:/r/teams/DataStrategyProject/_layouts/15/Doc.aspx?sourcedoc=%7BBC164FA7-9CCD-41F9-A20C-EB56CC1F223F%7D&file=UC3_KPIs%20Definitions%20and%20Mapping.xlsx&action=default&mobileredirect=true';

export type Priority = 'Must Have' | 'Should Have' | 'Nice to have';

export interface KpiDef {
  id: string;
  name: string;
  unit: string;
  priority: Priority;
  /** Workbook "Definition", verbatim (for KPIs not in the KPI sheet, the definition the prototype uses). */
  definition: string;
  /** Workbook "Calculation / Notes", verbatim (Net Customer Sales: its "Measure expression"). */
  formula: string;
  /** How the prototype applies the row, kept apart from the workbook text. */
  note?: string;
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

/** Added to the (i) of Net Gross Margin $ and Net Incremental Gross Margin $ (prototype review). */
export const FUNDING_BEHIND_SCENES = 'Includes vendor funding. Funding data is brought in behind the scenes even though funding KPIs are not shown.';

/** Status of the items added after the prototype review. */
export const REVIEW_STATUS = 'Requested in the prototype review';

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
    id: "gross",
    name: "Total Gross Sales",
    unit: "$",
    priority: "Must Have",
    definition: "Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC1, applied to the promo period.",
    formula: "SUM(Gross Sales) of the promoted items, promo start to end date",
    views: ['hotbuy', 'other', 'trend'],
    status: 'UC1 definition (Total Gross Sales), used by the Sales basis control and LY / YoY (#5)',
  },
  {
    id: "net",
    name: "Net Customer Sales",
    unit: "$",
    priority: "Must Have",
    definition: "Sales after item-level and non-item discounts, such as points (Day, WTD, Period-to-Date, QTD, 26-week rolling, YTD). The Category Performance Report (PowerBI) shows it. It is not accounting net sales.",
    formula: "[Net Customer Sales] = [Gross Sales] + [Non-Item Discount Amount] (measure expression; discounts negative)",
    views: PERF,
    note: 'Promo Sales $ on promo days and the default sales basis for lift, incremental and margin (#5).',
  },
  {
    id: "units",
    name: "Promo Units",
    unit: "units",
    priority: "Must Have",
    definition: "Units sold of the promoted item(s) on the days the promotion is active.(within selected promo-timeframe)",
    formula: "Sum of units sold for promoted item(s) where sale date is between promo start and end date.",
    views: ['hotbuy', 'other', 'trend'],
    note: `Random-weight items count pounds, as in Total Volume (UC2); each and pounds are never added together. ${RANDOM_WEIGHT_NOTE}`,
  },
  {
    id: "baseSales",
    name: "Baseline Sales $",
    unit: "$",
    priority: "Must Have",
    definition: "Expected sales dollars of the promoted item if it had not been on promotion.",
    formula: "Average daily sales of the N weeks before the promo × promo days",
    views: PERF,
    note: 'Kept because the lift KPIs need it. Proposed default N: 4 weeks for Hot Buys, 13 for TPRs, BOGOs and price locks (adjustable).',
    pending: 4,
    status: NOT_IN_SHEET,
  },
  {
    id: "baseUnits",
    name: "Baseline Units",
    unit: "units",
    priority: "Must Have",
    definition: "Expected units of the promoted item if it had not been on promotion.",
    formula: "Same method as Baseline Sales $, using units",
    views: PERF,
    note: 'Kept because the lift KPIs need it.',
    pending: 4,
    status: NOT_IN_SHEET,
  },
  {
    id: "incSales",
    name: "Incremental Sales $",
    unit: "$",
    priority: "Must Have",
    definition: "Extra sales dollars of the promoted item above its baseline during the promotion (lift $).(within selected promo-timeframe)",
    formula: "Promo Sales $ − Baseline Sales $",
    views: PERF,
  },
  {
    id: "incUnits",
    name: "Incremental Units",
    unit: "units",
    priority: "Must Have",
    definition: "Extra units of the promoted item above its baseline during the promotion.",
    formula: "Promo Units − Baseline Units",
    views: PERF,
  },
  {
    id: "salesLift",
    name: "Sales Lift %",
    unit: "%",
    priority: "Must Have",
    definition: "Percent increase in promoted item sales dollars vs. baseline.",
    formula: "Incremental Sales $ ÷ Baseline Sales $, matching the lift CMs look at today. Confirm.",
    views: ['hotbuy', 'other', 'trend', 'history'],
  },
  {
    id: "unitLift",
    name: "Unit Lift %",
    unit: "%",
    priority: "Must Have",
    definition: "Percent increase in promoted item units vs. baseline.",
    formula: "Incremental Units ÷ Baseline Units, matching the lift CMs look at today. Confirm.",
    views: ['hotbuy', 'other', 'trend', 'history'],
  },
  {
    id: "avgRetail",
    name: "Avg Promo Retail $",
    unit: "$",
    priority: "Nice to have",
    definition: "Average selling price per unit of the promoted item during the promotion.",
    formula: "Promo Sales $ ÷ Promo Units",
    views: ['history'],
    note: 'Per lb for random-weight items; Promo Sales $ on the selected sales basis.',
  },
  {
    id: "depth",
    name: "Promo Depth %",
    unit: "%",
    priority: "Should Have",
    definition: "How deep the promotional discount is vs. the regular retail.",
    formula: "(Regular retail − Promo retail) ÷ Regular retail",
    views: ['history'],
    note: 'BOGO counts as 50 %.',
  },
  {
    id: "gm",
    name: "Promo Gross Margin $",
    unit: "$",
    priority: "Must Have",
    definition: "Gross margin dollars earned on the promoted item(s) during the promotion, before vendor promo funding.",
    formula: "Promo Sales $ − Cost of goods sold for promo units. Same GM definition as UC #2.",
    views: ['hotbuy', 'other', 'trend'],
    note: `${COST_NOTE} ${RANDOM_WEIGHT_NOTE}`,
    pending: 15,
    alsoPending: [7],
  },
  {
    id: "gmPct",
    name: "Promo Gross Margin %",
    unit: "%",
    priority: "Must Have",
    definition: "Gross margin rate on the promoted item(s) during the promotion.",
    formula: "Promo Gross Margin $ ÷ Promo Sales $",
    views: ['hotbuy', 'other', 'trend'],
    note: `Ratio of totals. The denominator is pending (#5); the prototype divides by the selected sales basis (Net Customer Sales by default). ${RANDOM_WEIGHT_NOTE}`,
    pending: 5,
    alsoPending: [7, 15],
  },
  {
    id: "baseGm",
    name: "Baseline Gross Margin $",
    unit: "$",
    priority: "Must Have",
    definition: "Gross margin dollars the promoted item would have earned at regular price without the promotion.",
    formula: "Baseline Units × (Regular retail − Unit cost), using the existing baseline method.",
    views: PERF,
    note: RANDOM_WEIGHT_NOTE,
    pending: 4,
    alsoPending: [7],
  },
  {
    id: "incGm",
    name: "Incremental Gross Margin $",
    unit: "$",
    priority: "Must Have",
    definition: "Gross margin dollar impact of the promotion vs. baseline for the promoted item.",
    formula: "Promo Gross Margin $ − Baseline Gross Margin $",
    views: ['hotbuy', 'other', 'trend', 'history'],
    note: RANDOM_WEIGHT_NOTE,
    pending: 7,
  },
  {
    id: "netGm",
    name: "Net Gross Margin $",
    unit: "$",
    priority: "Must Have",
    definition: "Gross margin dollars on the promoted item(s) after adding vendor promo funding for the event.",
    formula: "Promo Gross Margin $ + Vendor Promo Funding $",
    views: PERF,
    note: `${FUNDING_BEHIND_SCENES} ${FUNDING_NOTE} ${RANDOM_WEIGHT_NOTE}`,
    pending: 7,
  },
  {
    id: "catIncSales",
    name: "Category Incremental Sales $",
    unit: "$",
    priority: "Must Have",
    definition: "Change in total subcategory / category sales dollars vs. baseline during the promotion, including the promoted item.",
    formula: "Category / subcategory sales $ during promo days vs. the existing baseline, as shown in Michael Green's Hot Buy slides. Confirm.",
    views: PERF,
    note: 'The prototype measures the category.',
  },
  {
    id: "catIncGm",
    name: "Category Incremental Gross Margin $",
    unit: "$",
    priority: "Must Have",
    definition: "Change in total subcategory / category gross margin dollars vs. baseline during the promotion.",
    formula: "Category / subcategory GM $ during promo days vs. the existing baseline. Confirm.",
    views: PERF,
    note: `The prototype measures the category. ${RANDOM_WEIGHT_NOTE}`,
    pending: 7,
  },
  {
    id: "cann",
    name: "Cannibalized Sales $",
    unit: "$",
    priority: "Must Have",
    definition: "Change in sales of non-promoted items in the same subcategory vs. their baseline during the promotion. Negative = cannibalization, positive = halo.",
    formula: "Existing method from Michael Green's Hot Buy slides: change in sales of non-promoted like items vs. baseline on promo days. Confirm.",
    views: PERF,
    note: GROUP_NOTE,
    pending: 3,
  },
  {
    id: "cannRate",
    name: "Cannibalization Rate %",
    unit: "%",
    priority: "Must Have",
    definition: "Share of the promoted item's incremental units that came from other items in the subcategory.",
    formula: "As calculated in Michael Green's Hot Buy slides. Confirm.",
    views: PERF,
    note: `Prototype: −Cannibalized Units ÷ Incremental Units (negative = halo). ${GROUP_NOTE}`,
    pending: 3,
  },
  {
    id: "netIncSales",
    name: "Net Incremental Sales $",
    unit: "$",
    priority: "Must Have",
    definition: "Promoted item incremental sales after taking out sales lost from other items in the subcategory.",
    formula: "Incremental Sales $ + Cannibalized Sales $",
    views: PERF,
    note: 'The other items are the group set by the Cannibalization level control (default Subcategory).',
  },
  {
    id: "netIncGm",
    name: "Net Incremental Gross Margin $",
    unit: "$",
    priority: "Must Have",
    definition: "Promoted item incremental gross margin after cannibalization and vendor funding. The main 'did it pay off' number.",
    formula: "Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $",
    views: ['hotbuy', 'other', 'trend', 'history'],
    note: `${FUNDING_BEHIND_SCENES} ${FUNDING_NOTE} ${RANDOM_WEIGHT_NOTE}`,
    pending: 7,
  },
  {
    id: "eventCount",
    name: "Promo Event Count",
    unit: "#",
    priority: "Should Have",
    definition: "Number of times an item or item group was promoted in the selected period.",
    formula: "Distinct count of promo events for the item / item group",
    views: ['trend', 'history'],
  },
  {
    id: "ly",
    name: "Last Year Gross Sales",
    unit: "$",
    priority: "Must Have",
    definition: "Gross sales of the same items over the same days last year (364 days earlier, as in UC2).",
    formula: "SUM(Gross Sales) for promo days − 364",
    views: ['trend'],
    status: UC1_REUSED,
  },
  {
    id: "yoy",
    name: "YoY Gross Sales Growth ($ / %)",
    unit: "$ / %",
    priority: "Must Have",
    definition: "Growth of promo gross sales vs. the same days last year.",
    formula: "$: TY − LY ; %: (TY − LY) ÷ LY",
    views: ['trend'],
    status: UC1_REUSED,
  },
  {
    id: "dip",
    name: "Post-Promo Dip %",
    unit: "%",
    priority: "Nice to have",
    definition: "Change in promoted item units after the promotion ends vs. baseline (pantry loading).",
    formula: "(Units after the promo − Baseline Units for the same days) ÷ Baseline Units, using a 4-week post-promo window by default.",
    views: ['post', 'trend'],
    note: 'Shown as — until the 4 weeks have passed.',
    level2: true,
  },
  {
    id: "buyers",
    name: "Promo Buyer Count",
    unit: "#",
    priority: "Should Have",
    definition: "Number of club card households that bought the promoted item during the promotion.",
    formula: "Distinct count of club card IDs with a promoted item in the transaction on promo days",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: "basket",
    name: "Avg Basket Size $",
    unit: "$",
    priority: "Should Have",
    definition: "Average total transaction dollars for transactions that include the promoted item.",
    formula: "Sum of transaction sales $ ÷ count of transactions containing the promoted item (promo days)",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: "spend",
    name: "Promo Buyer Spend Change %",
    unit: "%",
    priority: "Should Have",
    definition: "Whether shoppers who bought on promotion spent more than they usually do.",
    formula: "Promo buyers' spend during the event vs. their usual spend, as shown in Michael Green's Hot Buy slides. Confirm.",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: "upb",
    name: "Units per Basket",
    unit: "units",
    priority: "Nice to have",
    definition: "Average number of units in transactions that include the promoted item.",
    formula: "Sum of units in transactions containing the promoted item ÷ count of those transactions",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: "ntc",
    name: "New-to-Category Buyers %",
    unit: "%",
    priority: "Should Have",
    definition: "Share of promo buyers who had not bought the category in the look-back period.",
    formula: "Share of promo buyers new to the category, per the existing club card / Symphony AI definition. Confirm.",
    views: ['shopper'],
    note: 'The new-shopper logic comes from a third-party system (#11); the prototype uses a 52-week category look-back.',
    pending: 11,
    alsoPending: [16],
  },
  {
    id: "trips",
    name: "Category Trips",
    unit: "#",
    priority: "Should Have",
    definition: "Number of shopping trips by promo buyers that included any item in the category, vs. their usual.",
    formula: "Count of promo buyers' transactions with a category item during the event vs. same buyers' pre-period average",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: "txn",
    name: "Transaction Count",
    unit: "#",
    priority: "Nice to have",
    definition: "Total store transactions (customer count) during the promotion. Store traffic indicator.",
    formula: "Count of POS transactions on promo days",
    views: ['shopper'],
    pending: 16,
  },
  {
    id: "repeat",
    name: "Repeat Purchase Rate %",
    unit: "%",
    priority: "Nice to have",
    definition: "Share of promo buyers who bought the item again at regular price after the promotion.",
    formula: "Promo buyers who bought the item again at regular price after the event ÷ Promo Buyer Count, using the window CMs use today. Confirm.",
    views: ['post', 'shopper'],
    note: 'The prototype uses 28 days after the promotion.',
    pending: 16,
    level2: true,
  },
  {
    id: "score",
    name: "Hot Buy Score",
    unit: "score",
    priority: "Nice to have",
    definition: "Overall rating of a Hot Buy's success built from the core metrics. To be layered on after the core metrics are agreed.",
    formula: "Weighted score of agreed metrics (e.g., Net Incremental GM $, Lift %, Cannibalization Rate %). Weights to be defined.",
    views: ['hotbuy', 'shopper'],
    note: `${SCORE_CHIP}. Example criteria and weights (one config file, src/lib/scoring.ts): ${criteriaText()}. ${SCORE_METHOD} The margin criterion uses Net Gross Margin (with vendor funding), as the business asked. Shown in Hot Buy Performance (tile, table column) and in the Promo Shopper Impact proposal C.`,
    status: REVIEW_STATUS,
  },
  {
    id: "promos52",
    name: "Promos in Last 52 Weeks",
    unit: "#",
    priority: "Nice to have",
    definition: "Number of promo events the same price group had in the 52 weeks before the event started (any promo type).",
    formula: "Count of events of the same price group with a start date in the 364 days before the event's start date",
    views: ['history'],
    note: 'Promo fatigue column of "Every past promotion". Events before the start of the data (FY2024) are not counted.',
    status: `${REVIEW_STATUS} · illustrative`,
  },
  {
    id: "daysSince",
    name: "Days Since Previous Promo",
    unit: "days",
    priority: "Nice to have",
    definition: "Days between the end of the latest earlier promo of the same price group and the start of this event.",
    formula: "Event start date − end date of the previous event of the same price group (0 when they overlap); — when there is no earlier promo in the data",
    views: ['history'],
    note: 'Promo fatigue column of "Every past promotion".',
    status: `${REVIEW_STATUS} · illustrative`,
  },
  {
    id: "fatigue",
    name: "Promoted Often (promo fatigue flag)",
    unit: "flag",
    priority: "Nice to have",
    definition: "Flags events whose price group is promoted so often that shoppers may wait for the deal.",
    formula: `${FATIGUE_RULE} Example threshold, configurable in src/lib/fatigue.ts.`,
    views: ['history'],
    note: `Definition pending · threshold to align with Cognira promo fatigue. ${FATIGUE_INFO}`,
    status: `${REVIEW_STATUS} · illustrative`,
  },
  {
    id: "timing",
    name: "Promotion Timing Heat Map",
    unit: "map",
    priority: "Nice to have",
    definition: "When in the year promotions work best: rows are price groups (or categories), columns the month of the year, colour the lift or Net Incremental GM $ of the events that started in that month.",
    formula: "Sales Lift % of the events in the cell (ratio of totals), or their average Net Incremental GM $ per event; empty when no event started in that month",
    views: ['history'],
    note: 'New request · production data from Cognira (pending). Uses every event of the current selection, not only the price group of the table.',
    status: `${REVIEW_STATUS} · new request`,
  },
  {
    id: "runEventCount",
    name: "Event Count (each run side by side)",
    unit: "#",
    priority: "Nice to have",
    definition: "Number of promo events of the price group (any promo type) that started in the same fiscal quarter as the run.",
    formula: "Count of events of the run's price group with a start date in the run's fiscal quarter",
    views: ['trend'],
    note: 'Row of "Each run side by side"; the run columns are labelled by fiscal quarter.',
    status: REVIEW_STATUS,
  },
  {
    id: "liftBands",
    name: "Lift Colour Thresholds",
    unit: "band",
    priority: "Nice to have",
    definition: "Colour band of Sales Lift % and Unit Lift % in each run, with the value always shown.",
    formula: `High ≥ ${Math.round(LIFT_THRESHOLDS.good * 100)} % (green), Medium ${Math.round(LIFT_THRESHOLDS.watch * 100)} %–${Math.round(LIFT_THRESHOLDS.good * 100)} % (amber), Low < ${Math.round(LIFT_THRESHOLDS.watch * 100)} % (red). Example thresholds, configurable in src/lib/thresholds.ts.`,
    views: ['trend'],
    note: `${THRESHOLD_CHIP}.`,
    status: `${REVIEW_STATUS} · illustrative`,
  },
  {
    id: "buyerLift",
    name: "Promo Buyer Lift vs. Previous Week / Same Week Last Year %",
    unit: "%",
    priority: "Nice to have",
    definition: "Change in Promo Buyer Count vs. the week before the promotion and vs. the same week last year (club card aggregates).",
    formula: "Promo Buyer Count ÷ buyers over the same number of days right before the event − 1; Promo Buyer Count ÷ buyers over the same days 52 weeks earlier − 1 (events with last-year data)",
    views: ['shopper'],
    note: 'Proposal for review (Promo Shopper Impact layout A, Category summary). For an event longer than one week the comparison uses the same number of days right before it.',
    status: `${REVIEW_STATUS} · proposal for review`,
    pending: 16,
  },
];

/** Status line for a KPI, shared by the definitions dialog and the README traceability table. */
export function kpiStatus(d: KpiDef): string {
  const parts: string[] = [];
  if (d.status) parts.push(d.status);
  if (d.pending) parts.push(`Definition pending #${d.pending}${d.alsoPending?.length ? ` (also #${d.alsoPending.join(', #')})` : ''}`);
  if (d.level2) parts.push('Level 2 · not MVP');
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
