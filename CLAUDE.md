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
- Promo Funding (notice tab): title and chip → notice → list of the workbook KPIs for the view.
- Post-Promo Trend (Level 2 tab): tiles → Daily units and Daily sales vs. baseline for the selected promo → Post-promo summary by category (events underneath).
- Promo History: tiles → Results by fiscal period or week → charts by Promo Depth Band and by Ad Type / Vehicle → Every past promotion.
- Promo Shopper Impact: tiles → One panel per event → All events (table).
- Promo Run Trend: tiles → Lift across runs and Net Incremental GM $ per run → Each run side by side.

The tabs are the views of the requirements workbook, in its order. Promo Funding is a notice tab (#2): title with the "Not in this dashboard (#2)" chip, a notice and the list of its workbook KPIs; no numbers, every filter greyed out. A whole view that is level 2 shows the `Level2` chip next to its title.

### Rule 2: no business-context block on top

A view starts with its title and goes straight to the key figures. Do not add an eyebrow (priority, "View N of 7"), the user story, the view question or "to validate" text above the content. That information lives in `src/lib/viewInfo.ts` and is shown in the **KPI definitions** dialog (`DefinitionsDrawer`), one entry per view. `SectionHeading` takes only `title` and an optional `badge` chip.

The **Definition pending #N** (`Pending`) and **Level 2 · not MVP** (`Level2`) chips stay next to each KPI, chart or table they qualify.

### Rule 3: consistency

- Same spacing and components in every view: `KeyFigures` tiles, `ChartGrid` / `ChartCard` charts, `HierTable` tables.
- Every chart keeps its table view (`ChartCard` `table` prop); every table keeps its column chooser and Excel export.
- Layout changes never change calculations, filters or data.

### Rule 4: the view objective under the title

One line under each title, in the secondary text colour, with what the view answers: `objective` in `src/lib/viewInfo.ts`, passed to `SectionHeading`. Not the user story (that stays in the KPI definitions dialog).

### Rule 5: each control lives next to what it changes

- A control that changes one block goes in that block's header (`BlockSettings`; `RowsControl` for table rows).
- A control that changes several blocks goes in the compact "Calculation settings" bar (`ViewControls`) under the objective.
- A control that changes nothing in a view is not shown there.
- Every control has an (i) starting with "Affects: …". Cannibalization level uses its "How it works" popover, with its "Definition pending #3" chip next to it.
- Declare what each control changes in `AFFECTS` (`src/lib/settings.ts`), reading the data each block actually uses. The bar, the tags and the README table come from it.

### Rule 6: active-value tag on every affected block

- Every key-figure group, chart or table that a Calculation settings control changes shows `<SettingTags block="…" />` in its header (`KeyFigures` / `ChartCard` take a `tags` prop; table headers use a `block-tags` line).
- Shown as one line of small secondary text. A value different from the view default is in the accent colour with its default in brackets ("Baseline 2 wk (default 4)").
- Blocks no setting changes show no tag. Hover or focus shows the "Affects: …" text. Theme variables only.

### Rule 7: glossary

Key terms use <Term> with a plain-language explanation, once per view: `<Term id="…">` from `src/components/Term.tsx`, texts only in `src/lib/glossary.ts` (also listed under "Glossary" in the KPI definitions dialog). Underline the first appearance in each view, never every appearance. `Pending term` and `Level2 term` mark the one chip per view that carries the explanation.

### Rule 8: chart cards

Use the shared `ChartCard` header for every chart: row 1 title (+ one term at most, + small chip) and icon-only Excel / Table buttons; row 2 the card's own controls (`controls`: Event dropdown inline, Daily / Weekly); row 3 the settings line (`tags`). One short subtitle (ellipsis, full text in the tooltip); technical notes in `tableNote` or the chart tooltip. Round axis ticks (`niceTicks`, `moneyAxis`), horizontal grid only. Spacing from the `--sp-*` scale. Change the shared component, not one card.

## Illustrative items from the prototype review

The Hot Buy Score, the promo fatigue flag and the Promo Run Trend lift colours are examples until the business defines them: change their criteria, weights and thresholds only in `src/lib/scoring.ts`, `src/lib/fatigue.ts` and `src/lib/thresholds.ts`, keep their chips ("Illustrative …", "Definition pending …", "Proposal for review") and mark new items "Requested in the prototype review" in `definitions.ts` (the README tables follow).

## Checks before finishing a change

Run `npm test`, `npm run lint` (zero warnings), `npm run build` and `npm run test:e2e`; all must pass. The e2e checks rules 1 and 2 in every view. `SCREENSHOTS=./screens npm run test:e2e` saves one PNG per view.

Keep the security rules in the README ("Security and hygiene"): validated URL state, bounded inputs, CSP, no `innerHTML`, no secrets in the repo.
