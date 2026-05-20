# Task Plan Implementasi — QRCC Data Center

> **Versi**: 2.3 · **Terakhir diperbarui**: 2026-05-20
>
> Checklist ini memakai pendekatan **data-truth-first vertical slice**. Milestone pertama bukan jumlah halaman, tetapi bukti bahwa workflow April 2026 LCD LOCAL menghasilkan angka FQMS/F-COST yang akurat, auditable, dan bisa diexport.

---

## Prinsip Eksekusi

- [ ] Kerjakan dalam irisan kecil yang bisa dicek dengan `pnpm lint`, `pnpm typecheck`, dan preview browser.
- [ ] Jangan menganggap UI/report final sebelum angka parser April 2026 terbukti akurat terhadap referensi Excel/PDF.
- [ ] Pertahankan boundary backend: API controller → service → repository → SQLite.
- [ ] Pertahankan Excel sebagai output/template saja, bukan database.
- [ ] Simpan raw rows agar semua angka summary/report bisa ditelusuri ulang.
- [ ] Tampilkan status import per month/product/scope agar operator tahu bulan terakhir yang sudah memiliki sales/raw data.
- [ ] Raw service review memakai override line-level untuk `symptom` dan `action`; jangan timpa override dengan import ulang.
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
- [ ] FQMS hanya memakai raw service `job_sheet_section = 1`.
- [ ] Untuk raw service FQMS-impact pada model aktif laporan, `action`, `defect_category` (`DEFECT`/`NON_DEFECT`), dan `defect` wajib terisi.
- [ ] Raw service dengan `defect_category` atau `defect` bernilai `N/A` tidak dihitung sebagai claim FQMS.
- [ ] Raw service `job_sheet_section = 0` tidak wajib punya `action`, `defect_category`, atau `defect` untuk laporan FQMS.
- [ ] Review Anomalies FQMS tidak boleh menampilkan row section 0 hanya karena action/defect kosong.
- [ ] PPM FQMS dibulatkan ke atas ke bilangan bulat.
- [x] Master model-series FQMS per product/manufacturer/month tersedia untuk Slice 0; model aktif FQMS tidak lagi memakai baseline sales bulan berjalan.
- [ ] F-COST memakai semua cost rows valid.
- [ ] Cost disimpan dalam rupiah asli.
- [ ] Re-import sales same month + product + scope + import type memakai automatic replace.
- [ ] Raw service replace mode Phase 3 dianggap baseline sementara; target operasionalnya staging compare + upsert per notification/line.

Gate lulus Slice 0:

- [ ] Import sales dan raw service berhasil dengan header validation.
- [ ] Re-import tidak menyebabkan double count.
- [x] FQMS quantity/count exact dengan referensi April 2026.
- [x] F-COST base amount exact sebelum formatting/rounding.
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
- [x] Update sales required headers agar `Sales Month` wajib dan divalidasi terhadap selected report month.
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

Phase 3 follow-up decision:

- [x] Pertahankan sales replace mode sebagai perilaku target.
- [ ] Ganti raw service operational re-import dari replace penuh menjadi staging compare + upsert per notification/line sebelum raw review dipakai untuk workflow nyata.
- [x] Tambahkan master action import/seed dari `.doc/dummy master action.csv` atau sumber final dengan kolom `Action`, `Category`, `Defect`.
- [x] Hitung effective `defect_category` dan `defect` dari effective action, bukan dari edit manual langsung.

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
- Script import/verifikasi FQMS akumulasi dari 14 workbook monitoring lokal dibuat di `scripts/import-fqms-accumulated-monitoring.mjs`. Default-nya membaca `.doc/raw`, membandingkan workbook terhadap proof CSV April 2026, lalu replace rows `fqms_accumulated_model_rows` untuk scope `202604/LCD/LOCAL`.
- Script import raw historis FQMS dari sheet `raw` 14 workbook monitoring dibuat di `scripts/import-fqms-historical-defects.mjs`. Default-nya membaca `.doc/raw`, memvalidasi total `DEFECT`/`NON_DEFECT` terhadap sheet `summary`, lalu replace rows `fqms_historical_defect_rows` untuk scope `202604/LCD/LOCAL`.
- Hasil proof FQMS April 2026 LCD LOCAL dari data akumulasi: accumulated sales `821,326`; defect `4,061`; non-defect `1,025`; total claim `5,086`; exposure `11,931,633`; defect PPM `340.355759`; non-defect PPM `85.906095`; total PPM `426.261854`.
- Untuk PC lain, jalankan ulang proof dengan `node scripts/proof-fqms-april.mjs <monitoring-dir> <sales-csv-path> <output-csv-path>` jika path lokal berbeda.
- Untuk mengisi SQLite dari workbook yang sudah disertakan di repo, jalankan `node scripts/import-fqms-accumulated-monitoring.mjs`. Optional args: `<report-month> <monitoring-dir> <proof-csv-path> <database-path>`.
- Untuk mengisi raw historis Section D dari workbook monitoring, jalankan `node scripts/import-fqms-historical-defects.mjs`. Optional args: `<report-month> <monitoring-dir> <database-path>`.
- `storage/proofs/` bisa ignored oleh git; jangan menganggap output CSV selalu ikut repo. Script proof adalah sumber regenerasi utama.
- Final cross-check Phase 4 sudah dikonfirmasi cocok semua terhadap referensi FQMS/F-COST April 2026 LCD LOCAL. Tidak ada mismatch blocking yang tersisa untuk Phase 4.

- [x] Implement sales aggregation untuk denominator/summary Slice 0.
- [x] Implement FQMS claim quantity dari raw service reportable: `job_sheet_section = 1`, action valid, category `DEFECT`/`NON_DEFECT`, dan defect bukan `N/A`.
- [x] Implement defect/non-defect ringkas yang dibutuhkan FQMS summary awal.
- [x] Update FQMS defect/non-defect agar memakai effective action/master action setelah raw service line override.
- [x] Implement F-COST aggregation dari semua valid cost rows.
- [x] Simpan F-COST amount dalam rupiah asli.
- [x] Cross-check `total_cost` vs parts/labor/transportation cost jika field tersedia.
- [x] Buat proof script/service untuk April 2026 LCD LOCAL.
- [x] Buat proof FQMS akumulasi April 2026 dari sales akumulasi dan workbook monitoring per model.
- [x] Persist proof FQMS akumulasi April 2026 per model ke SQLite untuk dipakai service/view model.
- [x] Tambahkan script repeatable untuk memverifikasi 14 workbook monitoring aktif `.doc/raw` terhadap proof April 2026 dan replace data SQLite jika cocok.
- [x] Tambahkan tabel dan importer raw historis FQMS dari sheet `raw` workbook monitoring untuk Section D.
- [x] Build reusable FQMS accumulated service yang menghitung exposure dan PPM dari persisted rows + master `fqms_model_series`.
- [x] Bandingkan FQMS quantity/count terhadap referensi Excel/PDF.
- [x] Bandingkan F-COST amount terhadap referensi Excel/PDF.
- [x] Catat mismatch sebagai blocking issue sebelum UI polish.

Gate Phase 4:

- [x] FQMS count/quantity exact.
- [x] F-COST base sum exact sebelum formatting.
- [x] Tidak ada `Infinity`, `NaN`, atau angka misleading saat denominator kosong/zero.

## Phase 5 — Validation Engine Minimum

Tujuan: validasi menjadi gate operasional, bukan checklist abstrak.

- [x] Implement import presence validation.
- [x] Implement header validation result persistence.
- [x] Implement report month consistency validation.
- [x] Implement sales `Sales Month` consistency validation.
- [x] Implement import status lookup per month/product/scope/import type.
- [x] Implement factory/model mapping completeness untuk Slice 0.
- [x] Implement duplicate/re-import safety validation.
- [x] Implement raw service staging compare status: `NEW_NOTIFICATION`, `DUPLICATE_UNCHANGED`, `SOURCE_CHANGED`, `LINE_COUNT_CHANGED`, `HAS_MANUAL_OVERRIDE`, `OVERRIDE_CONFLICT`.
- [x] Implement raw service line key/fingerprint: `notification + job_sheet_section + part_code + line_no_dalam_notification` sebagai baseline.
- [x] Treat changed line count for an existing notification as CHECK/CONFLICT.
- [x] Ensure raw import ulang tidak menimpa manual override `symptom`/`action`.
- [x] Implement API/service raw service line-level override untuk `symptom` dan `action`.
- [x] Implement effective raw service rows dari raw source + line override + `master_actions`.
- [x] Implement critical validation untuk override action yang tidak ada di `master_actions`.
- [x] Implement warning/CHECK untuk override line key yang tidak lagi ada di current raw rows.
- [x] Implement denominator safety validation.
- [x] Implement FQMS total consistency validation.
- [x] Implement F-COST total consistency validation.
- [x] Implement export readiness validation.
- [x] Implement severity: critical/error/warning.
- [x] Implement `POST /api/validation/run`.
- [x] Simpan validation run summary JSON.

Gate Phase 5:

- [x] Critical issue memblokir Excel export.
- [x] Warning/CHECK tetap tampil tetapi tidak memblokir export.
- [x] Tiap issue punya reason dan related data reference jika tersedia.
- [x] Existing import status dan raw conflict status muncul sebagai issue yang bisa ditelusuri ke Review Anomalies.

## Phase 6 — Report View Model, Preview, dan Excel Export

Tujuan: preview dan Excel tidak punya logic hitung berbeda.

- [x] Build report view model FQMS ringkas untuk Slice 0.
- [x] Build report view model FQMS akumulasi untuk Slice 0 dari data historis/akumulasi SQLite.
- [x] Build report view model F-COST ringkas untuk Slice 0.
- [x] Implement `GET /api/reports/view-model`.
- [x] Render preview dari view model yang sama.
- [x] Gunakan FQMS accumulated view model untuk preview/export summary saat data akumulasi tersedia, dengan monthly summary sebagai fallback.
- [x] Map FQMS accumulated view model ke sheet utama `FQMS` dan `QRCC Summary` pada `templates/excel/FQMS - LCD LOCAL.xlsx`.
- [x] Pastikan export sheet `FQMS` memakai report month aktif tanpa timezone shift (`202604` tampil sebagai `Apr-26`, bukan `Mar-26`).
- [x] Pastikan Section C export mengurutkan model dari launching month paling lama, membulatkan angka tampilan ke atas tanpa desimal, dan mengosongkan `L37:M37`.
- [x] Pastikan style total label Section C `C37:E37` merge dengan fill `#31869B`, font Calibri 9, dan text putih.
- [x] Build FQMS Section D Worst Defect view model dari effective raw service rows + master action + denominator Section C.
- [x] Map Section D Worst Defect ke sheet utama `FQMS`, bersihkan placeholder `Model A`, dan isi bucket `~Jan'26`, `Feb'26`, `Mar'26`, `Apr'26` dari `fqms_historical_defect_rows`.
- [x] Map F-COST view model ke `templates/excel/FCOST - LCD LOCAL.xlsx`.
- [x] Implement `POST /api/reports/export-excel`.
- [x] Pastikan export menolak jika validation critical masih ada.
- [x] Simpan export history jika `export_jobs` sudah tersedia.

Gate Phase 6:

- [x] Total di preview sama dengan Excel export.
- [x] Perbedaan hanya formatting/rounding presentasi.
- [x] Excel file bisa dibuka dan angka utama cocok dengan referensi.

## Phase 7 — Minimal UI untuk 5 Halaman Inti

Tujuan: user bisa menjalankan Slice 0 tanpa full CRUD.

- [x] Buat atau rapikan app layout utama secukupnya.
- [x] Buat Month/Scope page atau dashboard control untuk April 2026, LCD, LOCAL.
- [x] Buat Import Center untuk sales CSV dan raw service CSV.
- [x] Tampilkan import status, last imported month, row counts, warnings, anomaly count, exported status, dan replace/upsert status.
- [ ] Tampilkan preview compare saat upload raw service menemukan existing data.
- [x] Buat Review Anomalies untuk missing mapping/outlier/error rows.
- [ ] Tambahkan edit minimal dari Review Anomalies untuk unblock import.
- [x] Tambahkan raw line-level override untuk `symptom` dan `action`.
- [x] Tampilkan effective category/defect hasil master action setelah action dioverride.
- [x] Buat Validation Summary dengan filter blocking vs non-blocking.
- [x] Buat Report Preview/Export untuk FQMS + F-COST ringkas.
- [x] Hindari full `/models`, `/references`, dan `/targets` CRUD sampai Slice 0 lulus.

Gate Phase 7:

- [ ] User dapat menyelesaikan flow dari pilih scope → import → review anomaly → validation → preview/export.
- [ ] UI menampilkan critical block state dengan jelas.
- [ ] UI menampilkan sales replace behavior dan raw upsert/compare behavior dengan jelas.

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
- [ ] Tambahkan export snapshot/history agar report final lama tidak berubah saat current data direvisi.
- [ ] Tambahkan audit/version history raw service line source dan manual override jika kebutuhan operasional melebar.
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

## Keputusan Baku Tambahan dari Testing Slice 0

- [x] FQMS claim hanya menghitung row reportable: `job_sheet_section = 1`, model masuk daftar laporan FQMS, action ada di master action, category `DEFECT`/`NON_DEFECT`, dan defect bukan kosong/`N/A`.
- [x] Row dengan master action `N/A / N/A` dikeluarkan dari claim FQMS dan bukan `ACTION_UNCLASSIFIED`.
- [x] Row `job_sheet_section = 0` tidak wajib punya action/category/defect untuk FQMS dan tidak boleh membuat Review Anomalies FQMS ramai.
- [x] `ACTION_UNCLASSIFIED` hanya berarti row FQMS-impact punya action kosong atau action tidak ditemukan di master action.
- [x] PPM FQMS Slice 0 dibulatkan ke atas ke bilangan bulat.
- [x] Export Excel FQMS Section C menampilkan semua angka relevan tanpa desimal dan dibulatkan ke atas; nilai presisi tetap berasal dari view model untuk kalkulasi/audit.
- [x] Export Excel FQMS Section C diurutkan berdasarkan launching month paling lama, lalu model code.
- [x] Preview/export FQMS memakai accumulated view model historis saat rows akumulasi tersedia; monthly summary tetap fallback.
- [x] Section D Worst Defect memakai model aktual yang sama dengan Section C; histori older/Feb/Mar/Apr berasal dari sheet `raw` 14 workbook monitoring yang sudah dipersist ke SQLite.
- [x] Buat master model-series FQMS final per product/manufacturer/month. Aggregation, validation, Review Anomalies, dan accumulated view model memakai master model-series, bukan baseline sales bulan berjalan.
