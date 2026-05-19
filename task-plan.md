# Task Plan Implementasi — QRCC Data Center

> **Versi**: 2.1 · **Terakhir diperbarui**: 2026-05-19
>
> Checklist ini memakai pendekatan **data-truth-first vertical slice**. Milestone pertama bukan jumlah halaman, tetapi bukti bahwa workflow April 2026 LCD LOCAL menghasilkan angka FQMS/F-COST yang akurat, auditable, dan bisa diexport.

---

## Prinsip Eksekusi

- [ ] Kerjakan dalam irisan kecil yang bisa dicek dengan `pnpm lint`, `pnpm typecheck`, dan preview browser.
- [ ] Jangan menganggap UI/report final sebelum angka parser April 2026 terbukti akurat terhadap referensi Excel/PDF.
- [ ] Pertahankan boundary backend: API controller → service → repository → SQLite.
- [ ] Pertahankan Excel sebagai output/template saja, bukan database.
- [ ] Simpan raw rows agar semua angka summary/report bisa ditelusuri ulang.
- [ ] Preview dan Excel export harus berasal dari report view model yang sama.
- [ ] Critical validation issue memblokir export; warning/CHECK tidak memblokir export.
- [ ] Portable packaging dibuktikan dini dengan portable Node bundle smoke test.

---

## Slice 0 — April 2026 LCD LOCAL Accuracy Slice

Slice pertama sengaja kecil agar rule data, parser, aggregation, validation, preview, Excel export, dan packaging smoke test terbukti sebelum scope diperluas.

Scope terkunci:

- [ ] Report month: April 2026 (`202604`).
- [ ] Product: LCD.
- [ ] Manufacturer/report scope: LOCAL.
- [ ] Input: sales CSV dan raw service CSV.
- [ ] Output: FQMS ringkas, F-COST ringkas, preview, Excel export.
- [ ] Template referensi: `templates/excel/FQMS - LCD LOCAL.xlsx` dan `templates/excel/FCOST - LCD LOCAL.xlsx`.
- [ ] Quantity/count harus exact terhadap referensi.
- [ ] Cost/amount boleh berbeda hanya karena pembulatan presentasi.
- [ ] FQMS claim quantity memakai `job_sheet_section = 1`.
- [ ] F-COST memakai semua cost rows valid.
- [ ] Cost disimpan dalam rupiah asli.
- [ ] Re-import same month + product + scope + import type memakai automatic replace.

Gate lulus Slice 0:

- [ ] Import sales dan raw service berhasil dengan header validation.
- [ ] Re-import tidak menyebabkan double count.
- [ ] FQMS quantity/count exact dengan referensi April 2026.
- [ ] F-COST base amount exact sebelum formatting/rounding.
- [ ] Validation membedakan blocking critical issue vs non-blocking warning/CHECK.
- [ ] Preview dan Excel export membaca view model yang sama.
- [ ] Portable Node bundle smoke test dapat menjalankan flow inti.

---

## Phase 0 — Project Hygiene dan Baseline

- [x] Pastikan script `pnpm dev` berjalan.
- [x] Pastikan `pnpm lint` berjalan.
- [x] Pastikan `pnpm lint:fix` berjalan.
- [x] Pastikan `pnpm typecheck` berjalan.
- [x] Pastikan `pnpm build` berjalan.
- [x] Pastikan Nuxt 4, Nuxt UI 4, Vue 3, dan TypeScript strict aktif.
- [x] Pastikan Tailwind CSS aktif melalui Nuxt UI/Tailwind v4 import.
- [x] Rapikan app shell minimal hanya jika dibutuhkan untuk menjalankan Slice 0.
- [x] Update command di `CLAUDE.md` dari script aktual `package.json`.

## Phase 1 — Minimal SQLite + Drizzle Foundation

Tujuan: membuat persistence minimum untuk membuktikan angka, bukan schema final semua modul.

- [x] Buat `drizzle.config.ts`.
- [x] Buat SQLite client di `server/db/client.ts`.
- [x] Buat schema Drizzle minimal untuk report month/scope context.
- [x] Buat schema minimal untuk products dan manufacturers/scopes.
- [x] Buat schema minimal untuk factory mappings yang dibutuhkan Slice 0.
- [x] Buat schema `data_imports` untuk import session/history.
- [x] Buat schema `raw_sales_rows`.
- [x] Buat schema `raw_service_rows`.
- [x] Buat schema output ringkas FQMS.
- [x] Buat schema output ringkas F-COST.
- [x] Buat schema `validation_runs` dan validation issues.
- [x] Buat schema `export_jobs` jika Excel export sudah menyimpan history.
- [x] Generate migration awal.
- [x] Jalankan migration ke `data/sqlite.db`.
- [x] Buat seed minimal untuk April 2026, LCD, LOCAL, dan mapping sample yang dibutuhkan.

## Phase 2 — Repository Layer Minimum

Tujuan: menjaga service tidak query Drizzle langsung.

- [x] Buat repository imports.
- [x] Buat repository raw sales rows.
- [x] Buat repository raw service rows.
- [x] Buat repository scope/month lookup.
- [x] Buat repository minimal factory mappings.
- [x] Buat repository FQMS summary output.
- [x] Buat repository F-COST summary output.
- [x] Buat repository validation run/results.
- [x] Pastikan repository hanya CRUD/query, tanpa business calculation.

## Phase 3 — CSV Import Pipeline dan Replace Mode

Tujuan: ingestion deterministic dan auditable.

- [x] Definisikan required headers untuk sales CSV.
- [x] Definisikan required headers untuk raw service CSV.
- [x] Implement header validation sales CSV.
- [x] Implement header validation raw service CSV.
- [x] Implement parser sales CSV streaming/Node mode.
- [x] Implement parser raw service CSV streaming/Node mode.
- [x] Simpan raw sales rows dengan raw JSON jika perlu.
- [x] Simpan raw service rows dengan raw JSON jika perlu.
- [x] Implement import metadata: filename, row count, accepted count, rejected count, warning count, timestamp.
- [x] Implement automatic replace untuk same month + product + scope + import type.
- [x] Implement split LOCAL berdasarkan factory mapping.
- [x] Implement keydate month validation untuk raw service.
- [x] Implement sample outlier reporting untuk row beda bulan.
- [x] Implement `POST /api/import/sales`.
- [x] Implement `POST /api/import/raw-service`.
- [x] Implement `GET /api/import/history`.

Gate Phase 3:

- [x] Missing required header menolak import dengan error jelas.
- [x] Extra columns tidak merusak import.
- [x] Import ulang file yang sama mengganti raw rows lama, bukan append double.
- [x] Import history mencatat replace action.

## Phase 4 — Aggregation Proof of Accuracy

Tujuan: membuktikan angka sebelum UI/report melebar.

Catatan status untuk lanjut kerja di PC lain:

- Parser/raw monthly proof sudah berjalan untuk April 2026 dan Maret 2026 LCD LOCAL.
- CSV dengan preamble sebelum header sudah ditemukan pada file Maret 2026 (`Monthly Report Final Recipe`, `Periode`, `Dibuat`). Parser harus mempertahankan kemampuan mencari header wajib, bukan mengasumsikan header selalu baris pertama.
- Mapping factory LCD LOCAL yang dipakai sample adalah `SEID`, `SKW`, `MOKA`, dan `MTC`. Jangan kembali ke mapping hanya `SEID`, karena itu membuat raw rows undercount.
- Sales CSV bulanan sekarang memakai kolom `Report Model` untuk model laporan/agregasi. Kolom `Model` tetap model asli dari sales system untuk audit. Contoh: `2TC32HD1400I` digabung ke `2TC32HD1500I` lewat `Report Model`.
- Required header matching untuk CSV dibuat case-insensitive, sehingga `report model` dan `Report model` diterima sebagai canonical `Report Model`.
- April 2026 proof dari sample: sales qty `56,057`; claim qty `2,585`; defect `1,830`; non-defect `170`; unclassified/N/A claim `585`; F-COST total `1,268,117,579`; selisih `total_cost` vs item cost `0`.
- Maret 2026 proof dari sample: sales qty `58,858`; claim qty `2,043`; defect `1,468`; non-defect `147`; unclassified/N/A claim `428`; F-COST total `984,681,281`; selisih `total_cost` vs item cost `0`.
- F-COST Maret cocok dengan `templates/excel/FCOST - LCD LOCAL.xlsx`: template menyimpan amount dalam ribuan (`984681.280999...`), sama dengan `984,681,281` rupiah.
- FQMS template memakai angka akumulasi per model, bukan monthly raw summary langsung. Phase 4 FQMS tidak bisa ditutup hanya dengan satu bulan raw service + satu bulan sales.
- Untuk menyelesaikan proof FQMS exact, siapkan data akumulasi: sales historis per model dari launching month sampai report month, claim historis per model untuk `DEFECT`/`NON_DEFECT`, mapping raw model ke model report, launching month per model, dan target monthly PPM per fiscal half.
- Alternatif cepat: siapkan trusted CSV/workbook FQMS accumulated reference berisi `report_month`, `report_model`, `launching_month`, `accumulated_sales`, `defect_qty`, `non_defect_qty`, `total_claim_qty`, dan `target_ppm`.
- Data sales akumulasi hingga April 2026 sudah tersedia dari `C:\Users\GAY0700622\Documents\sales akumulasi into april 2026.csv`.
- Data claim akumulasi April 2026 diambil dari 14 workbook monitoring aktif di `D:\ARISAFARI\Works\FQMS - Sharp Confidential\02_LCD SEID\RAW DATA\Monitoring\01_active`.
- Script proof FQMS akumulasi dibuat di `scripts/proof-fqms-april.mjs` dan menghasilkan `storage/proofs/fqms-accumulated-lcd-local-2026-04.csv`.
- Hasil proof FQMS April 2026 LCD LOCAL dari data akumulasi: accumulated sales `821,326`; defect `4,061`; non-defect `1,025`; total claim `5,086`; exposure `11,931,633`; defect PPM `340.355759`; non-defect PPM `85.906095`; total PPM `426.261854`.
- Untuk PC lain, jalankan ulang proof dengan `node scripts/proof-fqms-april.mjs <monitoring-dir> <sales-csv-path> <output-csv-path>` jika path lokal berbeda.
- `storage/proofs/` bisa ignored oleh git; jangan menganggap output CSV selalu ikut repo. Script proof adalah sumber regenerasi utama.

- [x] Implement sales aggregation untuk denominator/summary Slice 0.
- [x] Implement FQMS claim quantity dari raw service `job_sheet_section = 1`.
- [x] Implement defect/non-defect ringkas yang dibutuhkan FQMS summary awal.
- [x] Implement F-COST aggregation dari semua valid cost rows.
- [x] Simpan F-COST amount dalam rupiah asli.
- [x] Cross-check `total_cost` vs parts/labor/transportation cost jika field tersedia.
- [x] Buat proof script/service untuk April 2026 LCD LOCAL.
- [x] Buat proof FQMS akumulasi April 2026 dari sales akumulasi dan workbook monitoring per model.
- [ ] Bandingkan FQMS quantity/count terhadap referensi Excel/PDF.
- [ ] Bandingkan F-COST amount terhadap referensi Excel/PDF.
- [ ] Catat mismatch sebagai blocking issue sebelum UI polish.

Gate Phase 4:

- [ ] FQMS count/quantity exact.
- [ ] F-COST base sum exact sebelum formatting.
- [x] Tidak ada `Infinity`, `NaN`, atau angka misleading saat denominator kosong/zero.

## Phase 5 — Validation Engine Minimum

Tujuan: validasi menjadi gate operasional, bukan checklist abstrak.

- [ ] Implement import presence validation.
- [ ] Implement header validation result persistence.
- [ ] Implement report month consistency validation.
- [ ] Implement factory/model mapping completeness untuk Slice 0.
- [ ] Implement duplicate/re-import safety validation.
- [ ] Implement denominator safety validation.
- [ ] Implement FQMS total consistency validation.
- [ ] Implement F-COST total consistency validation.
- [ ] Implement export readiness validation.
- [ ] Implement severity: critical/error/warning.
- [ ] Implement `POST /api/validation/run`.
- [ ] Simpan validation run summary JSON.

Gate Phase 5:

- [ ] Critical issue memblokir Excel export.
- [ ] Warning/CHECK tetap tampil tetapi tidak memblokir export.
- [ ] Tiap issue punya reason dan related data reference jika tersedia.

## Phase 6 — Report View Model, Preview, dan Excel Export

Tujuan: preview dan Excel tidak punya logic hitung berbeda.

- [ ] Build report view model FQMS ringkas untuk Slice 0.
- [ ] Build report view model F-COST ringkas untuk Slice 0.
- [ ] Implement `GET /api/reports/view-model`.
- [ ] Render preview dari view model yang sama.
- [ ] Map FQMS view model ke `templates/excel/FQMS - LCD LOCAL.xlsx`.
- [ ] Map F-COST view model ke `templates/excel/FCOST - LCD LOCAL.xlsx`.
- [ ] Implement `POST /api/reports/export-excel`.
- [ ] Pastikan export menolak jika validation critical masih ada.
- [ ] Simpan export history jika `export_jobs` sudah tersedia.

Gate Phase 6:

- [ ] Total di preview sama dengan Excel export.
- [ ] Perbedaan hanya formatting/rounding presentasi.
- [ ] Excel file bisa dibuka dan angka utama cocok dengan referensi.

## Phase 7 — Minimal UI untuk 5 Halaman Inti

Tujuan: user bisa menjalankan Slice 0 tanpa full CRUD.

- [ ] Buat atau rapikan app layout utama secukupnya.
- [ ] Buat Month/Scope page atau dashboard control untuk April 2026, LCD, LOCAL.
- [ ] Buat Import Center untuk sales CSV dan raw service CSV.
- [ ] Tampilkan import status, row counts, warnings, dan replace status.
- [ ] Buat Review Anomalies untuk missing mapping/outlier/error rows.
- [ ] Tambahkan edit minimal dari Review Anomalies untuk unblock import.
- [ ] Buat Validation Summary dengan filter blocking vs non-blocking.
- [ ] Buat Report Preview/Export untuk FQMS + F-COST ringkas.
- [ ] Hindari full `/models`, `/references`, dan `/targets` CRUD sampai Slice 0 lulus.

Gate Phase 7:

- [ ] User dapat menyelesaikan flow dari pilih scope → import → review anomaly → validation → preview/export.
- [ ] UI menampilkan critical block state dengan jelas.
- [ ] UI menampilkan replace import behavior dengan jelas.

## Phase 8 — Portable Node Bundle Smoke Test

Tujuan: de-risk zero-install sebelum fitur melebar.

- [ ] Buat packaging baseline dengan portable Node bundle.
- [ ] Pastikan package membawa app build, runtime portable, `data/`, `storage/`, dan `templates/`.
- [ ] Jalankan app dari folder portable tanpa install Node manual.
- [ ] Import sales CSV dan raw service CSV dari package smoke environment.
- [ ] Jalankan validation.
- [ ] Buka preview.
- [ ] Export Excel.
- [ ] Dokumentasikan batasan packaging yang ditemukan.

Gate Phase 8:

- [ ] Operator flow inti berjalan dari folder portable.
- [ ] SQLite file dibuat/dibaca di lokasi yang benar.
- [ ] Template Excel ditemukan dari package.

## Phase 9 — Expand setelah Slice 0 Lulus

Jangan mulai phase ini sebelum gate Slice 0 lulus.

- [ ] Tambahkan IMPORT scope memakai pola LOCAL yang sudah terbukti.
- [ ] Tambahkan report month lain setelah April 2026 akurat.
- [ ] Lengkapi FQMS Section A/B/C/D.
- [ ] Lengkapi F-COST Summary/A/B/C.
- [ ] Tambahkan full master data CRUD jika edit minimal sudah tidak cukup.
- [ ] Tambahkan target management lengkap.
- [ ] Tambahkan backup/restore SQLite.
- [ ] Tambahkan browser Print to PDF polish dan CSS print.
- [ ] Uji portable package ulang di Windows bersih.

---

## Final Acceptance Setelah Ekspansi MVP

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
