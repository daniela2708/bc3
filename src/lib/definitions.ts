/**
 * KPI definitions from the requirements workbook (UC3 Promo Effectiveness), the views that show them and the open
 * questions with the assumption the prototype uses. Shown in the KPI definitions dialog and in the README.
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
  /** Open question number when the definition is pending business confirmation. */
  pending?: number;
}

const PERF: TabId[] = ['hotbuy', 'other'];

export const KPI_DEFINITIONS: KpiDef[] = [
  { id: 'gross', name: 'Total Gross Sales', unit: '$', priority: 'Must Have', definition: 'Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC2, applied to the promo period.', formula: 'SUM(Gross Sales) of the promoted items, promo start to end date', views: ['hotbuy', 'other', 'trend'] },
  { id: 'net', name: 'Total Net Customer Sales', unit: '$', priority: 'Must Have', definition: 'Promo Sales $ after discounts (coupons and other customer discounts). Default sales basis for lift, incremental and margin; the Sales basis control switches to Gross Sales.', formula: 'Gross Sales − Discounts', views: ['hotbuy', 'other'] },
  { id: 'units', name: 'Promo Units / Total Volume', unit: 'units', priority: 'Must Have', definition: 'Units sold of the promoted item(s) on the days the promotion is active. Random-weight items (Meat, loose Produce) count pounds; each and pounds are never added together.', formula: 'SUM(units) where sale date is between promo start and end date', views: ['hotbuy', 'other', 'trend'] },
  { id: 'baseSales', name: 'Baseline Sales $', unit: '$', priority: 'Must Have', definition: 'Expected sales dollars of the promoted item if it had not been on promotion.', formula: 'Average daily sales of the N weeks before the promo (default 4, adjustable) × promo days', views: PERF, pending: 6 },
  { id: 'baseUnits', name: 'Baseline Units', unit: 'units', priority: 'Must Have', definition: 'Expected units of the promoted item if it had not been on promotion.', formula: 'Same method as Baseline Sales $, using units', views: PERF, pending: 6 },
  { id: 'incSales', name: 'Incremental Sales $ / Units', unit: '$ / units', priority: 'Must Have', definition: 'Extra sales dollars (units) above baseline during the promotion.', formula: 'Promo Sales $ − Baseline Sales $ ; Promo Units − Baseline Units', views: PERF },
  { id: 'salesLift', name: 'Sales Lift %', unit: '%', priority: 'Must Have', definition: 'Percent increase in sales dollars vs. baseline.', formula: 'Incremental Sales $ ÷ Baseline Sales $', views: ['hotbuy', 'other', 'trend', 'history'] },
  { id: 'unitLift', name: 'Unit Lift %', unit: '%', priority: 'Must Have', definition: 'Percent increase in units vs. baseline.', formula: 'Incremental Units ÷ Baseline Units', views: ['hotbuy', 'other', 'trend', 'history'] },
  { id: 'avgRetail', name: 'Avg Promo Retail $ (Average Retail Price per Unit)', unit: '$', priority: 'Nice to have', definition: 'Average selling price per unit (or lb) during the promotion.', formula: 'Promo Gross Sales $ ÷ Promo Units', views: ['history'] },
  { id: 'depth', name: 'Promo Depth %', unit: '%', priority: 'Should Have', definition: 'How deep the discount is vs. regular retail. BOGO counts as 50 %.', formula: '(Regular retail − Promo retail) ÷ Regular retail', views: ['history'] },
  { id: 'gm', name: 'Promo Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin dollars on the promoted item(s) during the promotion, before vendor promo funding. Same GM definition as UC2.', formula: 'Promo Sales $ − Cost of goods sold for promo units', views: ['hotbuy', 'other', 'trend', 'funding'] },
  { id: 'gmPct', name: 'Promo Gross Margin %', unit: '%', priority: 'Must Have', definition: 'Gross margin rate during the promotion. Ratio of totals.', formula: 'Promo Gross Margin $ ÷ Promo Sales $ (Net Customer Sales by default)', views: ['hotbuy', 'other', 'trend'], pending: 7 },
  { id: 'baseGm', name: 'Baseline Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin the item would have earned at regular price without the promotion.', formula: 'Baseline Units × (Regular retail − Unit cost), from the baseline window', views: PERF, pending: 6 },
  { id: 'incGm', name: 'Incremental Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin impact of the promotion vs. baseline, before vendor funding.', formula: 'Promo Gross Margin $ − Baseline Gross Margin $', views: ['hotbuy', 'other', 'trend', 'history'] },
  { id: 'netGm', name: 'Net Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Gross margin after adding all vendor promo funding for the event (scan-downs, bill-backs and other promo allowances).', formula: 'Promo Gross Margin $ + Vendor Promo Funding $', views: ['hotbuy', 'other', 'funding'], pending: 3 },
  { id: 'catInc', name: 'Category Incremental Sales $ / Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Change in total category sales (gross margin) vs. baseline during the promotion, including the promoted items.', formula: 'Σ category items (promo window − baseline)', views: PERF },
  { id: 'cann', name: 'Cannibalized Sales $', unit: '$', priority: 'Must Have', definition: 'Change in sales of non-promoted items in the same group vs. their baseline during the promotion. Negative = cannibalization, positive = halo. The group follows the Cannibalization level control (brand, brand-category or category; same unit of measure).', formula: 'Σ group items (promo window − baseline)', views: PERF, pending: 5 },
  { id: 'cannRate', name: 'Cannibalization Rate %', unit: '%', priority: 'Must Have', definition: "Share of the promoted item's incremental units that came from other items in the group. Negative = halo.", formula: '−Cannibalized Units ÷ Incremental Units', views: ['hotbuy'], pending: 5 },
  { id: 'netIncSales', name: 'Net Incremental Sales $', unit: '$', priority: 'Must Have', definition: 'Promoted item incremental sales after taking out sales lost from other items.', formula: 'Incremental Sales $ + Cannibalized Sales $', views: ['hotbuy'] },
  { id: 'netIncGm', name: 'Net Incremental Gross Margin $', unit: '$', priority: 'Must Have', definition: 'Incremental gross margin after cannibalization and vendor funding. The main "did it pay off" number.', formula: 'Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $', views: ['hotbuy', 'other', 'trend', 'history'], pending: 3 },
  { id: 'eventCount', name: 'Promo Event Count', unit: '#', priority: 'Should Have', definition: 'Number of times an item or price group was promoted in the selected period.', formula: 'COUNT(promo events)', views: ['trend', 'history'] },
  { id: 'ly', name: 'Last Year Gross Sales', unit: '$', priority: 'Must Have', definition: 'Gross sales of the same items over the same days last year (364 days earlier, as in UC2).', formula: 'SUM(Gross Sales) for promo days − 364', views: ['trend'] },
  { id: 'yoy', name: 'YoY Gross Sales Growth ($ / %)', unit: '$ / %', priority: 'Must Have', definition: 'Growth of promo gross sales vs. the same days last year.', formula: '$: TY − LY ; %: (TY − LY) ÷ LY', views: ['trend'] },
  { id: 'dip', name: 'Post-Promo Dip %', unit: '%', priority: 'Nice to have', definition: 'Change in units in the ad week after the promotion ends vs. baseline (pantry loading).', formula: '(Units after the promo − Baseline Units for the same days) ÷ Baseline Units', views: ['trend'], pending: 4 },
  { id: 'invest', name: 'Promo Investment $', unit: '$', priority: 'Should Have', definition: 'Total markdown dollars given up by running the promotion.', formula: '(Regular retail − Promo retail) × Promo Units', views: ['funding'], pending: 2 },
  { id: 'funding', name: 'Vendor Promo Funding $', unit: '$', priority: 'Should Have', definition: 'Promotional funding from the vendor tied to the event: scan-downs, bill-backs and other promo allowances.', formula: 'Σ vendor funding for the event', views: ['funding'], pending: 2 },
  { id: 'vendorPct', name: 'Vendor-Funded %', unit: '%', priority: 'Should Have', definition: 'Share of the promo investment paid by the vendor.', formula: 'Vendor Promo Funding $ ÷ Promo Investment $', views: ['funding'], pending: 2 },
  { id: 'weisCost', name: 'Weis-Funded Promo Cost $', unit: '$', priority: 'Should Have', definition: 'Promo investment not covered by vendor funding.', formula: 'Promo Investment $ − Vendor Promo Funding $', views: ['funding'], pending: 2 },
  { id: 'roi', name: 'Promo ROI', unit: 'ratio', priority: 'Should Have', definition: 'Net incremental gross margin returned for each dollar Weis spent on the promotion. Not defined (—) when the vendor paid the whole investment. Numerator and denominator use all vendor funding.', formula: 'Net Incremental Gross Margin $ ÷ Weis-Funded Promo Cost $', views: ['funding', 'history'], pending: 3 },
  { id: 'buyers', name: 'Promo Buyer Count', unit: '#', priority: 'Should Have', definition: 'Number of club card households that bought the promoted item during the promotion.', formula: 'COUNT DISTINCT club card households with a promo item purchase', views: ['shopper'], pending: 17 },
  { id: 'basket', name: 'Avg Basket Size $', unit: '$', priority: 'Should Have', definition: 'Average total transaction dollars for transactions that include the promoted item.', formula: 'Σ transaction $ ÷ transactions with the promo item', views: ['shopper'], pending: 17 },
  { id: 'spend', name: 'Promo Buyer Spend Change %', unit: '%', priority: 'Should Have', definition: "Promo buyers' spend during the event vs. their usual spend.", formula: 'Spend during the event ÷ usual spend − 1', views: ['shopper'], pending: 17 },
  { id: 'upb', name: 'Units per Basket', unit: 'units', priority: 'Nice to have', definition: 'Average units in transactions that include the promoted item.', formula: 'Σ units ÷ transactions with the promo item', views: ['shopper'], pending: 17 },
  { id: 'ntc', name: 'New-to-Category Buyers %', unit: '%', priority: 'Should Have', definition: 'Share of promo buyers who had not bought the category in the look-back period (52 weeks).', formula: 'New-to-category buyers ÷ Promo Buyer Count', views: ['shopper'], pending: 17 },
  { id: 'trips', name: 'Category Trips', unit: '#', priority: 'Should Have', definition: 'Trips by promo buyers that included any item in the category, vs. their usual.', formula: 'COUNT(trips with a category item) by promo buyers', views: ['shopper'], pending: 17 },
  { id: 'txn', name: 'Transaction Count', unit: '#', priority: 'Nice to have', definition: 'Total store transactions during the promotion. Store traffic indicator.', formula: 'COUNT(transactions) on promo days', views: ['shopper'], pending: 17 },
  { id: 'repeat', name: 'Repeat Purchase Rate %', unit: '%', priority: 'Nice to have', definition: 'Share of promo buyers who bought the item again at regular price after the promotion.', formula: 'Repeat buyers ÷ Promo Buyer Count', views: ['shopper'], pending: 17 },
  { id: 'score', name: 'Hot Buy Score', unit: 'score', priority: 'Nice to have', definition: "Overall rating of a Hot Buy's success built from the core metrics. Scoring method to be defined; shown as a placeholder only.", formula: 'Scoring method to be defined', views: ['hotbuy'] },
];

export interface OpenQuestion {
  id: number;
  title: string;
  assumption: string;
}

/** Open questions from the tracker that this prototype depends on, with the assumption it uses. */
export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 2, title: 'Promo Funding scope', assumption: 'The Promo Funding view and its KPIs are built and marked "Scope pending confirmation".' },
  { id: 3, title: 'Which funding Net Gross Margin $ adds', assumption: 'All vendor promo funding (scan-down, bill-back and other promo allowances), in every view. Promo ROI uses the same base in numerator and denominator.' },
  { id: 4, title: 'Promo Run Trend content', assumption: 'Main content is the comparison between runs of the same promotion; Post-Promo Dip % is a secondary section (the KPI sheet still calls the view "Post-Promo Trend").' },
  { id: 5, title: 'Cannibalization level', assumption: 'Selector: brand, brand-category or category (default category), within the promo window, items with the same unit of measure.' },
  { id: 6, title: 'Baseline', assumption: 'Average of the 4 weeks before the event (default), adjustable to 2, 4, 8, 13 or 52 weeks. Prior promo weeks inside the window are not excluded.' },
  { id: 7, title: 'Promo Gross Margin % denominator', assumption: 'Net Customer Sales (default sales basis); the Sales basis control switches to Gross Sales.' },
  { id: 9, title: 'Promo History attributes', assumption: 'Ad Type / Vehicle (front page, inside page, digital, display, no ad) and Promo Depth Band (under 15 %, 15–25 %, 25–35 %, 35–50 %, 50 % and over) as in the workbook.' },
  { id: 17, title: 'Promo Shopper Impact KPIs', assumption: 'Workbook definitions; club card aggregates by event only. "Usual" = the same buyers over the baseline window before the event.' },
];

export function pendingOf(id: string): number | undefined {
  return KPI_DEFINITIONS.find((k) => k.id === id)?.pending;
}
