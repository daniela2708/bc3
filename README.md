# Weis · Promo Effectiveness (UC3 prototype)

A clickable, preliminary prototype of Use Case 3, **Promo Effectiveness**, for Weis Markets. It follows the structure, stack and look of the UC2 Profitability Tracking prototype (and the patterns shared with UC1 and UC5): dark header, disclaimer strip, filter card, a title per view followed by 5–8 key-figure tiles (see Layout rules), hierarchical tables with a column chooser and Excel export, charts with a table view, and a bottom tab bar.

The requirements workbook **UC3_KPIs_Definitions_and_Mapping.xlsx** is the source of truth for views, KPI names, priorities, definitions, calculations, filters and open-question numbers and statuses. Every KPI shown traces to a row of its KPI sheet, except the ones listed with another status in the traceability table below (Total Gross Sales and LY / YoY reuse UC1 definitions; Baseline Sales $ and Baseline Units are kept because the lift KPIs need them, #4) and the **Hot Buy Score**, which is a placeholder ("Scoring method to be defined").

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

Six tabs: the views of the requirements workbook, in its order (Hot Buy Performance, Other Promo Performance, Post-Promo Trend, Promo History, Promo Shopper Impact, Promo Run Trend). Each view's priority, user story and the definitions still pending are in the **KPI definitions** dialog; the views themselves start with the title and the key figures (see Layout rules). **Promo Funding is not part of this dashboard** (#2: vendor funding analytics live in the DNP tool), and neither are the Funding Type filter, Vendor-Funded %, Weis-Funded Promo Cost $ and Promo ROI.

| # | View | Priority | What it shows |
|---|---|---|---|
| 1 | **Hot Buy Performance** | Must Have | Tiles (Promo Sales gross and net customer, Promo Units, Sales / Unit Lift %, Promo GM $ / %, Incremental GM $, Net Incremental GM $) with the Hot Buy Score placeholder note; daily sales vs. baseline and the category / subcategory bridge (promo item lift → cannibalization → net → rest of category → category incremental); then one row per event with SKU drill-down and roll-up to Subcategory / Category / Department. The only view with Region / District / Store. Baseline default 4 weeks (#4). |
| 2 | **Other Promo Performance** | Must Have | Same layout for TPR, BOGO, Price Lock and other temporary price reductions (the extra KPI columns start hidden in the column chooser), with each SKU's share of the price group (Seasonal / Everyday tag); last, the runs of the same promo side by side. Baseline default 13 weeks (#4). |
| 3 | **Post-Promo Trend** | Nice to have · **Level 2 · not MVP** (#8) | Tiles for Post-Promo Dip % (4-week post-promo window) and Repeat Purchase Rate %; daily units and sales before, during and after the selected promo vs. baseline; then the post-promo summary by category with each event underneath (click an event to chart it). Baseline: the default of each event's promo type (#4). |
| 4 | **Promo History** | Should Have · *Definition pending (#10)* | Tiles; results by fiscal period or week; lift and margin by Promo Depth Band and by Ad Type; then every past promo for a SKU Number or price group with dates, type, depth, ad type and results. Holiday Periods filter. Baseline: the default of each event's promo type (#4). |
| 5 | **Promo Shopper Impact** | Should Have · *Definition pending (#16)* | Tiles; one panel per event with Promo Buyer Count, Avg Basket Size $, Spend Change %, Units per Basket, New-to-Category % (#11), Category Trips, each vs. the same buyers' usual; Transaction Count and Repeat Purchase Rate % (level 2) in the tiles and the table, which comes last. Calculated from the Weis T-log and Club Card tables; Symphony AI is only a reference for comparison (#12). **Aggregates only. Individual-level detail requires approval (#16).** About 6 to 8 core metrics will be kept (#9). Baseline: the default of each event's promo type (#4). |
| 6 | **Promo Run Trend** | Must Have (#8) | The MVP: tiles; lift and Net Incremental GM across runs; each run of the same promotion (price group + promo type) side by side, with Last Year Gross Sales and YoY growth. Uses all promo history by default. Baseline: the default of each event's promo type (#4). |

### Rules used everywhere

- **Price group first** (Item Group / Price Association): every table starts at the price group (one row per event), drills down to SKU Number and rolls up to Subcategory / Category / Department. Clorox Clean-Up and Clorox Wipes are separate price groups. Whether the price association table keeps history is pending (#13).
- **Gross Sales and Net Customer Sales** are shown separately. The **Sales basis** control (default **Net Customer**) sets the sales used for Promo Sales $, baseline, lift, incremental and margin.
- **Ad week**: Thursday to Wednesday by default, defined once in `AD_WEEK` (`src/data/calendar.ts`) so it stays configurable (#6); holiday exceptions in the ad calendar are not simulated. Fiscal weeks, periods and quarters keep the UC2 Weis 4-4-5 calendar (Sunday to Saturday).
- **Events are included when they start in the selected range**; their metrics use every day of the event.
- **Baseline**: average of the N weeks before the event, scaled to the promo days. Proposed defaults (#4): Hot Buy Performance 4 weeks; Other Promo Performance 13 weeks; Promo Run Trend, Promo History and Promo Shopper Impact the default of each event's promo type (Hot Buy 4, TPR / BOGO / Price Lock 13; Other temporary price reduction also 13, the Other Promo Performance default). The user can pick 2, 4, 8, 13 or 52 weeks in any view; the control says "Proposed default, pending confirmation (#4)". Prior promo weeks inside the window are included.
- **Cannibalization**: within the promo window, at **Subcategory** (default, as in the workbook KPI rows), brand, brand-category or category level, items with the same unit of measure, excluding the promoted price group (#3). Measured for the price group, so SKU rows show — with the tooltip "Measured at price group level" (also on the measures built on it: category incremental and net incremental).
- **Cost (#15)**: every item is DC or DSD (`source` in `src/data/products.ts`). DC items use the DC average cost minus scan-downs; DSD items use the replacement cost that day (`src/lib/cost.ts`). Random weight cost is being corrected and meat scope is pending (#15); the tooltips of Promo Units and the margin metrics say so.
- **Vendor promo funding (#7)** is an internal input of Net GM $ and Net Incremental GM $, not a KPI of its own: HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. A DC scan-down is already in the DC cost (#15), so Net GM $ does not add it again: for DC items Net GM $ adds only other promo allowances. Whether margin metrics stay at all is pending (#7).
- **Every rate is a ratio of totals** and every division is guarded (— instead of an error). Each (ea) and pounds (lb) are never added together.
- Filters a view does not use are greyed out with "Not a filter for this view in the requirements workbook" and never change its numbers.
- **Date range can be typed** (mm/dd/yyyy, Enter or leaving the field) or picked from the calendar. **Paste UPCs**: up to 200 PLUs (4–5 digits), UPC-A (12) or EAN-13 (13) with a valid check digit; invalid and unknown codes are reported back.

## Layout rules

Every view follows these rules. Apply them to any new view or change (they are also in `CLAUDE.md`). `npm run test:e2e` checks rules 1 and 2 in every view.

**Rule 1: cascade, from general to particular.** Top to bottom, every view shows:

1. The view title.
2. The key figures (tiles with the main KPIs).
3. Charts, from the most general to the most detailed (trends or totals first, breakdowns after).
4. Tables, from the most aggregated to the most detailed (summary first, then the drill-down table).
5. Level 2 sections (**Level 2 · not MVP**), always last.

No table comes before a chart of the same view. The view controls (baseline window, cannibalization level, sales basis, rows) sit between the title and the tiles as part of the filter bar; the one-line reading of the key figures and the notices (banners, privacy notes) sit right after the tiles.

| View | Order |
|---|---|
| Hot Buy Performance | Tiles → Daily sales vs. baseline and Category / subcategory bridge → Hot Buy events by price group (hierarchical table) |
| Other Promo Performance | Tiles → Daily sales vs. baseline and Category bridge → Promotions by price group (hierarchical table) → Runs of the same promo |
| Post-Promo Trend (Level 2 tab) | Tiles → Daily units and Daily sales vs. baseline for the selected promo → Post-promo summary by category (events underneath) |
| Promo History | Tiles → Results by fiscal period or week → Sales Lift % and Net Incremental GM $ by Promo Depth Band and by Ad Type / Vehicle → Every past promotion |
| Promo Shopper Impact | Tiles → One panel per event → All events (table) |
| Promo Run Trend | Tiles → Lift across runs and Net Incremental GM $ per run → Each run side by side |

**Rule 2: no business-context block on top.** A view starts with its title and goes straight to the key figures: no eyebrow (priority, "View N of 6"), no user story, no question and no "to validate" text above the content. That information lives in the **KPI definitions** dialog, one entry per view with its priority, question, user story and what is still to validate (with open-question numbers), from `src/lib/viewInfo.ts`. The **Definition pending #N** and **Level 2 · not MVP** chips stay next to each KPI, chart or table (and next to the title when the whole view is pending). `SectionHeading` takes only a title and an optional chip.

**Rule 3: consistency.** The same spacing and the same components in every view: `KeyFigures` tiles, `ChartGrid` / `ChartCard` for charts (each keeps its table view), `HierTable` for tables (each keeps its column chooser and Excel export). Layout changes never change calculations, filters or data.

## KPI traceability (view → KPI → definition)

Generated from `src/lib/definitions.ts` by `src/lib/readme.ts` (`src/lib/readme.test.ts` fails if this table and the code differ); the same definitions feed the in-app **KPI definitions** dialog. Names, priorities, definitions and calculations are those of the workbook KPI sheet; a sentence after the workbook text says how the prototype applies it. Formulas live in `src/lib/kpis.ts` (pure functions) and are combined in `src/lib/metrics.ts`. Status: *Workbook* (a row of the KPI sheet), *Definition pending #N* (open question N; "also" lists other questions it depends on), *Level 2 · not MVP*, *UC1 definition (reused)*, or *Not in the current KPI sheet (#4)*.

| View | KPI | Priority | Definition | Calculation | Status |
|---|---|---|---|---|---|
| Hot Buy Performance | Total Gross Sales | Must Have | Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC1, applied to the promo period. | SUM(Gross Sales) of the promoted items, promo start to end date | UC1 definition (Total Gross Sales), used by the Sales basis control and LY / YoY (#5) |
| Hot Buy Performance | Net Customer Sales | Must Have | Sales after item-level and non-item discounts, such as points (Day, WTD, Period-to-Date, QTD, 26-week rolling, YTD). The Category Performance Report (PowerBI) shows it. It is not accounting net sales. In the prototype: Promo Sales $ on promo days and the default sales basis for lift, incremental and margin (#5). | Gross Sales − Discounts | Workbook |
| Hot Buy Performance | Promo Units | Must Have | Units sold of the promoted item(s) on the days the promotion is active (within selected promo-timeframe). Random-weight items count pounds, as in Total Volume (UC2); each and pounds are never added together. Random weight cost is being corrected; meat scope pending (#15). | Sum of units sold for promoted item(s) where sale date is between promo start and end date. | Workbook |
| Hot Buy Performance | Baseline Sales $ | Must Have | Expected sales dollars of the promoted item if it had not been on promotion. Kept because the lift KPIs need it. | Average daily sales of the N weeks before the promo × promo days. Proposed default N: 4 weeks for Hot Buys, 13 for TPRs, BOGOs and price locks (adjustable) | Not in the current KPI sheet (#4) · Definition pending #4 |
| Hot Buy Performance | Baseline Units | Must Have | Expected units of the promoted item if it had not been on promotion. Kept because the lift KPIs need it. | Same method as Baseline Sales $, using units | Not in the current KPI sheet (#4) · Definition pending #4 |
| Hot Buy Performance | Incremental Sales $ | Must Have | Extra sales dollars of the promoted item above its baseline during the promotion (lift $) (within selected promo-timeframe). | Promo Sales $ − Baseline Sales $ | Workbook |
| Hot Buy Performance | Incremental Units | Must Have | Extra units of the promoted item above its baseline during the promotion. | Promo Units − Baseline Units | Workbook |
| Hot Buy Performance | Sales Lift % | Must Have | Percent increase in promoted item sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $, matching the lift CMs look at today. Confirm. | Workbook |
| Hot Buy Performance | Unit Lift % | Must Have | Percent increase in promoted item units vs. baseline. | Incremental Units ÷ Baseline Units, matching the lift CMs look at today. Confirm. | Workbook |
| Hot Buy Performance | Promo Gross Margin $ | Must Have | Gross margin dollars earned on the promoted item(s) during the promotion, before vendor promo funding. Cost (#15): DC items use the DC end-of-day average cost minus scan-downs; DSD items use the net replacement cost in the store that day. Random weight cost is being corrected; meat scope pending (#15). | Promo Sales $ − Cost of goods sold for promo units. Same GM definition as UC #2. | Definition pending #15 (also #7) |
| Hot Buy Performance | Promo Gross Margin % | Must Have | Gross margin rate on the promoted item(s) during the promotion. Ratio of totals. The denominator is pending (#5); the prototype divides by the selected sales basis (Net Customer Sales by default). Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ ÷ Promo Sales $ | Definition pending #5 (also #7, #15) |
| Hot Buy Performance | Baseline Gross Margin $ | Must Have | Gross margin dollars the promoted item would have earned at regular price without the promotion. Random weight cost is being corrected; meat scope pending (#15). | Baseline Units × (Regular retail − Unit cost), using the existing baseline method. | Definition pending #4 (also #7) |
| Hot Buy Performance | Incremental Gross Margin $ | Must Have | Gross margin dollar impact of the promotion vs. baseline for the promoted item. Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ − Baseline Gross Margin $ | Definition pending #7 |
| Hot Buy Performance | Net Gross Margin $ | Must Have | Gross margin dollars on the promoted item(s) after adding vendor promo funding for the event. Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2). Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ + Vendor Promo Funding $ | Definition pending #7 |
| Hot Buy Performance | Category Incremental Sales $ | Must Have | Change in total subcategory / category sales dollars vs. baseline during the promotion, including the promoted item. The prototype measures the category. | Category / subcategory sales $ during promo days vs. the existing baseline, as shown in Michael Green's Hot Buy slides. Confirm. | Workbook |
| Hot Buy Performance | Category Incremental Gross Margin $ | Must Have | Change in total subcategory / category gross margin dollars vs. baseline during the promotion. The prototype measures the category. Random weight cost is being corrected; meat scope pending (#15). | Category / subcategory GM $ during promo days vs. the existing baseline. Confirm. | Definition pending #7 |
| Hot Buy Performance | Cannibalized Sales $ | Must Have | Change in sales of non-promoted items in the same subcategory vs. their baseline during the promotion. Negative = cannibalization, positive = halo. The group follows the Cannibalization level control (default Subcategory; also brand, brand-category or category), within the promo window, same unit of measure. | Existing method from Michael Green's Hot Buy slides: change in sales of non-promoted like items vs. baseline on promo days. Confirm. | Definition pending #3 |
| Hot Buy Performance | Cannibalization Rate % | Must Have | Share of the promoted item's incremental units that came from other items in the subcategory. Negative = halo. The group follows the Cannibalization level control (default Subcategory; also brand, brand-category or category), within the promo window, same unit of measure. | As calculated in Michael Green's Hot Buy slides. Confirm. Prototype: −Cannibalized Units ÷ Incremental Units. | Definition pending #3 |
| Hot Buy Performance | Net Incremental Sales $ | Must Have | Promoted item incremental sales after taking out sales lost from other items in the subcategory (the group set by the Cannibalization level control). | Incremental Sales $ + Cannibalized Sales $ | Workbook |
| Hot Buy Performance | Net Incremental Gross Margin $ | Must Have | Promoted item incremental gross margin after cannibalization and vendor funding. The main 'did it pay off' number. Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2). Random weight cost is being corrected; meat scope pending (#15). | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Hot Buy Performance | Hot Buy Score | Nice to have | Overall rating of a Hot Buy's success built from the core metrics. Scoring method to be defined; shown as a placeholder only. | Scoring method to be defined | Placeholder |
| Other Promo Performance | Total Gross Sales | Must Have | Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC1, applied to the promo period. | SUM(Gross Sales) of the promoted items, promo start to end date | UC1 definition (Total Gross Sales), used by the Sales basis control and LY / YoY (#5) |
| Other Promo Performance | Net Customer Sales | Must Have | Sales after item-level and non-item discounts, such as points (Day, WTD, Period-to-Date, QTD, 26-week rolling, YTD). The Category Performance Report (PowerBI) shows it. It is not accounting net sales. In the prototype: Promo Sales $ on promo days and the default sales basis for lift, incremental and margin (#5). | Gross Sales − Discounts | Workbook |
| Other Promo Performance | Promo Units | Must Have | Units sold of the promoted item(s) on the days the promotion is active (within selected promo-timeframe). Random-weight items count pounds, as in Total Volume (UC2); each and pounds are never added together. Random weight cost is being corrected; meat scope pending (#15). | Sum of units sold for promoted item(s) where sale date is between promo start and end date. | Workbook |
| Other Promo Performance | Baseline Sales $ | Must Have | Expected sales dollars of the promoted item if it had not been on promotion. Kept because the lift KPIs need it. | Average daily sales of the N weeks before the promo × promo days. Proposed default N: 4 weeks for Hot Buys, 13 for TPRs, BOGOs and price locks (adjustable) | Not in the current KPI sheet (#4) · Definition pending #4 |
| Other Promo Performance | Baseline Units | Must Have | Expected units of the promoted item if it had not been on promotion. Kept because the lift KPIs need it. | Same method as Baseline Sales $, using units | Not in the current KPI sheet (#4) · Definition pending #4 |
| Other Promo Performance | Incremental Sales $ | Must Have | Extra sales dollars of the promoted item above its baseline during the promotion (lift $) (within selected promo-timeframe). | Promo Sales $ − Baseline Sales $ | Workbook |
| Other Promo Performance | Incremental Units | Must Have | Extra units of the promoted item above its baseline during the promotion. | Promo Units − Baseline Units | Workbook |
| Other Promo Performance | Sales Lift % | Must Have | Percent increase in promoted item sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $, matching the lift CMs look at today. Confirm. | Workbook |
| Other Promo Performance | Unit Lift % | Must Have | Percent increase in promoted item units vs. baseline. | Incremental Units ÷ Baseline Units, matching the lift CMs look at today. Confirm. | Workbook |
| Other Promo Performance | Promo Gross Margin $ | Must Have | Gross margin dollars earned on the promoted item(s) during the promotion, before vendor promo funding. Cost (#15): DC items use the DC end-of-day average cost minus scan-downs; DSD items use the net replacement cost in the store that day. Random weight cost is being corrected; meat scope pending (#15). | Promo Sales $ − Cost of goods sold for promo units. Same GM definition as UC #2. | Definition pending #15 (also #7) |
| Other Promo Performance | Promo Gross Margin % | Must Have | Gross margin rate on the promoted item(s) during the promotion. Ratio of totals. The denominator is pending (#5); the prototype divides by the selected sales basis (Net Customer Sales by default). Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ ÷ Promo Sales $ | Definition pending #5 (also #7, #15) |
| Other Promo Performance | Baseline Gross Margin $ | Must Have | Gross margin dollars the promoted item would have earned at regular price without the promotion. Random weight cost is being corrected; meat scope pending (#15). | Baseline Units × (Regular retail − Unit cost), using the existing baseline method. | Definition pending #4 (also #7) |
| Other Promo Performance | Incremental Gross Margin $ | Must Have | Gross margin dollar impact of the promotion vs. baseline for the promoted item. Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ − Baseline Gross Margin $ | Definition pending #7 |
| Other Promo Performance | Net Gross Margin $ | Must Have | Gross margin dollars on the promoted item(s) after adding vendor promo funding for the event. Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2). Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ + Vendor Promo Funding $ | Definition pending #7 |
| Other Promo Performance | Category Incremental Sales $ | Must Have | Change in total subcategory / category sales dollars vs. baseline during the promotion, including the promoted item. The prototype measures the category. | Category / subcategory sales $ during promo days vs. the existing baseline, as shown in Michael Green's Hot Buy slides. Confirm. | Workbook |
| Other Promo Performance | Category Incremental Gross Margin $ | Must Have | Change in total subcategory / category gross margin dollars vs. baseline during the promotion. The prototype measures the category. Random weight cost is being corrected; meat scope pending (#15). | Category / subcategory GM $ during promo days vs. the existing baseline. Confirm. | Definition pending #7 |
| Other Promo Performance | Cannibalized Sales $ | Must Have | Change in sales of non-promoted items in the same subcategory vs. their baseline during the promotion. Negative = cannibalization, positive = halo. The group follows the Cannibalization level control (default Subcategory; also brand, brand-category or category), within the promo window, same unit of measure. | Existing method from Michael Green's Hot Buy slides: change in sales of non-promoted like items vs. baseline on promo days. Confirm. | Definition pending #3 |
| Other Promo Performance | Cannibalization Rate % | Must Have | Share of the promoted item's incremental units that came from other items in the subcategory. Negative = halo. The group follows the Cannibalization level control (default Subcategory; also brand, brand-category or category), within the promo window, same unit of measure. | As calculated in Michael Green's Hot Buy slides. Confirm. Prototype: −Cannibalized Units ÷ Incremental Units. | Definition pending #3 |
| Other Promo Performance | Net Incremental Sales $ | Must Have | Promoted item incremental sales after taking out sales lost from other items in the subcategory (the group set by the Cannibalization level control). | Incremental Sales $ + Cannibalized Sales $ | Workbook |
| Other Promo Performance | Net Incremental Gross Margin $ | Must Have | Promoted item incremental gross margin after cannibalization and vendor funding. The main 'did it pay off' number. Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2). Random weight cost is being corrected; meat scope pending (#15). | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Post-Promo Trend | Post-Promo Dip % | Nice to have | Change in promoted item units after the promotion ends vs. baseline (pantry loading). Shown as — until the 4 weeks have passed. | (Units after the promo − Baseline Units for the same days) ÷ Baseline Units, using a 4-week post-promo window by default. | Level 2 · not MVP |
| Post-Promo Trend | Repeat Purchase Rate % | Nice to have | Share of promo buyers who bought the item again at regular price after the promotion. The prototype uses 28 days after the promotion. | Promo buyers who bought the item again at regular price after the event ÷ Promo Buyer Count, using the window CMs use today. Confirm. | Definition pending #16 · Level 2 · not MVP |
| Promo History | Sales Lift % | Must Have | Percent increase in promoted item sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $, matching the lift CMs look at today. Confirm. | Workbook |
| Promo History | Unit Lift % | Must Have | Percent increase in promoted item units vs. baseline. | Incremental Units ÷ Baseline Units, matching the lift CMs look at today. Confirm. | Workbook |
| Promo History | Avg Promo Retail $ | Nice to have | Average selling price per unit of the promoted item during the promotion. Per lb for random-weight items; Promo Sales $ on the selected sales basis. | Promo Sales $ ÷ Promo Units | Workbook |
| Promo History | Promo Depth % | Should Have | How deep the promotional discount is vs. the regular retail. BOGO counts as 50 %. | (Regular retail − Promo retail) ÷ Regular retail | Workbook |
| Promo History | Incremental Gross Margin $ | Must Have | Gross margin dollar impact of the promotion vs. baseline for the promoted item. Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ − Baseline Gross Margin $ | Definition pending #7 |
| Promo History | Net Incremental Gross Margin $ | Must Have | Promoted item incremental gross margin after cannibalization and vendor funding. The main 'did it pay off' number. Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2). Random weight cost is being corrected; meat scope pending (#15). | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Promo History | Promo Event Count | Should Have | Number of times an item or item group was promoted in the selected period. | Distinct count of promo events for the item / item group | Workbook |
| Promo Shopper Impact | Promo Buyer Count | Should Have | Number of club card households that bought the promoted item during the promotion. | Distinct count of club card IDs with a promoted item in the transaction on promo days | Definition pending #16 |
| Promo Shopper Impact | Avg Basket Size $ | Should Have | Average total transaction dollars for transactions that include the promoted item. | Sum of transaction sales $ ÷ count of transactions containing the promoted item (promo days) | Definition pending #16 |
| Promo Shopper Impact | Promo Buyer Spend Change % | Should Have | Whether shoppers who bought on promotion spent more than they usually do. | Promo buyers' spend during the event vs. their usual spend, as shown in Michael Green's Hot Buy slides. Confirm. | Definition pending #16 |
| Promo Shopper Impact | Units per Basket | Nice to have | Average number of units in transactions that include the promoted item. | Sum of units in transactions containing the promoted item ÷ count of those transactions | Definition pending #16 |
| Promo Shopper Impact | New-to-Category Buyers % | Should Have | Share of promo buyers who had not bought the category in the look-back period. The new-shopper logic comes from a third-party system (#11); the prototype uses a 52-week category look-back. | Share of promo buyers new to the category, per the existing club card / Symphony AI definition. Confirm. | Definition pending #11 (also #16) |
| Promo Shopper Impact | Category Trips | Should Have | Number of shopping trips by promo buyers that included any item in the category, vs. their usual. | Count of promo buyers' transactions with a category item during the event vs. same buyers' pre-period average | Definition pending #16 |
| Promo Shopper Impact | Transaction Count | Nice to have | Total store transactions (customer count) during the promotion. Store traffic indicator. | Count of POS transactions on promo days | Definition pending #16 |
| Promo Shopper Impact | Repeat Purchase Rate % | Nice to have | Share of promo buyers who bought the item again at regular price after the promotion. The prototype uses 28 days after the promotion. | Promo buyers who bought the item again at regular price after the event ÷ Promo Buyer Count, using the window CMs use today. Confirm. | Definition pending #16 · Level 2 · not MVP |
| Promo Run Trend | Total Gross Sales | Must Have | Promo Sales $ before discounts, on the days the promotion is active. Same definition as UC1, applied to the promo period. | SUM(Gross Sales) of the promoted items, promo start to end date | UC1 definition (Total Gross Sales), used by the Sales basis control and LY / YoY (#5) |
| Promo Run Trend | Promo Units | Must Have | Units sold of the promoted item(s) on the days the promotion is active (within selected promo-timeframe). Random-weight items count pounds, as in Total Volume (UC2); each and pounds are never added together. Random weight cost is being corrected; meat scope pending (#15). | Sum of units sold for promoted item(s) where sale date is between promo start and end date. | Workbook |
| Promo Run Trend | Sales Lift % | Must Have | Percent increase in promoted item sales dollars vs. baseline. | Incremental Sales $ ÷ Baseline Sales $, matching the lift CMs look at today. Confirm. | Workbook |
| Promo Run Trend | Unit Lift % | Must Have | Percent increase in promoted item units vs. baseline. | Incremental Units ÷ Baseline Units, matching the lift CMs look at today. Confirm. | Workbook |
| Promo Run Trend | Promo Gross Margin $ | Must Have | Gross margin dollars earned on the promoted item(s) during the promotion, before vendor promo funding. Cost (#15): DC items use the DC end-of-day average cost minus scan-downs; DSD items use the net replacement cost in the store that day. Random weight cost is being corrected; meat scope pending (#15). | Promo Sales $ − Cost of goods sold for promo units. Same GM definition as UC #2. | Definition pending #15 (also #7) |
| Promo Run Trend | Promo Gross Margin % | Must Have | Gross margin rate on the promoted item(s) during the promotion. Ratio of totals. The denominator is pending (#5); the prototype divides by the selected sales basis (Net Customer Sales by default). Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ ÷ Promo Sales $ | Definition pending #5 (also #7, #15) |
| Promo Run Trend | Incremental Gross Margin $ | Must Have | Gross margin dollar impact of the promotion vs. baseline for the promoted item. Random weight cost is being corrected; meat scope pending (#15). | Promo Gross Margin $ − Baseline Gross Margin $ | Definition pending #7 |
| Promo Run Trend | Net Incremental Gross Margin $ | Must Have | Promoted item incremental gross margin after cannibalization and vendor funding. The main 'did it pay off' number. Vendor Promo Funding $ (#7): HQ scan-downs at the expected amount, bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, each allowance counted once. DC scan-downs are already taken out of the cost (#15), so they are not added again. Vendor Promo Funding $ is an internal input here, not a KPI of its own (#2). Random weight cost is being corrected; meat scope pending (#15). | Incremental GM $ + Cannibalized GM $ + Vendor Promo Funding $ | Definition pending #7 |
| Promo Run Trend | Promo Event Count | Should Have | Number of times an item or item group was promoted in the selected period. | Distinct count of promo events for the item / item group | Workbook |
| Promo Run Trend | Last Year Gross Sales | Must Have | Gross sales of the same items over the same days last year (364 days earlier, as in UC2). | SUM(Gross Sales) for promo days − 364 | UC1 definition (reused) |
| Promo Run Trend | YoY Gross Sales Growth ($ / %) | Must Have | Growth of promo gross sales vs. the same days last year. | $: TY − LY ; %: (TY − LY) ÷ LY | UC1 definition (reused) |
| Promo Run Trend | Post-Promo Dip % | Nice to have | Change in promoted item units after the promotion ends vs. baseline (pantry loading). Shown as — until the 4 weeks have passed. | (Units after the promo − Baseline Units for the same days) ÷ Baseline Units, using a 4-week post-promo window by default. | Level 2 · not MVP |

KPI sheet rows not shown: Total Volume (UC2) is covered by Promo Units, which counts pounds for random-weight items as Total Volume does; Promo Investment $, Vendor Promo Funding $, Vendor-Funded %, Weis-Funded Promo Cost $ and Promo ROI belong to the Promo Funding view (#2). Vendor Promo Funding $ is still generated as an internal input of Net GM $.

## Assumptions and definitions pending

Marked in the interface as **Definition pending #N**, where N is the question number in the workbook tab "UC #3 - Open Questions". Statuses are the tracker values (Open, Waiting on reply, Partly answered, Answered); questions the prototype does not depend on are not listed.

| # | Status | Item | Assumption in the prototype |
|---|---|---|---|
| 1 | Waiting on reply | Legacy reports | Reference reports are being collected; scan data comes from WMBI (sales line fact tables). |
| 2 | Answered | Promo Funding scope | Vendor funding analytics live in the DNP tool, so the Promo Funding view, the Funding Type filter, Vendor-Funded %, Weis-Funded Promo Cost $ and Promo ROI are not part of this dashboard. Their tables are still reviewed in the data review. |
| 3 | Waiting on reply | Cannibalization | Level and source pending (Cognira vs. Weis data). The workbook KPI rows measure at subcategory; Harrison proposed brand, brand-category and category. Selector with the four levels, default Subcategory, within the promo window, same unit of measure. |
| 4 | Partly answered | Baseline | Direction: one single baseline source for the company, leaning toward Cognira, pending confirmation. Proposed defaults, adjustable by the user: 4 weeks before the promo for Hot Buys, 13 weeks for TPRs, BOGOs and price locks. Prior promo weeks inside the window are still included; whether to exclude them is pending. The Baseline Sales $ and Baseline Units rows are not in the current KPI sheet; the prototype keeps them because the lift KPIs need them. |
| 5 | Partly answered | Sales and Promo GM % | Promo sales use the use case 1 table (Net Customer Sales) so sales match across dashboards; Cognira sales are not used. The GM % denominator is pending: UC1 answered Net Customer Sales and UC2 uses Gross Sales. The Sales basis control keeps both, default Net Customer Sales. |
| 6 | Partly answered | Promo events | Cognira holds the promo plan; promotions that actually ran come from HQ (simple promotions, price batches) and AMS (complex and points promotions). The Cognira feed keeps current and future promotions only, no history. HQ and AMS tables pending. The ad week is Thursday to Wednesday by default but must stay configurable; holiday exceptions in the ad calendar are not simulated. |
| 7 | Waiting on reply | Margin scope and Net Gross Margin | Whether margin metrics stay in the dashboard or only velocity metrics (units and sales) is pending with the SMEs. If net gross margin stays: HQ scan-downs at the expected amount (not vendor billing), bill-backs only for DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, and CNS store shipment recaps and DC off-invoice are the same allowance, counted once. |
| 8 | Answered | Promo Run Trend | Comparing the same promotion across runs or years is the MVP (Must Have). Post-Promo Trend and Post-Promo Dip % are level 2, with a 4-week post-promo window. |
| 9 | Partly answered | Core metrics | The dashboard will show about 6 to 8 core metrics and no funding metrics; which ones is pending. Tables for all metrics are still reviewed. |
| 10 | Waiting on reply | Promo History | Objective of the view pending. Ad Type / Vehicle and Promo Depth Band as in the workbook. |
| 11 | Waiting on reply | New-to-Category Buyers logic | The new-shopper logic comes from a third-party system; the prototype uses a 52-week category look-back. |
| 12 | Answered | Symphony AI | Symphony AI cannot be a data source; it is only a reference for comparison. Shopper metrics are calculated from the Weis T-log and Club Card tables. |
| 13 | Answered | Price groups | The price association lives in HQ and has no history; the prototype uses a fixed price group per SKU. |
| 14 | Waiting on reply | Promo type in the T-log | Examples pending of stores recording the change from hot buy to price lock differently. Promo sales are identified with the link code and price type. |
| 15 | Partly answered | Cost | Cost follows Power BI category reporting: DC items use the DC end-of-day average cost minus scan-downs; DSD items use the net replacement cost in the store that day. Random weight items are calculated incorrectly today and will be fixed. Whether meat is out of scope for UC3, as in UC2, is pending. |
| 16 | Partly answered | Club Card | Club Card data is personal data: the dashboard shows aggregates only, and any view with individual detail needs approval from Weis IT. Household vs. card level per metric is pending; Promo Buyer Count uses households. |
| 18 | Partly answered | Reconciliation | SMEs review first, then technical reconciliation against current reporting; sales reconcile to the Category Performance Report. The target for baseline and cannibalization depends on the Cognira vs. Weis data decision. |
| — | Note | Promo Investment $ | Not shown: it only appeared in the Promo Funding view. Harrison asked for club spend at item level; where it belongs is pending. The generator still produces it as the base of vendor funding. |

Other prototype assumptions (to review):

- Durations: Hot Buy = one ad week; TPR 1–8 weeks; Price Lock 4–13 weeks; BOGO and Other 1–2 weeks. BOGO counts as 50 % depth.
- The baseline window does not exclude earlier promo weeks inside it (a 13- or 52-week window will include other runs; #4).
- Vendor Promo Funding = a share of the event's Promo Investment, split by funding type (scan-down, bill-back, other promo allowance), each allowance counted once. The generator has no slotting or lump sums; `netGmFunding` ignores them if present. Funding is only used inside the cost (DC scan-downs) and Net GM $ / Net Incremental GM $.
- Supply source (illustrative): Frito-Lay, The Coca-Cola Company, PepsiCo Beverages and Turkey Hill Dairy deliver direct to store (DSD); every other vendor ships through the DC.
- Post-Promo Dip % (level 2) uses the 4 weeks (28 days) after the event and shows — until they have passed. Repeat Purchase Rate % (level 2) needs 28 days after the event.
- "Usual" for shopper metrics = the same buyers over the baseline window. Promo Buyer Count is summed across events and labelled "Sum across events (not unique households)" wherever more than one event is added; Transaction Count counts each promo day once.
- Store values (Hot Buy Performance only) = chain value × the selected stores' share of the department.
- A SKU, Vendor / Brand or pasted-UPC filter narrows the items inside each price group; cannibalization and category change stay measured for the whole price group.
- Departments: Grocery, Dairy, Frozen, HBC and GM (UC1 names) plus Meat and Produce (UC2 names). Random-weight Meat and loose Produce sell by the pound (PLUs).
- Data runs from FY2024 (Sun 12/31/2023) to Sun 11/15/2026 (FY2026 W47); the last complete ad week is 11/05–11/11/2026.

## Dummy data

Same convention as UC2: seeded generator (`SEED`, mulberry32 and a stateless hash), chain-level item × day cubes stored as prefix sums, store shares by department, the UC2 store and district structure, and the Weis fiscal calendar. About 110 SKUs in 57 price groups and about 600 promo events over almost three years, all four promo types plus Other. The numbers tie out by construction (incremental = promo − baseline, lift = incremental ÷ baseline, Net GM = GM + the vendor funding #7 allows, Net Incremental GM = Incremental GM + Cannibalized GM + that same funding); `src/lib/metrics.test.ts` checks it for every event. Pantry loading after a promo lasts about 4 weeks in the generator (full for two weeks, then fading).

Planted stories (asserted in `src/data/generate.test.ts`; numbers on screen always come from the data):

| Story | Where to see it |
|---|---|
| **Cheerios Family Size Hot Buy**, run every Q1, Q2 and Q3 since FY2024; lift falls each year and FY2026 is below last year | Promo Run Trend (default view) |
| **Coca-Cola 2 L Hot Buy** (July 4 and Labor Day 2026): lift above 100 % but high cannibalization of the 12-packs (same subcategory, so visible at the default Subcategory level); Net Incremental GM negative. DSD item, so its scan-downs are added in Net GM $ | Hot Buy Performance (Rolling 52 weeks or All history), Cannibalization level |
| **Chobani BOGO** (March 2026): units up, sales down, Incremental GM negative | Other Promo Performance |
| **Tide Hot Buy** (October 2026): fully funded by scan-downs on a DC item, so the funding lowers the cost (#15): Incremental GM $ is positive and Net GM $ equals Promo GM $ (nothing added twice, #7) | Hot Buy Performance (Columns › Net GM $) |
| **Bounty Hot Buy** (April 2025 and 2026): Post-Promo Dip below −30 % over the 4 weeks after the promo (pantry loading) | Post-Promo Trend tab, pick a Bounty event in the table (or Promo Run Trend, Post-Promo Dip % row) |
| **M&M's Sharing Size**: the Halloween item drives the October Hot Buy; everyday items drive the March TPR | Other / Hot Buy Performance, expand the row |
| **Clorox Wipes vs. Clorox Clean-Up**: separate price groups; the Wipes Hot Buy cannibalizes Clean-Up at brand level | Hot Buy Performance, Brand level |
| **Ground Beef 80/20 Hot Buys** (Memorial Day, July 4), sold by the pound | Hot Buy Performance, Meat |
| **Ragú TPR** (January 2026): halo on Barilla pasta | Other Promo Performance, Category level |
| **Weis Quality Water Price Lock** (March 2026, 6 weeks): own brand with no vendor funding, so Net GM $ equals Promo GM $ | Other Promo Performance (Columns › Net GM $) |

## Where things live

```
src/data/calendar.ts     Weis fiscal calendar (from UC2) + ad weeks (AD_WEEK rule, Thursday–Wednesday by default), holidays
src/data/stores.ts       200 stores, 3 regions, 12 districts (from UC2)
src/data/products.ts     Department › Category › Subcategory › Price Group › SKU, brands, vendors, supply source (DC / DSD), UPC / PLU
src/data/promos.ts       promo event master: types, durations, depth, ad type, vendor funding inputs, planted stories
src/data/generate.ts     seeded item × day cubes (units, gross, net, cost, markdown), 4-week pantry loading, store shares
src/lib/kpis.ts          every KPI formula from the workbook (pure, typed, null-guarded)
src/lib/cost.ts          cost basis by supply source (#15) and the vendor funding Net GM $ adds (#7)
src/lib/baseline.ts      proposed baseline defaults per view and promo type (#4)
src/lib/metrics.ts       event totals (promo, baseline, cannibalization, category, 4 weeks after, LY) and KPI derivation;
                         POST_PROMO_WINDOW_DAYS = 28
src/lib/shopper.ts       club card aggregates per event (no customer-level data)
src/lib/filters.ts       filter state, URL sync with validation, time resolution, filters by view (six tabs)
src/lib/selectors.ts     scope: events and items selected by the filters
src/lib/upc.ts           UPC / PLU validation and the pasted-list parser
src/lib/accessGate.ts    demo access gate (salted hash, constant-time check, fails closed)
src/lib/viewInfo.ts      each view's priority, question, user story and what is still to validate (KPI definitions dialog)
src/lib/definitions.ts   KPI definitions, status (pending / level 2 / not in the KPI sheet) and open questions numbered as in the workbook
src/lib/readme.ts        README traceability and open-question tables, generated from definitions.ts
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
