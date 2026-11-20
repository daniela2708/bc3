# UC3 Promo Effectiveness prototype: working rules

All UI text, README and code comments are in English. The requirements workbook `UC3_KPIs_Definitions_and_Mapping.xlsx` is the source of truth; see the README for KPI traceability and open questions.

## Layout rules (apply to every view and every future change)

### Rule 1: cascade, from general to particular

Top to bottom, every view shows:

1. The view title (`SectionHeading`).
2. The key figures (`KeyFigures` tiles with the main KPIs).
3. Charts, from the most general to the most detailed (trends or totals first, breakdowns after).
4. Tables, from the most aggregated to the most detailed (summary first, then the drill-down table).
5. Level 2 sections (`Level2` chip, "Level 2 · not MVP"), always last.

No table comes before a chart of the same view. The view controls (`ViewControls`: baseline window, cannibalization level, sales basis, rows) sit between the title and the tiles as part of the filter bar. The one-line reading of the key figures (`ViewSummary`) and the notices (`BannerStack`, privacy notes) sit right after the tiles.

Current order:

- Hot Buy Performance: tiles → Daily sales vs. baseline and Category / subcategory bridge → Hot Buy events by price group (hierarchical table).
- Other Promo Performance: tiles → Daily sales vs. baseline and Category bridge → Promotions by price group (hierarchical table) → Runs of the same promo.
- Post-Promo Trend (Level 2 tab): tiles → Daily units and Daily sales vs. baseline for the selected promo → Post-promo summary by category (events underneath).
- Promo History: tiles → Results by fiscal period or week → charts by Promo Depth Band and by Ad Type / Vehicle → Every past promotion.
- Promo Shopper Impact: tiles → One panel per event → All events (table).
- Promo Run Trend: tiles → Lift across runs and Net Incremental GM $ per run → Each run side by side.

The tabs are the views of the requirements workbook, in its order, without Promo Funding (#2). A whole view that is level 2 shows the `Level2` chip next to its title.

### Rule 2: no business-context block on top

A view starts with its title and goes straight to the key figures. Do not add an eyebrow (priority, "View N of 6"), the user story, the view question or "to validate" text above the content. That information lives in `src/lib/viewInfo.ts` and is shown in the **KPI definitions** dialog (`DefinitionsDrawer`), one entry per view. `SectionHeading` takes only `title` and an optional `badge` chip.

The **Definition pending #N** (`Pending`) and **Level 2 · not MVP** (`Level2`) chips stay next to each KPI, chart or table they qualify.

### Rule 3: consistency

- Same spacing and components in every view: `KeyFigures` tiles, `ChartGrid` / `ChartCard` charts, `HierTable` tables.
- Every chart keeps its table view (`ChartCard` `table` prop); every table keeps its column chooser and Excel export.
- Layout changes never change calculations, filters or data.

## Checks before finishing a change

Run `npm test`, `npm run lint` (zero warnings), `npm run build` and `npm run test:e2e`; all must pass. The e2e checks rules 1 and 2 in every view. `SCREENSHOTS=./screens npm run test:e2e` saves one PNG per view.

Keep the security rules in the README ("Security and hygiene"): validated URL state, bounded inputs, CSP, no `innerHTML`, no secrets in the repo.
