# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Current repository state

This workspace is a Nuxt 4 application plus product/specification workspace for QRCC Data Center. The canonical PRD is `prd.md` (renamed from the former `new-prd.md`). If project memories, older notes, or future assumptions conflict with `prd.md`, follow `prd.md`.

Important files/directories currently present:

- `prd.md` — primary source of truth for building QRCC Data Center.
- `task-plan.md` — implementation checklist, now sequenced around a data-truth-first vertical slice.
- `raw data april 2026.csv` — sample raw service CSV for April 2026, matching the PRD raw service header.
- `scripts/proof-fqms-april.mjs` — repeatable Phase 4 proof script for April 2026 LCD LOCAL accumulated FQMS.
- `storage/proofs/fqms-accumulated-lcd-local-2026-04.csv` — generated proof output for accumulated FQMS; this path may be ignored by git and can be regenerated.
- `templates/excel/` — legacy Excel report templates/reference workbooks.
- `templates/pdf/` — legacy printed report references.
- `app/` — Nuxt UI application shell and pages.
- `server/` — target location for Nitro API/backend code; backend implementation is still minimal/absent.

## Commands

Use the actual scripts from `package.json`:

- Start the Nuxt development server: `pnpm dev`
- Type check: `pnpm typecheck`
- Lint: `pnpm lint`
- Auto-fix lint: `pnpm lint:fix`
- Build: `pnpm build`
- Preview production build: `pnpm preview`
- Generate Drizzle migrations: `pnpm db:generate`
- Run Drizzle migrations: `pnpm db:migrate`

No test runner is configured yet. Do not invent test commands until a test script exists in `package.json`.

## Product direction from the PRD

QRCC Data Center is a local-first, single-user web application for the monthly QRCC FQMS and F-COST workflow. It replaces Excel-driven copy/paste, helper sheets, manual formulas, and cross-file checks with CSV import, SQLite storage, automated aggregation, validation, Excel export, and browser Print to PDF.

Final target stack from `prd.md`:

- Nuxt 4 full-stack monolith with Vue 3, Nuxt UI 4, and strict TypeScript.
- SQLite local database as the source of truth, accessed through Drizzle ORM.
- Zod for server-side validation.
- `csv-parse` for CSV parsing, preferably streaming/Node mode for large files.
- ExcelJS for filling `.xlsx` templates.
- Native browser print for PDF; do not introduce Playwright for PDF export.
- Final distribution must be portable/zero-install for Windows office PCs: no required Node.js, database server, Playwright browser, or admin install on the target machine.
- Packaging baseline is a portable Node bundle first; Bun compile or Node SEA should only be considered after the baseline works.

## Target architecture

Backend code should follow this boundary:

```text
HTTP request -> API controller -> service -> repository -> SQLite
```

Responsibilities:

- `server/api/**/*.ts`: parse HTTP requests/uploads, validate request shape, call services, return JSON. Do not put business rules or direct database queries here.
- `server/services/*.ts`: CSV parsing, import orchestration, aggregation, calculations, validation, report view-model creation. Services must not import `h3`, accept Nitro events, or query Drizzle directly.
- `server/repositories/*.ts`: Drizzle/SQLite CRUD and queries only. Do not calculate PPM, ratios, validation results, report values, or HTTP responses here.
- `server/reports/**`: transform persisted long-format data into report view models and Excel/print-specific structures. Do not use reports as primary storage.

Target folder structure is documented in the PRD. Keep `app/` for Nuxt UI, `server/` for Nitro API/backend, `shared/` for cross-boundary constants/types/validators, `templates/` for report templates, `data/` for `sqlite.db`, and `storage/` for imports/exports/backups.

## Core data and workflow rules

- Excel is output/template only; never use Excel files as the application database.
- Store raw imported rows so every summary/report number can be traced back.
- Store normalized data in long format; convert to wide format only for report view models, preview, or Excel export.
- The main workflow is: choose/create report month, select product/manufacturer scope, import sales CSV, import raw service CSV, store import history/raw rows, aggregate, review/edit anomalies, validate, preview report, export Excel or print to PDF, and back up SQLite.
- Sales and raw service files can contain mixed LOCAL/IMPORT data. Split by explicit `factory_mappings`; do not hardcode permanent factory/manufacturer assumptions.
- Sales CSV must include `Report Model` and `Sales Month`. `Model` is the source/original sales model for audit, `Report Model` is the reporting model used for grouping and aggregation, and `Sales Month` is the period source in `YYYY-MM` format. Header matching is case-insensitive for required headers, so `report model` and `Report model` are accepted as `Report Model`.
- Sales duplicate import handling uses replace mode for the same report month + import type + product/manufacturer scope.
- Raw service Phase 3 replace mode is only a baseline parser/aggregation proof behavior. The target operational flow is staging compare + upsert per notification/line, with manual override protection.
- Import Center should show last imported month/status per product/scope/import type, including row counts, warnings, anomaly count, exported status, and whether raw service has manual reviews.
- Header validation is required for CSV imports. Extra columns may be ignored or stored as raw JSON, but missing required columns should reject the import.
- Raw service `keydate` must match the selected report month. Reject if most rows are for a different month; show CHECK with sample rows for small outliers.
- Raw service `notification` is unique for a case, but one notification can have multiple lines. Use a line key/fingerprint such as `notification + job_sheet_section + part_code + line_no_dalam_notification` until a more stable line identifier exists.
- Manual raw service review is line-level and initially limited to `symptom` and `action`. Import ulang must not overwrite these overrides silently.
- Raw service `defect_category` and `defect` are derived from effective action via master action (`Action`, `Category`, `Defect`), not edited manually.
- Changed line count for an existing raw service notification is CHECK/CONFLICT and should flow to Review Anomalies.
- Exported reports should eventually be stored as snapshots/history: current data can keep changing, but a finalized export should not change silently.
- For Slice 0, FQMS claim quantities use `job_sheet_section = 1`.
- For Slice 0, F-COST aggregates all valid cost rows.
- Store F-COST amounts in raw rupiah; scaling belongs only in display/export formatting.

## Reporting and calculation rules

FQMS:

- Product/manufacturer scope starts with LCD LOCAL for Slice 0, then expands to IMPORT after accuracy is proven.
- Full MVP sections are A Quality Trend, B Acceptance Ratio, C Detail Model, and D Worst Defect. Slice 0 only needs enough FQMS summary output to prove the April 2026 LCD LOCAL numbers.
- Target monthly PPM is one global value per product + manufacturer + fiscal half, not per model.
- Section C accumulation runs from each model's launching month to the report month.
- Accumulated PPM denominator is `accumulated_sales * launching_period`.
- Total FQMS AVG PPM uses total exposure across models, not an average of model PPM values.
- If denominator inputs are missing or zero, return CHECK/blank rather than `Infinity`, `NaN`, or misleading values.
- Phase 4 FQMS exact proof cannot be derived from one monthly raw service file plus one monthly sales file. It needs accumulated claims per model, accumulated sales per model, launching month/period, and target PPM.
- For April 2026 LCD LOCAL, accumulated claims come from the 14 active monitoring workbooks in `D:\ARISAFARI\Works\FQMS - Sharp Confidential\02_LCD SEID\RAW DATA\Monitoring\01_active`; accumulated sales comes from `C:\Users\GAY0700622\Documents\sales akumulasi into april 2026.csv`.
- Run `node scripts/proof-fqms-april.mjs` to regenerate the April 2026 accumulated FQMS proof. The script also accepts optional args: monitoring directory, sales CSV path, output CSV path.
- Current April 2026 LCD LOCAL accumulated proof totals: accumulated sales `821,326`; defect `4,061`; non-defect `1,025`; total claim `5,086`; exposure `11,931,633`; defect PPM `340.355759`; non-defect PPM `85.906095`; total PPM `426.261854`.

F-COST:

- Product/manufacturer scope starts with LCD LOCAL for Slice 0, then expands to IMPORT after accuracy is proven.
- Full MVP sections are Summary cards, A Monthly F-Cost, B F-Cost Trend, and C Detail F-Cost & Part Contribution. Slice 0 only needs enough F-COST summary output to prove the April 2026 LCD LOCAL numbers.
- The old `Achievement` label is replaced with `Cost vs Target`.
- Target F-COST is one global value per product + manufacturer + fiscal half.
- LY F-Cost comes from the same month one year earlier, not manual input. If missing, show CHECK or `LY data missing`.
- Part/Labor/Trip map initially from `parts_cost`, `labor_cost`, and `transportation_cost`.
- Part category ratios are calculated from amounts; do not store ratios as manual input.

Fiscal calendar:

- FH is April–September with fiscal year equal to the calendar year.
- LH is October–March. October–December use the calendar year; January–March use calendar year minus one.
- FQMS and F-COST targets are updated at the first month of each half: April for FH, October for LH.

## Validation priorities

The validation engine should produce status, reason, severity, and links to related review pages. For MVP operation, critical/error issues block Excel export; warning/CHECK issues are visible but do not block export.

Slice 0 validation should prioritize import presence, required CSV headers, report month consistency, factory/model mapping completeness, duplicate/re-import safety, denominator safety, FQMS total consistency, F-COST total consistency, and export readiness.

## UI/API targets

The Slice 0 UI is intentionally limited to five pages/areas:

1. Month/Scope
2. Import Center
3. Review Anomalies
4. Validation Summary
5. Report Preview/Export

Avoid full master-data CRUD, full target CRUD, and all report sections until Slice 0 accuracy gates pass. Keep report preview and Excel export driven by the same report view model.

## Implementation sequence

Follow `task-plan.md` and prioritize data truth over UI breadth:

1. Verify project hygiene and actual package scripts.
2. Add minimal Drizzle + SQLite schema, migrations, seeds, and repository layer for April 2026 LCD LOCAL.
3. Build CSV import pipeline with header validation; sales keeps automatic replace behavior, raw service moves toward staging compare + upsert per notification/line.
4. Build aggregation proof of accuracy using April 2026 data and LOCAL templates.
5. Add minimal validation engine with critical export blocking.
6. Build report view model, preview, and Excel export from the same data structure.
7. Build only the five Slice 0 UI pages/areas.
8. Run portable Node bundle smoke test early.
9. Expand to IMPORT, full report sections, full CRUD, backup/restore, print CSS, and final packaging only after Slice 0 passes.

The parser/aggregation numbers for April 2026 LCD LOCAL must be proven accurate before treating final UI/report work as complete.
