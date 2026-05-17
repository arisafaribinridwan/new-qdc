# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current repository state

This workspace is currently a product/specification workspace, not a scaffolded application. There is no `package.json`, Nuxt app, source tree, test runner, lint config, README, Cursor rules, Copilot instructions, or existing `CLAUDE.md` at the time this file was created.

Important files/directories currently present:

- `new-prd.md` — primary source of truth for building QRCC Data Center from scratch. If project memories, older notes, or future assumptions conflict with this PRD, follow this file.
- `raw data april 2026.csv` — sample raw service CSV for April 2026, matching the PRD raw service header.
- `templates/excel/` — legacy Excel report templates/reference workbooks.
- `templates/pdf/` — legacy printed report references.

## Commands

No verified build, lint, dev, or test commands exist yet because the application has not been initialized. Do not invent commands in this repository; after scaffolding the Nuxt project, update this section from the actual `package.json` scripts.

Until then, use file reads/searches to inspect the PRD and templates. If you add the app scaffold, include exact commands here for:

- starting the Nuxt development server
- type checking
- linting
- running all tests
- running a single test file
- running Drizzle migrations/seeds
- building/packaging the portable Windows app

## Product direction from the PRD

QRCC Data Center is a local-first, single-user web application for the monthly QRCC FQMS and F-COST workflow. It replaces Excel-driven copy/paste, helper sheets, manual formulas, and cross-file checks with CSV import, SQLite storage, automated aggregation, validation, Excel export, and browser Print to PDF.

Final target stack from `new-prd.md`:

- Nuxt 4 full-stack monolith with Vue 3, Nuxt UI 4, and strict TypeScript.
- SQLite local database as the source of truth, accessed through Drizzle ORM.
- Zod for server-side validation.
- `csv-parse` or PapaParse for CSV parsing, preferably streaming/Node mode for large files.
- ExcelJS for filling `.xlsx` templates.
- Native browser print for PDF; do not introduce Playwright for PDF export.
- Final distribution must be portable/zero-install for Windows office PCs: no required Node.js, database server, Playwright browser, or admin install on the target machine.

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

Target folder structure is documented in PRD section 6. Keep `app/` for Nuxt UI, `server/` for Nitro API/backend, `shared/` for cross-boundary constants/types/validators, `templates/` for report templates, `data/` for `sqlite.db`, and `storage/` for imports/exports/backups.

## Core data and workflow rules

- Excel is output/template only; never use Excel files as the application database.
- Store raw imported rows so every summary/report number can be traced back.
- Store normalized data in long format; convert to wide format only for report view models, preview, or Excel export.
- The main workflow is: choose/create report month, select product/manufacturer scope, import sales CSV, import raw service CSV, store import history/raw rows, aggregate, review/edit anomalies, validate, preview report, export Excel or print to PDF, and back up SQLite.
- Sales and raw service files can contain mixed LOCAL/IMPORT data. Split by explicit `factory_mappings`; do not hardcode permanent factory/manufacturer assumptions.
- MVP duplicate import handling should use replace mode for the same report month + import type + product/manufacturer scope unless the implementation deliberately chooses versioned active imports.
- Header validation is required for CSV imports. Extra columns may be ignored or stored as raw JSON, but missing required columns should reject the import.
- Raw service `keydate` must match the selected report month. Reject if most rows are for a different month; show CHECK with sample rows for small outliers.
- For claim quantities, the recommended MVP rule is `job_sheet_section = 1`. Cost aggregation may need all cost rows, but this must be verified against manual Excel numbers before final report work.

## Reporting and calculation rules

FQMS:

- Product/manufacturer scope starts with LCD and LOCAL/IMPORT, reported separately.
- MVP sections are A Quality Trend, B Acceptance Ratio, C Detail Model, and D Worst Defect. `Quality Issue and Follow Up` is outside the initial MVP.
- Target monthly PPM is one global value per product + manufacturer + fiscal half, not per model.
- Section C accumulation runs from each model's launching month to the report month.
- Accumulated PPM denominator is `accumulated_sales * launching_period`.
- Total AVG PPM uses total exposure across models, not an average of model PPM values.
- If denominator inputs are missing or zero, return CHECK/blank rather than `Infinity`, `NaN`, or misleading values.

F-COST:

- Product/manufacturer scope starts with LCD and LOCAL/IMPORT, reported separately.
- MVP sections are Summary cards, A Monthly F-Cost, B F-Cost Trend, and C Detail F-Cost & Part Contribution.
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

The validation engine should produce `OK` or `CHECK`, reason, severity, and links to related review pages. PRD section 15 defines V1–V22; key validations include import presence, required CSV headers, report month consistency, factory/model mapping completeness, duplicate summaries, denominator safety, category standardization, target presence, F-COST item/part breakdown consistency, raw `total_cost` cross-checks, LY F-Cost presence, previous fiscal half availability, outliers, and print readiness.

## UI/API targets

The target UI map includes dashboard, report months, models, reference data, targets, import center, review/entry pages, validation, report preview/export, and SQLite backup/restore.

The target API surface includes import endpoints, report month/model/reference CRUD, target CRUD, review endpoints, validation run, report view-model, Excel export, and backup/restore. Keep report preview and Excel export driven by the same report view model.

## Implementation sequence

Follow the PRD roadmap rather than polishing UI first:

1. Bootstrap Nuxt 4 + Nuxt UI 4 + strict TypeScript, lint/typecheck, app shell, and page map.
2. Add Drizzle + SQLite schema, migrations, seeds, and repository layer.
3. Build CSV parser and aggregation proof of accuracy, using April 2026 data to verify against manual Excel/reference outputs.
4. Build import UI with preview/errors and replace/reprocess mode.
5. Add master data, targets, review pages, validation, report view models, print preview, Excel export, backup/restore, then packaging.

The parser/aggregation numbers for April 2026 must be proven accurate before treating final UI/report work as complete.
