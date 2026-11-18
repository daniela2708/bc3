# Weis · Promo Effectiveness (UC3 prototype)

A clickable, preliminary prototype of Use Case 3, **Promo Effectiveness**, for Weis Markets. It follows the structure, stack and look of the UC2 Profitability Tracking prototype (and the patterns shared with UC1 and UC5): dark header, disclaimer strip, filter card, section headings with the user story, 5–8 key-figure tiles per view, hierarchical tables with a column chooser and Excel export, charts with a table view, and a bottom tab bar.

The requirements workbook **UC3_KPIs_Definitions_and_Mapping_v3.xlsx** (updated with the UC3 Technical Requirements review of **Nov 17, 2026**) is the source of truth for views, KPI names, formulas, filters and open-question numbers. Nothing outside it is shown, except the **Hot Buy Score**, which is a placeholder ("Scoring method to be defined").

> **Illustrative data only.** Every figure is simulated. Brand and vendor names are real consumer brands used for illustration only; no figure reflects Weis Markets or vendor results. There is no customer, card or employee data. Store and district numbers follow the UC2 structure.

## Run it

```bash
npm install
npm run set-access-password   # once: asks for a password and writes only its salted hash to .env.local
npm run dev                   # http://localhost:5173
npm test                      # Vitest: KPI formulas, edge cases, data coherence, planted stories, filters, UPC parser, access gate
npm run lint                  # zero warnings allowed
npm run build                 # type-check + production build
npm run test:e2e              # builds a throwaway copy with a one-time password and clicks through it in headless Chrome
```

Node 20 or newer. `npm run test:e2e` needs a local Chrome or Chromium (set `CHROME_PATH` if it is not in the usual place); `SCREENSHOTS=/some/folder npm run test:e2e` also saves one PNG per view. `BASE_URL=https://… E2E_PASSWORD=… node scripts/e2e.mjs` runs the same checks against a deployed URL.

### Environment variables

| Variable | Required | What it is |
|---|---|---|
| `VITE_ACCESS_PASSWORD_HASH` (or `ACCESS_PASSWORD_HASH`) | Yes | Salted SHA-256 hash (64 hex characters) of the demo password. Either name works; `vite.config.ts` passes only this value to the build. Create it with `npm run set-access-password` (local) or set it in Vercel → Project Settings → Environment Variables. **Without a valid value nobody can enter** (the gate fails closed; there is no default password). |

The gate is the UC5 mechanism: only the hash is embedded, the check runs in constant time, and the session ends when the tab closes or with **Lock**. It is a demo barrier, not security: the hash ships in the public bundle, so use a long, unique password and keep the data synthetic. Real protection would need platform-level authentication (for example Vercel Deployment Protection).


## Views

Five views, in the order of the requirements. Every view lists its user story and the definitions still pending. **Promo Funding was removed** (question #2, answered Nov 17: vendor funding analytics live in the DMP tool; see the note on the tool name below).

| # | View | Priority | What it shows |
|---|---|---|---|
| 1 | **Hot Buy Performance** | Must Have | Hot Buys from the price group: tiles (Promo Sales gross and net customer, Promo Units, Sales / Unit Lift %, Promo GM $ / %, Incremental GM $, Net Incremental GM $), one row per event with SKU drill-down and roll-up to Subcategory / Category / Department, daily sales vs. baseline, category bridge (promo item lift → cannibalization → net → rest of category → category incremental). Hot Buy Score as a placeholder note. The only view with Region / District / Store. |
| 2 | **Other Promo Performance** | Must Have | Same layout for TPR, BOGO, Price Lock and other temporary price reductions; each SKU's share of the price group (Seasonal / Everyday tag); runs of the same promo side by side. |
| 3 | **Promo Run Trend** | Must Have (#8, answered Nov 17) | The MVP: each run of the same promotion (price group + promo type) side by side, with Last Year Gross Sales and YoY growth; trend of lift and Net Incremental GM across runs. Uses all promo history by default. Secondary section, **Level 2 · not MVP**: units before, during and after each promo vs. baseline, with Post-Promo Dip % over the 4 weeks after the promo. |
| 4 | **Promo History** | Should Have · *Definition pending (#10)* | Every past promo for a SKU Number or price group with dates, type, depth, ad type and results; lift and margin by Promo Depth Band and by Ad Type; results by fiscal period or week. Holiday Periods filter. |
| 5 | **Promo Shopper Impact** | Should Have · *Definition pending (#12)* | One panel per event with Promo Buyer Count, Avg Basket Size $, Spend Change %, Units per Basket, New-to-Category % (#11), Category Trips, each vs. the same buyers' usual; Transaction Count and Repeat Purchase Rate % (level 2) in the tiles and the table. **Aggregates only**. To be trimmed once the 6–8 core metrics are agreed (#9). |

> **Tool name to confirm:** the workbook says "DNP tool" and the Nov 17 meeting transcript says "DMP tool" for where vendor funding analytics live. The prototype uses "DMP tool" in the open questions until it is confirmed.

### Rules used everywhere

- **Price group first** (Item Group / Price Association): every table starts at the price group (one row per event), drills down to SKU Number and rolls up to Subcategory / Category / Department. Clorox Clean-Up and Clorox Wipes are separate price groups. Whether the price association table keeps history is pending (#13).
- **Gross Sales and Net Customer Sales** are shown separately. The **Sales basis** control (default **Net Customer**) sets the sales used for Promo Sales $, baseline, lift, incremental and margin.
- **Ad week**: Thursday to Wednesday. Fiscal weeks, periods and quarters keep the UC2 Weis 4-4-5 calendar (Sunday to Saturday).
- **Events are included when they start in the selected range**; their metrics use every day of the event.
- **Baseline**: average of the N weeks before the event (2, 4 [default], 8, 13 or 52), scaled to the promo days. Prior promo weeks inside the window are included (noted next to the control, Definition pending #4).
- **Cannibalization**: within the promo window, at brand, brand-category or category level, items with the same unit of measure, excluding the promoted price group (#3). Measured for the price group, so SKU rows show — with the tooltip "Measured at price group level" (also on the measures built on it: category incremental and net incremental).
- **Vendor promo funding** is an internal input of Net GM $ and Net Incremental GM $ (all funding types, counted once; #7). It is not shown as a KPI of its own; Promo Investment $, Vendor-Funded %, Weis-Funded Promo Cost $ and Promo ROI were removed with the Promo Funding view.
- **Every rate is a ratio of totals** and every division is guarded (— instead of an error). Each (ea) and pounds (lb) are never added together.
- Filters a view does not use are greyed out with "Not a filter for this view in the requirements workbook" and never change its numbers.
- **Date range can be typed** (mm/dd/yyyy, Enter or leaving the field) or picked from the calendar. **Paste UPCs**: up to 200 PLUs (4–5 digits), UPC-A (12) or EAN-13 (13) with a valid check digit; invalid and unknown codes are reported back.

## KPI traceability (view → KPI → definition)

Generated from `src/lib/definitions.ts`, which also feeds the in-app **KPI definitions** dialog. Formulas live in `src/lib/kpis.ts` (pure functions) and are combined in `src/lib/metrics.ts`. Status: *Workbook* (a row of the KPI sheet), *Definition pending #N* (open question N; "also" lists other questions it depends on), *Level 2 · not MVP*, or *User story 3 (no KPI row yet)*.

| View | KPI | Priority | Definition | Calculation | Status |
|---|---|---|---|---|---|
| Hot Buy Performance | Total Gross Sales | Must Have | Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC2, applied to the promo period. | SUM(Gross Sales) of the promoted items, promo start to end date | Workbook |
| Hot Buy Performance | Total Net Customer Sales | Must Have | Promo Sales $ after discounts (coupons and other customer discounts). Default sales basis for lift, incremental and margin; the Sales basis control switches to Gross Sales. | Gross Sales − Discounts | Workbook |
| Hot Buy Performance | Promo Units / Total Volume | Must Have | Units sold of the promoted item(s) on the days the promotion is active. Random-weight items (Meat, loose Produce) count pounds; each and pounds are never added together. | SUM(units) where sale date is between promo start and end date | Workbook |
| Hot Buy Performance | Baseline Sales $ | Must Have | Expected sales dollars of the promoted item if it had not been on promotion. | Average daily sales of the N weeks before the promo (default 4, adjustable) × promo days | Definition pending #4 |
| Hot Buy Performance | Baseline Units | Must Have | Expected units of the promoted item if it had not been on promotion. | Same method as Baseline Sales $, using units | Definition pending #4 |
| Hot Buy Performance | Incremental Sales $ / Units | Must Have | Extra sales dollars (units) above baseline during the promotion. | Promo Sales $ − Baseline Sales $ ; Promo Units − Baseline Units | Workbook |
| Hot Buy Performance | Sales Lift % | Must Have | Percent increase in sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $ | Workbook |
| Hot Buy Performance | Unit Lift % | Must Have | Percent increase in units vs. baseline. | Incremental Units ÷ Baseline Units | Workbook |
| Hot Buy Performance | Promo Gross Margin $ | Must Have | Gross margin dollars on the promoted item(s) during the promotion, before vendor promo funding. Same GM definition as UC2; the cost logic across departments is pending (#15). | Promo Sales $ − Cost of goods sold for promo units | Definition pending #15 |
| Hot Buy Performance | Promo Gross Margin % | Must Have | Gross margin rate during the promotion. Ratio of totals. Denominator pending (#5); cost logic also pending (#15). | Promo Gross Margin $ ÷ Promo Sales $ (Net Customer Sales by default) | Definition pending #5 (also #15) |
| Hot Buy Performance | Baseline Gross Margin $ | Must Have | Gross margin the item would have earned at regular price without the promotion. | Baseline Units × (Regular retail − Unit cost), from the baseline window | Definition pending #4 |
| Hot Buy Performance | Incremental Gross Margin $ | Must Have | Gross margin impact of the promotion vs. baseline, before vendor funding. | Promo Gross Margin $ − Baseline Gross Margin $ | Workbook |
| Hot Buy Performance | Net Gross Margin $ | Must Have | Gross margin after adding all vendor promo funding for the event (scan-downs, bill-backs and other promo allowances). Vendor Promo Funding $ is an internal input here, not a KPI of its own. | Promo Gross Margin $ + Vendor Promo Funding $ | Definition pending #7 |
| Hot Buy Performance | Category Incremental Sales $ / Gross Margin $ | Must Have | Change in total category sales (gross margin) vs. baseline during the promotion, including the promoted items. | Σ category items (promo window − baseline) | Workbook |
| Hot Buy Performance | Cannibalized Sales $ | Must Have | Change in sales of non-promoted items in the same group vs. their baseline during the promotion. Negative = cannibalization, positive = halo. The group follows the Cannibalization level control (brand, brand-category or category; same unit of measure). | Σ group items (promo window − baseline) | Definition pending #3 |
| Hot Buy Performance | Cannibalization Rate % | Must Have | Share of the promoted item's incremental units that came from other items in the group. Negative = halo. | −Cannibalized Units ÷ Incremental Units | Definition pending #3 |
| Hot Buy Performance | Net Incremental Sales $ | Must Have | Promoted item incremental sales after taking out sales lost from other items. | Incremental Sales $ + Cannibalized Sales $ | Workbook |
| Hot Buy Performance | Net Incremental Gross Margin $ | Must Have | Incremental gross margin after cannibalization and vendor funding. The main "did it pay off" number. | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Hot Buy Performance | Hot Buy Score | Nice to have | Overall rating of a Hot Buy's success built from the core metrics. Scoring method to be defined; shown as a placeholder only. | Scoring method to be defined | Placeholder |
| Other Promo Performance | Total Gross Sales | Must Have | Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC2, applied to the promo period. | SUM(Gross Sales) of the promoted items, promo start to end date | Workbook |
| Other Promo Performance | Total Net Customer Sales | Must Have | Promo Sales $ after discounts (coupons and other customer discounts). Default sales basis for lift, incremental and margin; the Sales basis control switches to Gross Sales. | Gross Sales − Discounts | Workbook |
| Other Promo Performance | Promo Units / Total Volume | Must Have | Units sold of the promoted item(s) on the days the promotion is active. Random-weight items (Meat, loose Produce) count pounds; each and pounds are never added together. | SUM(units) where sale date is between promo start and end date | Workbook |
| Other Promo Performance | Baseline Sales $ | Must Have | Expected sales dollars of the promoted item if it had not been on promotion. | Average daily sales of the N weeks before the promo (default 4, adjustable) × promo days | Definition pending #4 |
| Other Promo Performance | Baseline Units | Must Have | Expected units of the promoted item if it had not been on promotion. | Same method as Baseline Sales $, using units | Definition pending #4 |
| Other Promo Performance | Incremental Sales $ / Units | Must Have | Extra sales dollars (units) above baseline during the promotion. | Promo Sales $ − Baseline Sales $ ; Promo Units − Baseline Units | Workbook |
| Other Promo Performance | Sales Lift % | Must Have | Percent increase in sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $ | Workbook |
| Other Promo Performance | Unit Lift % | Must Have | Percent increase in units vs. baseline. | Incremental Units ÷ Baseline Units | Workbook |
| Other Promo Performance | Promo Gross Margin $ | Must Have | Gross margin dollars on the promoted item(s) during the promotion, before vendor promo funding. Same GM definition as UC2; the cost logic across departments is pending (#15). | Promo Sales $ − Cost of goods sold for promo units | Definition pending #15 |
| Other Promo Performance | Promo Gross Margin % | Must Have | Gross margin rate during the promotion. Ratio of totals. Denominator pending (#5); cost logic also pending (#15). | Promo Gross Margin $ ÷ Promo Sales $ (Net Customer Sales by default) | Definition pending #5 (also #15) |
| Other Promo Performance | Baseline Gross Margin $ | Must Have | Gross margin the item would have earned at regular price without the promotion. | Baseline Units × (Regular retail − Unit cost), from the baseline window | Definition pending #4 |
| Other Promo Performance | Incremental Gross Margin $ | Must Have | Gross margin impact of the promotion vs. baseline, before vendor funding. | Promo Gross Margin $ − Baseline Gross Margin $ | Workbook |
| Other Promo Performance | Net Gross Margin $ | Must Have | Gross margin after adding all vendor promo funding for the event (scan-downs, bill-backs and other promo allowances). Vendor Promo Funding $ is an internal input here, not a KPI of its own. | Promo Gross Margin $ + Vendor Promo Funding $ | Definition pending #7 |
| Other Promo Performance | Category Incremental Sales $ / Gross Margin $ | Must Have | Change in total category sales (gross margin) vs. baseline during the promotion, including the promoted items. | Σ category items (promo window − baseline) | Workbook |
| Other Promo Performance | Cannibalized Sales $ | Must Have | Change in sales of non-promoted items in the same group vs. their baseline during the promotion. Negative = cannibalization, positive = halo. The group follows the Cannibalization level control (brand, brand-category or category; same unit of measure). | Σ group items (promo window − baseline) | Definition pending #3 |
| Other Promo Performance | Net Incremental Gross Margin $ | Must Have | Incremental gross margin after cannibalization and vendor funding. The main "did it pay off" number. | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Promo Run Trend | Total Gross Sales | Must Have | Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC2, applied to the promo period. | SUM(Gross Sales) of the promoted items, promo start to end date | Workbook |
| Promo Run Trend | Promo Units / Total Volume | Must Have | Units sold of the promoted item(s) on the days the promotion is active. Random-weight items (Meat, loose Produce) count pounds; each and pounds are never added together. | SUM(units) where sale date is between promo start and end date | Workbook |
| Promo Run Trend | Sales Lift % | Must Have | Percent increase in sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $ | Workbook |
| Promo Run Trend | Unit Lift % | Must Have | Percent increase in units vs. baseline. | Incremental Units ÷ Baseline Units | Workbook |
| Promo Run Trend | Promo Gross Margin $ | Must Have | Gross margin dollars on the promoted item(s) during the promotion, before vendor promo funding. Same GM definition as UC2; the cost logic across departments is pending (#15). | Promo Sales $ − Cost of goods sold for promo units | Definition pending #15 |
| Promo Run Trend | Promo Gross Margin % | Must Have | Gross margin rate during the promotion. Ratio of totals. Denominator pending (#5); cost logic also pending (#15). | Promo Gross Margin $ ÷ Promo Sales $ (Net Customer Sales by default) | Definition pending #5 (also #15) |
| Promo Run Trend | Incremental Gross Margin $ | Must Have | Gross margin impact of the promotion vs. baseline, before vendor funding. | Promo Gross Margin $ − Baseline Gross Margin $ | Workbook |
| Promo Run Trend | Net Incremental Gross Margin $ | Must Have | Incremental gross margin after cannibalization and vendor funding. The main "did it pay off" number. | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Promo Run Trend | Promo Event Count | Should Have | Number of times an item or price group was promoted in the selected period. | COUNT(promo events) | Workbook |
| Promo Run Trend | Last Year Gross Sales | Must Have | Gross sales of the same items over the same days last year (364 days earlier, as in UC2). | SUM(Gross Sales) for promo days − 364 | User story 3 (no KPI row yet) |
| Promo Run Trend | YoY Gross Sales Growth ($ / %) | Must Have | Growth of promo gross sales vs. the same days last year. | $: TY − LY ; %: (TY − LY) ÷ LY | User story 3 (no KPI row yet) |
| Promo Run Trend | Post-Promo Dip % | Nice to have | Change in units in the 4 weeks after the promotion ends vs. baseline (pantry loading). Default window agreed Nov 17; whether it varies by promo type will be reviewed on the prototype. Shown as — until the 4 weeks have passed. | (Units in the 28 days after the promo − Baseline Units for the same days) ÷ Baseline Units | Level 2 · not MVP |
| Promo History | Sales Lift % | Must Have | Percent increase in sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $ | Workbook |
| Promo History | Unit Lift % | Must Have | Percent increase in units vs. baseline. | Incremental Units ÷ Baseline Units | Workbook |
| Promo History | Avg Promo Retail $ (Average Retail Price per Unit) | Nice to have | Average selling price per unit (or lb) during the promotion. | Promo Gross Sales $ ÷ Promo Units | Workbook |
| Promo History | Promo Depth % | Should Have | How deep the discount is vs. regular retail. BOGO counts as 50 %. | (Regular retail − Promo retail) ÷ Regular retail | Workbook |
| Promo History | Incremental Gross Margin $ | Must Have | Gross margin impact of the promotion vs. baseline, before vendor funding. | Promo Gross Margin $ − Baseline Gross Margin $ | Workbook |
| Promo History | Net Incremental Gross Margin $ | Must Have | Incremental gross margin after cannibalization and vendor funding. The main "did it pay off" number. | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Promo History | Promo Event Count | Should Have | Number of times an item or price group was promoted in the selected period. | COUNT(promo events) | Workbook |
| Promo Shopper Impact | Promo Buyer Count | Should Have | Number of club card households that bought the promoted item during the promotion. | COUNT DISTINCT club card households with a promo item purchase | Definition pending #12 |
| Promo Shopper Impact | Avg Basket Size $ | Should Have | Average total transaction dollars for transactions that include the promoted item. | Σ transaction $ ÷ transactions with the promo item | Definition pending #12 |
| Promo Shopper Impact | Promo Buyer Spend Change % | Should Have | Promo buyers' spend during the event vs. their usual spend. | Spend during the event ÷ usual spend − 1 | Definition pending #12 |
| Promo Shopper Impact | Units per Basket | Nice to have | Average units in transactions that include the promoted item. | Σ units ÷ transactions with the promo item | Definition pending #12 |
| Promo Shopper Impact | New-to-Category Buyers % | Should Have | Share of promo buyers who had not bought the category in the look-back period (52 weeks). The new-shopper logic comes from a third-party system (#11). | New-to-category buyers ÷ Promo Buyer Count | Definition pending #11 (also #12) |
| Promo Shopper Impact | Category Trips | Should Have | Trips by promo buyers that included any item in the category, vs. their usual. | COUNT(trips with a category item) by promo buyers | Definition pending #12 |
| Promo Shopper Impact | Transaction Count | Nice to have | Total store transactions during the promotion. Store traffic indicator. | COUNT(transactions) on promo days | Definition pending #12 |
| Promo Shopper Impact | Repeat Purchase Rate % | Nice to have | Share of promo buyers who bought the item again at regular price within 28 days after the promotion. Level 2 (not MVP). | Repeat buyers ÷ Promo Buyer Count | Definition pending #12 · Level 2 · not MVP |

## Assumptions and definitions pending

Marked in the interface as **Definition pending #N**, where N is the question number in the workbook tab "UC #3 - Open Questions" (renumbered on Nov 18, 2026 to match it). Decisions from the Nov 17 technical requirements review are included.

| # | Status | Item | Assumption in the prototype |
|---|---|---|---|
| 2 | Answered | Promo Funding scope | Answered Nov 17: vendor funding analytics live in the DMP tool, so the Promo Funding view is not part of this prototype. (The workbook says "DNP tool" and the meeting transcript "DMP tool"; name to confirm.) |
| 3 | Open | Cannibalization | Selector: brand, brand-category or category (default category), within the promo window, items with the same unit of measure. Source (Cognira vs. internal data) also pending (#19). |
| 4 | Partially answered | Baseline | The prototype keeps a 4-week default, adjustable to 2, 4, 8, 13 or 52 weeks; prior promo weeks inside the window are included. Nov 17: default to be set per promo type (e.g., 4 weeks for Hot Buys, about 3 months for TPRs / price locks) and easy to adjust; values pending confirmation by John Cooper. Inputs still conflict (4 prior weeks, previous promotion / same period LY, 104-week regular-price or rolling 52-week base). |
| 5 | Open | Promo Gross Margin % denominator | Net Customer Sales (default sales basis); the Sales basis control switches to Gross Sales. |
| 7 | Open | Which funding Net Gross Margin $ adds | All vendor promo funding (scan-down, bill-back and other promo allowances), in Net GM $ and Net Incremental GM $. Vendor Promo Funding $ is an internal input, not a KPI of its own. CNS stores receive the same allowance as a store shipment recap (bill back) instead of off-invoice at the DC; it must be counted once, not twice. |
| 8 | Answered | Promo Run Trend | Answered Nov 17: comparing the same promotion across runs or years is the MVP (Must Have). The before / during / after section and Post-Promo Dip % are level 2. |
| 9 | Open | Core metrics | Narrow to about 6–8 for the prototype; list pending from John Cooper and Michael Green. |
| 10 | Open | Promo History attributes and objective | Ad Type / Vehicle (front page, inside page, digital, display, no ad) and Promo Depth Band (under 15 %, 15–25 %, 25–35 %, 35–50 %, 50 % and over) as in the workbook; the objective of the view is pending. |
| 11 | Open | New-to-Category Buyers logic | The new-shopper logic comes from a third-party system; the prototype uses a 52-week category look-back. |
| 12 | Open | Promo Shopper Impact KPIs | Source pending: Symphony AI vs. Weis Club Card data. Workbook definitions; aggregates per event only; "usual" = the same buyers over the baseline window. Nov 17: there is no Symphony AI data feed (Excel exports only); the intent is to calculate from Weis Club Card data. The view will be trimmed once the 6–8 core metrics are agreed (#9). |
| 13 | Open | Price groups | Price association table in Retalix HQ / HQ Analytics; whether it keeps history is pending. The prototype uses a fixed price group per SKU. |
| 15 | Open | Cost | Same cost logic in every department; Fresh has doubts about the margin. Affects Promo GM $ and Promo GM %. |
| 19 | Open | Data source direction | Cognira vs. Weis internal data; affects baseline, cannibalization, the promo calendar and reconciliation. |
| — | Note | Promo Investment $ | Removed from the prototype with the Promo Funding view; where it belongs is pending (Harrison asked for club spend at item level). The generator still produces it as the base of vendor funding. |

Other prototype assumptions (to review):

- Durations: Hot Buy = one ad week; TPR 1–8 weeks; Price Lock 4–13 weeks; BOGO and Other 1–2 weeks. BOGO counts as 50 % depth.
- The baseline window does not exclude earlier promo weeks inside it (a 13- or 52-week window will include other runs). A default per promo type (#4) is not implemented until the values are confirmed.
- Vendor Promo Funding = a share of the event's Promo Investment, split by funding type (scan-down, bill-back, other promo allowance), each allowance counted once. It is generated but only used inside Net GM $ and Net Incremental GM $.
- Post-Promo Dip % (level 2) uses the 4 weeks (28 days) after the event and shows — until they have passed. Repeat Purchase Rate % (level 2) needs 28 days after the event.
- "Usual" for shopper metrics = the same buyers over the baseline window. Promo Buyer Count is summed across events and labelled "Sum across events (not unique households)" wherever more than one event is added; Transaction Count counts each promo day once.
- Store values (Hot Buy Performance only) = chain value × the selected stores' share of the department.
- A SKU, Vendor / Brand or pasted-UPC filter narrows the items inside each price group; cannibalization and category change stay measured for the whole price group.
- Departments: Grocery, Dairy, Frozen, HBC and GM (UC1 names) plus Meat and Produce (UC2 names). Random-weight Meat and loose Produce sell by the pound (PLUs).
- Data runs from FY2024 (Sun 12/31/2023) to Sun 11/15/2026 (FY2026 W47); the last complete ad week is 11/05–11/11/2026.

## Dummy data

Same convention as UC2: seeded generator (`SEED`, mulberry32 and a stateless hash), chain-level item × day cubes stored as prefix sums, store shares by department, the UC2 store and district structure, and the Weis fiscal calendar. About 110 SKUs in 57 price groups and about 600 promo events over almost three years, all four promo types plus Other. The numbers tie out by construction (incremental = promo − baseline, lift = incremental ÷ baseline, Net GM = GM + vendor funding, Net Incremental GM = Incremental GM + Cannibalized GM + vendor funding); `src/lib/metrics.test.ts` checks it for every event. Pantry loading after a promo lasts about 4 weeks in the generator (full for two weeks, then fading).

Planted stories (asserted in `src/data/generate.test.ts`; numbers on screen always come from the data):

| Story | Where to see it |
|---|---|
| **Cheerios Family Size Hot Buy**, run every Q1, Q2 and Q3 since FY2024; lift falls each year and FY2026 is below last year | Promo Run Trend (default view) |
| **Coca-Cola 2 L Hot Buy** (July 4 and Labor Day 2026): lift above 100 % but high cannibalization of the 12-packs; Net Incremental GM negative | Hot Buy Performance (Rolling 52 weeks or All history), Cannibalization level |
| **Chobani BOGO** (March 2026): units up, sales down, Incremental GM negative | Other Promo Performance |
| **Tide Hot Buy** (October 2026): fully vendor funded, so a negative Incremental GM $ becomes a positive Net Incremental GM $ | Hot Buy Performance (Incremental GM $ vs. Net Incremental GM $) |
| **Bounty Hot Buy** (April 2025 and 2026): Post-Promo Dip below −30 % over the 4 weeks after the promo (pantry loading) | Promo Run Trend, pick Bounty (Level 2 section) |
| **M&M's Sharing Size**: the Halloween item drives the October Hot Buy; everyday items drive the March TPR | Other / Hot Buy Performance, expand the row |
| **Clorox Wipes vs. Clorox Clean-Up**: separate price groups; the Wipes Hot Buy cannibalizes Clean-Up at brand level | Hot Buy Performance, Brand level |
| **Ground Beef 80/20 Hot Buys** (Memorial Day, July 4), sold by the pound | Hot Buy Performance, Meat |
| **Ragú TPR** (January 2026): halo on Barilla pasta | Other Promo Performance, Category level |
| **Weis Quality Water Price Lock** (March 2026, 6 weeks): own brand with no vendor funding, so Net GM $ equals Promo GM $ | Other Promo Performance (Columns › Net GM $) |

## Where things live

```
src/data/calendar.ts     Weis fiscal calendar (from UC2) + ad weeks (Thursday–Wednesday), holidays
src/data/stores.ts       200 stores, 3 regions, 12 districts (from UC2)
src/data/products.ts     Department › Category › Subcategory › Price Group › SKU, brands, vendors, UPC / PLU
src/data/promos.ts       promo event master: types, durations, depth, ad type, vendor funding inputs, planted stories
src/data/generate.ts     seeded item × day cubes (units, gross, net, cost, markdown), 4-week pantry loading, store shares
src/lib/kpis.ts          every KPI formula from the workbook (pure, typed, null-guarded)
src/lib/metrics.ts       event totals (promo, baseline, cannibalization, category, 4 weeks after, LY) and KPI derivation;
                         POST_PROMO_WINDOW_DAYS = 28
src/lib/shopper.ts       club card aggregates per event (no customer-level data)
src/lib/filters.ts       filter state, URL sync with validation, time resolution, filters by view (five views)
src/lib/selectors.ts     scope: events and items selected by the filters
src/lib/upc.ts           UPC / PLU validation and the pasted-list parser
src/lib/accessGate.ts    demo access gate (salted hash, constant-time check, fails closed)
src/lib/definitions.ts   KPI definitions, status (pending / level 2 / user story) and open questions numbered as in the workbook
src/components/          header, filter card, price group picker, tables, charts, definitions dialog
src/views/               one file per view (Hot Buy and Other Promo share PerformanceView)
scripts/e2e.mjs          end-to-end check in headless Chrome (no dependencies)
scripts/set-access-password.mjs   writes the password hash to .env.local
```

## Security and hygiene

- No secrets, passwords or keys in the code or the repository; `.env*` files are ignored (except `.env.example`, which has no value).
- No `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`; all text renders through React.
- Every input is validated and length-capped: URL parameters (unknown values fall back to defaults, including the retired `tab=funding` and funding filter; queries over 2,000 characters are ignored), typed dates, search text, the password (200 characters) and the pasted UPC list (4,000 characters, 200 codes, digits only with a valid check digit). The pasted list is never put in the URL.
- Excel export uses UC2's own dependency-free writer (`src/lib/xlsx.ts`, no npm package); exports guard against spreadsheet formula injection (from UC2).
- Errors show a generic message; details go to the browser console only.
- Strict Content-Security-Policy in `index.html` and `vercel.json` (`self` only; fonts are bundled with `@fontsource`, so nothing loads from a CDN), plus `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS and `noindex`.
- Dependencies are pinned to exact versions from the npm registry (same as UC2, plus `@fontsource/nunito-sans` and `@fontsource/space-mono` 5.3.0). Recommended before a real deployment: generate an SBOM, for example `npx @cyclonedx/cyclonedx-npm --output-file sbom.json`.

## Deploy

Deployed on Vercel from `main` (each push to `main` redeploys). `vercel.json` sets Vite, `npm ci`, `npm run build`, `dist` and the security headers. The project needs `VITE_ACCESS_PASSWORD_HASH` or `ACCESS_PASSWORD_HASH` (Production, and Preview if previews should open); redeploy after changing it, because the value is fixed at build time.
