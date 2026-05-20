# QRCC Data Center

Local-first Nuxt 4 application for the QRCC monthly FQMS and F-COST workflow. The product replaces Excel copy/paste and manual cross-file checks with CSV import, SQLite storage, automated aggregation, validation, report preview, Excel export, and browser Print to PDF.

The canonical product source of truth is [`prd.md`](prd.md). The active implementation checklist is [`task-plan.md`](task-plan.md).

## Current Accuracy Slice

Slice 0 is focused on proving April 2026 LCD LOCAL numbers before expanding UI/report breadth.

Important Phase 4 proof facts:

- Monthly parser/raw proof already covers April 2026 and March 2026 LCD LOCAL.
- Raw service CSV parsing must keep searching for the required header row because some files have preamble lines before the header.
- LOCAL factory mapping for the sample is `SEID`, `SKW`, `MOKA`, and `MTC`.
- Sales CSV uses `Model` as the original/source model and `Report Model` as the reporting/aggregation model. Required header matching is case-insensitive, so `report model` and `Report model` are accepted.
- Sales CSV also requires `Sales Month` in `YYYY-MM` format so the file period can be validated against the selected report month.
- Slice 0 FQMS claim quantity only counts reportable raw service rows: `job_sheet_section = 1`, model is in the active FQMS report model set, action exists in master action, category is `DEFECT` or `NON_DEFECT`, and defect is not blank/`N/A`.
- Master action mappings to `N/A / N/A` are excluded from FQMS claim quantity and are not `ACTION_UNCLASSIFIED`.
- Slice 0 FQMS PPM is rounded up to a whole number in preview/export.
- A final FQMS master model-series table is not implemented yet; current Slice 0 behavior temporarily uses sales rows for the selected month as the active FQMS model set.
- FQMS Section C uses accumulated per-model values, not only one monthly raw summary.
- Accumulated FQMS PPM denominator is `accumulated_sales * launching_period`.
- Total FQMS AVG PPM uses total exposure across models, not an average of model PPM values.

April 2026 LCD LOCAL accumulated FQMS proof currently uses:

- Accumulated claims from 14 active monitoring workbooks under `D:\ARISAFARI\Works\FQMS - Sharp Confidential\02_LCD SEID\RAW DATA\Monitoring\01_active`.
- Accumulated sales from `C:\Users\GAY0700622\Documents\sales akumulasi into april 2026.csv`.
- Repeatable proof script: [`scripts/proof-fqms-april.mjs`](scripts/proof-fqms-april.mjs).
- Generated proof CSV: `storage/proofs/fqms-accumulated-lcd-local-2026-04.csv`.

Current proof totals:

| Metric | Value |
|---|---:|
| Accumulated sales | 821,326 |
| Defect qty | 4,061 |
| Non-defect qty | 1,025 |
| Total claim qty | 5,086 |
| Exposure | 11,931,633 |
| Defect PPM | 340.355759 |
| Non-defect PPM | 85.906095 |
| Total PPM | 426.261854 |

`storage/proofs/` may be ignored by git. Regenerate the proof with:

```bash
node scripts/proof-fqms-april.mjs
```

The script also accepts optional arguments:

```bash
node scripts/proof-fqms-april.mjs <monitoring-dir> <sales-csv-path> <output-csv-path>
```

## Commands

Use the scripts from `package.json`:

```bash
pnpm dev
pnpm lint
pnpm lint:fix
pnpm typecheck
pnpm build
pnpm preview
pnpm db:generate
pnpm db:migrate
```

No test runner is configured yet. Do not invent test commands until a test script exists in `package.json`.

## Stack

- Nuxt 4 full-stack monolith
- Vue 3 and Nuxt UI 4
- Strict TypeScript
- SQLite with Drizzle ORM
- Zod validation
- `csv-parse` for CSV import
- ExcelJS for `.xlsx` export
- Native browser print for PDF

## Working Rules

- Excel is output/template only, never the database.
- SQLite is the source of truth.
- Store raw imported rows so every summary/report number is traceable.
- Import Center should show the last imported month/status per product/scope/import type.
- Sales re-import uses replace mode per report month/product/scope/import type.
- Raw service operational re-import should use staging compare + upsert per notification/line, not blind append or full replace.
- Raw service manual review is line-level for `symptom` and `action`; import ulang must not silently overwrite those overrides.
- Raw service `defect_category` and `defect` are derived from effective action through master action mapping.
- `ACTION_UNCLASSIFIED` means a FQMS-impact row has a blank action or an action missing from master action. Valid actions mapped to `N/A` are excluded, not reviewed.
- Keep backend boundaries: API controller -> service -> repository -> SQLite.
- Critical validation issues block export; warning/CHECK issues remain visible but do not block export.
- Do not treat UI/report work as final until Slice 0 parser and aggregation numbers are proven accurate.
