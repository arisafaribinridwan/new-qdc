# Task Plan Implementasi — QRCC Data Center

> **Versi**: 1.0 · **Terakhir diperbarui**: 2026-05-17
>
> Checklist ini menggantikan roadmap linear lama dengan task plan komprehensif. Urutan sengaja dibuat **frontend-first** agar shell, navigasi, UX workflow, dan kontrak data halaman jelas lebih dulu, lalu backend diisi mengikuti kebutuhan UI dan report.

---

## Prinsip Eksekusi

- [ ] Kerjakan dalam irisan kecil yang bisa dicek dengan `pnpm lint`, `pnpm typecheck`, dan preview browser.
- [ ] Jangan menganggap UI/report final sebelum angka parser April 2026 terbukti akurat terhadap referensi Excel/PDF.
- [ ] Pertahankan boundary backend: API controller → service → repository → SQLite.
- [ ] Pertahankan Excel sebagai output/template saja, bukan database.
- [ ] Simpan raw rows agar semua angka summary/report bisa ditelusuri ulang.

---

## Phase 0 — Project Hygiene dan Baseline

- [ ] Pastikan Nuxt 4, Nuxt UI 4, Vue 3, dan TypeScript strict aktif.
- [ ] Pastikan `pnpm lint` tersedia.
- [ ] Pastikan `pnpm lint:fix` tersedia.
- [ ] Pastikan `pnpm typecheck` tersedia dan berhasil.
- [ ] Pastikan Tailwind CSS aktif melalui Nuxt UI/Tailwind v4 import.
- [ ] Rapikan `app/app.vue`, layout, page index, dan CSS global agar sesuai struktur Nuxt 4.
- [ ] Update dokumentasi command di `CLAUDE.md` setelah command benar-benar terverifikasi.

## Phase 1 — Frontend App Shell dan Navigasi

- [ ] Buat layout utama dengan header, sidebar, main content, dan responsive behavior.
- [ ] Buat identitas aplikasi: QRCC Data Center, FQMS & F-COST Workflow.
- [ ] Buat route/page placeholder untuk dashboard `/`.
- [ ] Buat route/page placeholder untuk `/report-months`.
- [ ] Buat route/page placeholder untuk `/models`.
- [ ] Buat route/page placeholder untuk `/references/factories`.
- [ ] Buat route/page placeholder untuk `/references/defect-categories`.
- [ ] Buat route/page placeholder untuk `/references/nondefect-categories`.
- [ ] Buat route/page placeholder untuk `/references/repair-actions`.
- [ ] Buat route/page placeholder untuk `/references/grouping-rules`.
- [ ] Buat route/page placeholder untuk `/targets/fqms`.
- [ ] Buat route/page placeholder untuk `/targets/fcost`.
- [ ] Buat route/page placeholder untuk `/import`.
- [ ] Buat route/page placeholder untuk `/import/sales`.
- [ ] Buat route/page placeholder untuk `/import/raw-service`.
- [ ] Buat route/page placeholder untuk `/entry/sales`.
- [ ] Buat route/page placeholder untuk `/entry/summary`.
- [ ] Buat route/page placeholder untuk `/entry/defect`.
- [ ] Buat route/page placeholder untuk `/entry/nondefect`.
- [ ] Buat route/page placeholder untuk `/entry/repair-action`.
- [ ] Buat route/page placeholder untuk `/entry/fcost`.
- [ ] Buat route/page placeholder untuk `/validation`.
- [ ] Buat route/page placeholder untuk `/reports/preview`.
- [ ] Buat route/page placeholder untuk `/reports/export`.
- [ ] Buat route/page placeholder untuk `/settings/backup`.
- [ ] Tambahkan active navigation state dan breadcrumb.
- [ ] Tambahkan empty state standar untuk halaman yang belum punya data.

## Phase 2 — Frontend Workflow State dan Mock Contracts

- [ ] Definisikan TypeScript interface frontend untuk report month.
- [ ] Definisikan TypeScript interface frontend untuk product/manufacturer scope.
- [ ] Definisikan TypeScript interface frontend untuk import status.
- [ ] Definisikan TypeScript interface frontend untuk validation status.
- [ ] Definisikan TypeScript interface frontend untuk report preview summary.
- [ ] Buat mock data lokal sementara untuk dashboard.
- [ ] Buat dashboard cards: active month, selected scope, sales import status, raw service import status, validation status, next action.
- [ ] Buat komponen reusable status badge `OK`/`CHECK`/`Missing`/`Draft`.
- [ ] Buat komponen reusable page header.
- [ ] Buat komponen reusable data table wrapper.
- [ ] Buat komponen reusable confirm dialog untuk replace import dan destructive actions.
- [ ] Buat komponen reusable month/scope selector.

## Phase 3 — Frontend Import Center

- [ ] Buat halaman `/import` sebagai hub sales CSV dan raw service CSV.
- [ ] Buat UI upload sales CSV dengan drag/drop dan file picker.
- [ ] Buat UI upload raw service CSV dengan drag/drop dan file picker.
- [ ] Buat preview header CSV sebelum submit final.
- [ ] Tampilkan row count, accepted count, rejected count, dan warning count.
- [ ] Tampilkan missing required header error dengan jelas.
- [ ] Tampilkan mode replace/reprocess agar user paham import lama akan diganti.
- [ ] Buat import history table.
- [ ] Buat loading/progress state untuk upload dan processing.
- [ ] Buat error state yang actionable, termasuk link ke reference mapping jika factory/model belum dikenal.

## Phase 4 — Frontend Master Data dan Target Pages

- [ ] Buat UI CRUD report months dengan fiscal year/half derived display.
- [ ] Buat UI CRUD models dengan launching month, active status, dan report include.
- [ ] Buat UI CRUD factory mappings.
- [ ] Buat UI CRUD model grouping rules.
- [ ] Buat UI CRUD defect categories.
- [ ] Buat UI CRUD non-defect categories.
- [ ] Buat UI CRUD repair actions.
- [ ] Buat UI CRUD FQMS target PPM per product/manufacturer/fiscal half.
- [ ] Buat UI CRUD F-COST target per product/manufacturer/fiscal half.
- [ ] Tambahkan form validation di UI sebelum API submit.
- [ ] Tambahkan optimistic/refresh behavior yang konsisten.

## Phase 5 — Frontend Review Pages

- [ ] Buat review sales table dengan filter report month, product, manufacturer, model, factory.
- [ ] Buat review monthly summary table.
- [ ] Buat review defect category entries table.
- [ ] Buat review non-defect category entries table.
- [ ] Buat review repair action entries table.
- [ ] Buat review F-COST summary table.
- [ ] Buat review F-COST item breakdown table.
- [ ] Buat review F-COST part category breakdown table.
- [ ] Tambahkan indikator source import dan override flag.
- [ ] Tambahkan UI manual override dengan remark wajib.
- [ ] Tambahkan link dari validation issue ke row review terkait.

## Phase 6 — Frontend Validation UI

- [ ] Buat halaman `/validation` dengan ringkasan status per scope.
- [ ] Tampilkan V1–V22 sebagai checklist hasil validasi.
- [ ] Tampilkan severity, reason, dan related page link.
- [ ] Tambahkan tombol run validation.
- [ ] Tambahkan filter issue berdasarkan severity dan status.
- [ ] Pastikan denominator missing/zero tampil sebagai CHECK, bukan angka `Infinity` atau `NaN`.

## Phase 7 — Frontend Report Preview dan Export UX

- [ ] Buat selector report type: FQMS/F-COST.
- [ ] Buat selector report month, product, manufacturer.
- [ ] Buat shell preview print-friendly.
- [ ] Buat FQMS preview placeholder untuk Section A Quality Trend.
- [ ] Buat FQMS preview placeholder untuk Section B Acceptance Ratio.
- [ ] Buat FQMS preview placeholder untuk Section C Detail Model.
- [ ] Buat FQMS preview placeholder untuk Section D Worst Defect.
- [ ] Buat F-COST preview placeholder untuk summary cards.
- [ ] Buat F-COST preview placeholder untuk Section A Monthly F-Cost.
- [ ] Buat F-COST preview placeholder untuk Section B F-Cost Trend.
- [ ] Buat F-COST preview placeholder untuk Section C Detail F-Cost & Part Contribution.
- [ ] Tambahkan CSS print untuk A4 dan hide `.no-print`.
- [ ] Tambahkan tombol `window.print()` untuk Print to PDF.
- [ ] Tambahkan halaman `/reports/export` untuk Excel export dan export history.

## Phase 8 — Backend Database Core

- [ ] Buat `drizzle.config.ts`.
- [ ] Buat SQLite client di `server/db/client.ts`.
- [ ] Buat schema Drizzle untuk `report_months`.
- [ ] Buat schema Drizzle untuk `products`.
- [ ] Buat schema Drizzle untuk `manufacturers`.
- [ ] Buat schema Drizzle untuk `factory_mappings`.
- [ ] Buat schema Drizzle untuk `models`.
- [ ] Buat schema Drizzle untuk `model_group_rules`.
- [ ] Buat schema Drizzle untuk `defect_categories`.
- [ ] Buat schema Drizzle untuk `nondefect_categories`.
- [ ] Buat schema Drizzle untuk `repair_actions`.
- [ ] Buat schema Drizzle untuk `fiscal_quality_targets`.
- [ ] Buat schema Drizzle untuk `fiscal_fcost_targets`.
- [ ] Buat schema Drizzle untuk `data_imports`.
- [ ] Buat schema Drizzle untuk `raw_sales_data`.
- [ ] Buat schema Drizzle untuk `raw_service_data`.
- [ ] Buat schema Drizzle untuk FQMS summary/entry tables.
- [ ] Buat schema Drizzle untuk F-COST summary/breakdown tables.
- [ ] Buat schema Drizzle untuk `validation_runs`.
- [ ] Buat schema Drizzle untuk `export_jobs`.
- [ ] Generate migration awal.
- [ ] Jalankan migration ke `data/sqlite.db`.
- [ ] Buat seed awal untuk LCD, LOCAL, IMPORT, categories, actions, dan factory sample.

## Phase 9 — Backend Repository Layer

- [ ] Buat repository report months.
- [ ] Buat repository products/manufacturers.
- [ ] Buat repository factory mappings.
- [ ] Buat repository models dan grouping rules.
- [ ] Buat repository categories dan repair actions.
- [ ] Buat repository targets.
- [ ] Buat repository imports.
- [ ] Buat repository raw sales rows.
- [ ] Buat repository raw service rows.
- [ ] Buat repository monthly summaries.
- [ ] Buat repository validation runs.
- [ ] Buat repository export jobs.
- [ ] Pastikan repository hanya CRUD/query, tanpa business calculation.

## Phase 10 — Backend API Contracts untuk Frontend

- [ ] Implement GET/POST `/api/report-months`.
- [ ] Implement GET/POST `/api/models`.
- [ ] Implement GET/POST `/api/references/factories`.
- [ ] Implement GET/POST `/api/references/defect-categories`.
- [ ] Implement GET/POST `/api/references/nondefect-categories`.
- [ ] Implement GET/POST `/api/references/repair-actions`.
- [ ] Implement GET/POST `/api/references/grouping-rules`.
- [ ] Implement GET/POST `/api/targets/fqms`.
- [ ] Implement GET/POST `/api/targets/fcost`.
- [ ] Implement GET `/api/review/sales`.
- [ ] Implement GET `/api/review/summary`.
- [ ] Implement GET `/api/review/defect`.
- [ ] Implement GET `/api/review/nondefect`.
- [ ] Implement GET `/api/review/fcost`.
- [ ] Pastikan API handler tidak berisi business logic atau query DB langsung.

## Phase 11 — Backend CSV Parser dan Import Services

- [ ] Implement required header validation untuk sales CSV.
- [ ] Implement required header validation untuk raw service CSV.
- [ ] Implement parser sales CSV streaming/Node mode.
- [ ] Implement parser raw service CSV streaming/Node mode.
- [ ] Simpan raw sales rows dengan raw JSON.
- [ ] Simpan raw service rows dengan raw JSON.
- [ ] Implement import history di `data_imports`.
- [ ] Implement replace mode untuk same month + import type + product/manufacturer.
- [ ] Implement factory mapping untuk split LOCAL/IMPORT.
- [ ] Implement keydate month validation.
- [ ] Implement sample outlier reporting untuk row beda bulan.
- [ ] Implement POST `/api/import/sales`.
- [ ] Implement POST `/api/import/raw-service`.
- [ ] Implement POST `/api/import/reprocess`.
- [ ] Implement GET `/api/import/history`.

## Phase 12 — Backend Aggregation Proof of Accuracy

- [ ] Implement sales aggregation ke monthly model summaries.
- [ ] Implement F-COST sales aggregation ke monthly F-COST summaries.
- [ ] Implement defect/non-defect aggregation memakai rule `job_sheet_section`.
- [ ] Implement repair action aggregation.
- [ ] Implement F-COST item breakdown Part/Labor/Trip.
- [ ] Implement F-COST part category breakdown.
- [ ] Cross-check `total_cost` vs item cost sum.
- [ ] Buat script/service proof untuk April 2026 sample CSV.
- [ ] Bandingkan angka April 2026 terhadap Excel/PDF referensi.
- [ ] Lock keputusan rule `job_sheet_section`.
- [ ] Lock mapping `defect_category` sebagai status dan `defect` sebagai detail category.
- [ ] Lock F-COST amount unit dan scaling Rp/Rp K.

## Phase 13 — Backend Validation Engine

- [ ] Implement V1 Import presence.
- [ ] Implement V2 Header validation.
- [ ] Implement V3 Report month consistency.
- [ ] Implement V4 Factory mapping completeness.
- [ ] Implement V5 Model mapping completeness.
- [ ] Implement V6 Active model completeness.
- [ ] Implement V7 Duplicate summary.
- [ ] Implement V8 Sales qty presence.
- [ ] Implement V9 Monthly PPM denominator.
- [ ] Implement V10 Defect total match.
- [ ] Implement V11 Non-defect total match.
- [ ] Implement V12 Category standardization.
- [ ] Implement V13 Target PPM presence.
- [ ] Implement V14 F-COST completeness.
- [ ] Implement V15 F-COST target presence.
- [ ] Implement V16 F-COST item breakdown match.
- [ ] Implement V17 F-COST part category match.
- [ ] Implement V18 F-COST total cost cross-check.
- [ ] Implement V19 LY F-Cost presence.
- [ ] Implement V20 Previous fiscal half data.
- [ ] Implement V21 Negative/outlier data.
- [ ] Implement V22 Print readiness.
- [ ] Implement POST `/api/validation/run`.
- [ ] Simpan validation run summary JSON.

## Phase 14 — Backend Report View Models

- [ ] Build FQMS Section A view model.
- [ ] Build FQMS Section B view model.
- [ ] Build FQMS Section C view model.
- [ ] Build FQMS Section D view model.
- [ ] Build F-COST summary cards view model.
- [ ] Build F-COST Section A view model.
- [ ] Build F-COST Section B view model.
- [ ] Build F-COST Section C view model.
- [ ] Implement model grouping saat report render.
- [ ] Implement fiscal half/current half period generation.
- [ ] Implement LY F-Cost lookup.
- [ ] Implement denominator safety untuk semua ratio/PPM.
- [ ] Implement GET `/api/reports/view-model`.

## Phase 15 — Excel Export, Backup, dan Packaging

- [ ] Map FQMS view model ke template workbook `FQMS - LCD LOCAL.xlsx`.
- [ ] Map F-COST view model ke template workbook `FCOST - LCD LOCAL.xlsx`.
- [ ] Implement POST `/api/reports/export-excel`.
- [ ] Simpan export history di `export_jobs`.
- [ ] Implement POST `/api/settings/backup`.
- [ ] Implement POST `/api/settings/restore`.
- [ ] Buat storage convention untuk imports, exports, dan backups.
- [ ] Buat portable package target Windows.
- [ ] Test di Windows bersih tanpa Node.js/database/browser tambahan.
- [ ] Dokumentasikan cara pakai operator.

## Phase 16 — Final Acceptance

- [ ] User dapat membuat report month baru.
- [ ] User dapat mengatur product/manufacturer/report scope.
- [ ] User dapat import sales CSV gabungan LOCAL/IMPORT.
- [ ] User dapat import raw service CSV gabungan LOCAL/IMPORT.
- [ ] Sistem memisahkan data berdasarkan factory mapping.
- [ ] Sistem menghitung monthly summary, defect/non-defect, repair action, dan F-COST otomatis.
- [ ] User dapat review dan override anomali dengan audit flag.
- [ ] Validation utama menghasilkan status OK/CHECK yang jelas.
- [ ] FQMS preview menampilkan Section A/B/C/D dengan formula benar.
- [ ] F-COST preview menampilkan Summary/A/B/C dengan formula benar.
- [ ] User dapat export Excel.
- [ ] User dapat Print to PDF dari browser.
- [ ] User dapat backup SQLite database.
- [ ] Aplikasi dapat dijalankan di PC Windows tanpa install Node.js/database/browser tambahan.
