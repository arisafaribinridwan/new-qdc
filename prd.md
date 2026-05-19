# PRD — QRCC Data Center FQMS/F-COST Automated Monthly Workflow

> **Versi**: 3.2 · **Terakhir diperbarui**: 2026-05-19
>
> Dokumen ini adalah **PRD core utama** untuk QRCC Data Center. Detail frontend, backend, report specification, dan task implementasi dipisahkan ke dokumen turunan agar lebih mudah dipelihara.

---

## Dokumen Turunan

| Dokumen | Isi |
|---|---|
| [`frontend.md`](frontend.md) | Struktur UI, page map, UX workflow, report preview, print, dan export flow |
| [`backend.md`](backend.md) | Arsitektur backend, CSV import, data model, aggregation, validation, dan API target |
| [`spec-report-fqms.md`](spec-report-fqms.md) | Spesifikasi report FQMS Section A/B/C/D |
| [`spec-report-fcost.md`](spec-report-fcost.md) | Spesifikasi report F-COST Summary/A/B/C |
| [`task-plan.md`](task-plan.md) | Task plan implementasi komprehensif dalam bentuk checklist, disusun frontend-first |

---

## 1 · Ringkasan Produk

QRCC Data Center adalah aplikasi web lokal untuk menggantikan workflow bulanan FQMS dan F-COST yang sebelumnya bergantung pada Excel workbook, copy-paste, helper sheet, formula manual, dan pengecekan lintas file. Aplikasi membaca data mentah CSV hasil tarikan sistem, membaca data sales CSV, memproses agregasi secara otomatis, menyimpan data di SQLite lokal, melakukan validasi, lalu menghasilkan report Excel dan tampilan report siap print to PDF.

Aplikasi harus bersifat **portable / zero-install**. User kantor harus bisa menjalankan aplikasi dari folder lokal atau flashdisk tanpa install Node.js, database server, Playwright browser, atau tool developer lain.

| Field | Nilai |
|---|---|
| Nama aplikasi | QRCC Data Center |
| Modul utama | FQMS dan F-COST monthly workflow |
| Produk awal | LCD |
| Manufacturer/report scope awal | LOCAL dan IMPORT harus bisa dipisah sebagai konteks report |
| Target user | Operator workflow bulanan QRCC |
| Mode operasi | Local-first, single user, portable |
| Output utama | Report preview, Excel export, dan browser Print to PDF |

---

## 2 · Tujuan Produk

Tujuan utama aplikasi adalah membuat workflow bulanan menjadi pendek, akurat, dan auditable. User cukup memilih bulan laporan, mengimpor sales CSV dan raw service CSV, menjalankan auto-processing, meninjau hasil agregasi, memperbaiki anomali jika perlu, menjalankan validasi, lalu export report.

Aplikasi tidak boleh menjadikan Excel sebagai database. Excel hanya output/template report. Database SQLite adalah single source of truth. Raw data tetap disimpan agar hasil summary bisa ditelusuri ulang.

---

## 3 · Prinsip Kunci

1. **Automated CSV Import** — Sales dan raw service data masuk lewat CSV, bukan input manual utama.
2. **Automated Aggregation** — Sistem menghitung monthly summary, defect/non-defect category, repair action, F-COST summary, dan F-COST breakdown dari data CSV.
3. **Review, not manual entry** — Halaman entry berubah menjadi halaman review/edit hasil agregasi. Manual edit hanya untuk koreksi anomali, bukan workflow utama.
4. **SQLite as source of truth** — Data utama, data raw, hasil agregasi, target, validation, dan export history disimpan di SQLite lokal.
5. **Long-format storage** — Data disimpan sebagai baris per bulan/model/category. Wide-format hanya untuk tampilan report atau export Excel.
6. **Explicit grouping** — Aturan penggabungan model dan mapping factory/manufacturer disimpan di tabel reference, bukan hardcode tersembunyi.
7. **Portable zero-install** — Aplikasi harus dapat dijalankan tanpa hak admin dan tanpa instalasi dependency eksternal di PC kantor.
8. **Report parity** — Angka report harus bisa dibuktikan sama dengan hitungan manual Excel/reference report sebelum UI dipercantik.
9. **Sales report model grouping and period** — Sales CSV memakai `Model` sebagai model asli/source untuk audit, `Report Model` sebagai model laporan untuk grouping/agregasi, dan `Sales Month` sebagai periode data sales format `YYYY-MM`. Required header matching harus toleran terhadap kapitalisasi seperti `report model` atau `Report model`.
10. **Import idempotency** — Import ulang tidak boleh membuat double count. Sales memakai replace per month/scope/import type, sedangkan raw service harus bergerak ke staging compare + upsert per notification/line agar revisi kasus bisa dilacak.
11. **Raw review override protection** — Koreksi manual raw service hanya untuk baris tertentu, terutama `symptom` dan `action`; koreksi tersebut tidak boleh tertimpa diam-diam oleh import ulang.

---

## 4 · Tech Stack Final

| Layer | Teknologi | Catatan |
|---|---|---|
| Framework | Nuxt 4 full-stack monolith | UI dan API dalam satu codebase |
| Bahasa | TypeScript strict | Wajib untuk frontend dan backend |
| UI | Vue 3 + Nuxt UI 4 | Form, table, dashboard shell |
| Database | SQLite | File `sqlite.db` di folder aplikasi/data |
| ORM | Drizzle ORM | Schema-as-code dan migration |
| Validasi | Zod | Server-side request/import validation |
| CSV parser | csv-parse atau PapaParse | Prefer streaming/Node mode untuk file besar |
| Excel export | ExcelJS | Mengisi template `.xlsx` |
| PDF export | Native Browser Print | Report render di browser lalu `window.print()` / Ctrl+P |
| Packaging | Portable Node bundle sebagai baseline awal | Target akhir zip portable berisi exe/bat, runtime portable, data, dan templates. Bun compile/Node SEA hanya dipertimbangkan setelah baseline terbukti. |

Playwright tidak digunakan untuk PDF karena butuh Chromium besar, sering diblokir IT, dan tidak cocok untuk zero-install. PDF dibuat dari browser print bawaan Chrome/Edge dengan CSS print yang ketat.

---

## 7 · Workflow Utama

1. User membuat atau memilih report month, misalnya April 2026 (`202604`).
2. User memilih konteks report: product (`LCD`) dan manufacturer/report scope (`LOCAL` atau `IMPORT`).
3. User mengimpor sales CSV. File sales bisa berisi gabungan LCD local dan import; sistem memisahkan berdasarkan mapping factory/manufacturer.
4. User mengimpor raw service CSV. File raw data juga bisa berisi gabungan local dan import; sistem memisahkan berdasarkan mapping factory/manufacturer.
5. Sistem menyimpan import history dan raw rows.
6. Sistem menjalankan auto-processing untuk mengisi monthly summaries, defect/non-defect entries, repair action entries, F-COST summaries, item breakdown, dan part category breakdown.
7. User membuka halaman review untuk mengecek hasil agregasi.
8. Sistem menjalankan validation engine dan menampilkan status OK/CHECK beserta alasan dan link ke data.
9. User membuka report preview.
10. User export Excel atau memakai browser Print to PDF.
11. User dapat backup SQLite database.

---

## 8 · Import Safety, Re-Import, dan Raw Review Flow

Import Center harus menampilkan status data per month/product/scope agar operator tahu bulan terakhir yang sudah memiliki data. Minimal status yang harus terlihat:

- Last imported sales month.
- Last imported raw service month.
- Row count, warning count, dan anomaly/check count per import type.
- Apakah report month/scope sudah pernah diexport.
- Apakah raw service memiliki manual review/override.

Informasi status bulan adalah warning gate awal, bukan satu-satunya mekanisme anti-duplikasi. Semua upload tetap masuk staging/preview sebelum commit jika data untuk month/scope yang sama sudah ada.

Sales re-import target:

- Sales CSV wajib memiliki `Sales Month` format `YYYY-MM`.
- Sistem menolak atau memberi critical validation jika mayoritas `Sales Month` tidak cocok dengan report month yang dipilih.
- Untuk same report month + product + scope + import type, sales memakai replace mode agar import ulang file koreksi tidak double count.
- `Model` disimpan sebagai source/original model; `Report Model` dipakai untuk grouping/agregasi.

Raw service re-import target:

- Raw service tidak memakai replace penuh sebagai perilaku operasional utama.
- Raw service import harus staging compare terhadap existing data, lalu upsert per notification + line.
- `notification` adalah case key unik untuk satu kasus, tetapi satu notification bisa memiliki banyak line.
- Line key target memakai kombinasi stabil seperti `notification + job_sheet_section + part_code + line_no_dalam_notification`; jika nanti ada kolom line identifier yang lebih stabil, gunakan kolom tersebut menggantikan line number.
- Perubahan jumlah line pada notification yang sudah ada harus menjadi CHECK/CONFLICT karena original data secara normal tidak berubah 100%.
- Import ulang harus membedakan `NEW_NOTIFICATION`, `DUPLICATE_UNCHANGED`, `SOURCE_CHANGED`, `LINE_COUNT_CHANGED`, `HAS_MANUAL_OVERRIDE`, dan `OVERRIDE_CONFLICT`.
- Default action: new rows insert, unchanged rows skip, changed source rows update source jika tidak conflict, manual override tetap menang jika ada.

Raw service manual review target:

- Manual edit berlaku di level line, bukan seluruh notification.
- Kolom manual yang boleh dioverride awalnya hanya `symptom` dan `action`.
- `defect_category` dan `defect` tidak diedit manual langsung; keduanya dihitung ulang dari effective action memakai master action.
- Effective data untuk report: override value jika ada, selain itu source value dari import terakhir.
- Master action minimal berisi `Action`, `Category`, dan `Defect`, seperti referensi `.doc/dummy master action.csv`.
- Contoh: jika line dioverride menjadi `VERIFIED_OK`, master action menentukan `Category = N/A` dan `Defect = N/A`, sehingga line tersebut tidak dihitung sebagai defect claim FQMS.

Export snapshot target:

- Current/effective raw data boleh berubah setelah sebuah report diexport.
- Export yang sudah final harus tersimpan sebagai snapshot/report output history agar angka report lama tidak berubah diam-diam.
- Revisi raw April setelah export April boleh mempengaruhi akumulasi report bulan berikutnya, tetapi tidak mengubah snapshot export April.

## 19 · MVP Slice 0 — Accuracy Slice

Sebelum membangun seluruh MVP, project harus melewati satu vertical slice kecil untuk membuktikan akurasi data dan kelayakan workflow end-to-end.

Scope Slice 0:

- Report month: April 2026 (`202604`).
- Product: LCD.
- Manufacturer/report scope: LOCAL.
- Input: sales CSV dan raw service CSV.
- Output: FQMS ringkas, F-COST ringkas, report preview, dan Excel export memakai template LOCAL.
- UI awal hanya Month/Scope, Import Center, Review Anomalies, Validation Summary, dan Report Preview/Export.
- Master data awal memakai seed + edit minimal dari Review Anomalies, bukan full CRUD.
- Re-import sales untuk month + product + scope + import type yang sama memakai automatic replace.
- Raw service Phase 3 replace mode adalah baseline sementara untuk membuktikan parser/aggregation; target operasionalnya adalah staging compare + upsert per notification/line dengan manual override protection sebelum workflow raw review dipakai nyata.
- FQMS claim quantity dihitung dari raw service `job_sheet_section = 1`.
- F-COST dihitung dari semua cost rows valid.
- Cost disimpan dalam rupiah asli; scaling hanya untuk tampilan/export.
- Count/quantity harus exact terhadap referensi April 2026; cost boleh berbeda hanya karena pembulatan presentasi.
- Sales CSV Slice 0 wajib memiliki kolom `Report Model` dan `Sales Month`; model consolidation seperti `2T-C32HD1400I` ke `2T-C32HD1500I` dikontrol dari `Report Model`, bukan hardcode di parser.
- Critical validation issue memblokir export; warning/CHECK tidak memblokir export.
- Portable Node bundle smoke test dilakukan lebih awal setelah app shell + SQLite minimal berjalan.

Slice 0 dianggap lulus jika angka FQMS/F-COST April 2026 LCD LOCAL terbukti akurat, preview dan Excel berasal dari view model yang sama, re-import tidak menyebabkan double count, dan app bisa menjalankan smoke flow dari paket portable awal.

Temuan Phase 4 terbaru untuk FQMS April 2026 LCD LOCAL:

- FQMS accumulated proof tidak bisa diselesaikan hanya dari satu bulan raw service dan satu bulan sales. Section C membutuhkan akumulasi per model dari launching month sampai report month.
- Untuk April 2026 LCD LOCAL, claim akumulasi per model berasal dari 14 workbook monitoring aktif, sedangkan sales akumulasi per model berasal dari CSV trusted `sales akumulasi into april 2026.csv`.
- Proof repeatable dibuat sebagai `scripts/proof-fqms-april.mjs`; output reference-nya adalah `storage/proofs/fqms-accumulated-lcd-local-2026-04.csv` dan bisa digenerate ulang.
- Hasil proof accumulated April 2026 LCD LOCAL: accumulated sales `821,326`; defect `4,061`; non-defect `1,025`; total claim `5,086`; exposure `11,931,633`; defect PPM `340.355759`; non-defect PPM `85.906095`; total PPM `426.261854`.
- Total FQMS AVG PPM wajib dihitung dari total exposure semua model, bukan average sederhana PPM per model.

## 20 · Scope MVP

Masuk MVP lengkap setelah Slice 0:

- Import sales CSV.
- Import raw service CSV.
- Auto aggregation FQMS dan F-COST.
- SQLite local database.
- Master model, factory mapping, grouping rules, categories, targets.
- Review pages untuk hasil agregasi.
- Validation engine.
- FQMS report preview Section A/B/C/D.
- F-COST report preview Summary/A/B/C.
- Excel export minimal untuk template utama.
- Browser Print to PDF.
- Backup/restore.
- Portable package.

Tidak masuk MVP awal:

- Multi-user auth/approval.
- Cloud sync.
- Automated email sending.
- AI insight.
- Full migration semua workbook historis.
- Quality Issue and Follow Up detail.
- Replacing Power Query untuk seluruh proses non-FQMS/F-COST.

---

## 21 · Acceptance Criteria

MVP dianggap selesai jika user dapat menyelesaikan satu siklus bulanan penuh tanpa menjadikan Excel sebagai pusat kerja:

1. Membuat report month baru.
2. Mengatur product/manufacturer/report scope.
3. Mengimpor sales CSV gabungan local/import.
4. Mengimpor raw service CSV gabungan local/import.
5. Sistem memisahkan data berdasarkan factory mapping.
6. Sistem menghitung monthly summary, defect/non-defect, repair action, dan F-COST otomatis.
7. User dapat review dan override anomali.
8. Validation utama menghasilkan status OK atau CHECK yang jelas.
9. FQMS preview menampilkan Section A/B/C/D dengan formula benar.
10. F-COST preview menampilkan Summary/A/B/C dengan formula benar.
11. User dapat export Excel.
12. User dapat Print to PDF dari browser.
13. User dapat backup SQLite database.
14. Aplikasi dapat dijalankan di PC Windows tanpa install Node.js/database/browser tambahan.

---

## 22 · Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Kolom CSV berubah | Header validation, optional raw JSON, error message jelas |
| File CSV besar membuat UI hang | Parsing di backend service, gunakan streaming parser |
| Data double-count karena re-import | Sales replace per month/scope/import type; raw service staging compare + upsert per notification/line |
| Manual raw review tertimpa import ulang | Simpan override line-level untuk `symptom`/`action`; effective report value memakai override sebelum source import |
| Jumlah line raw service berubah pada notification existing | Tandai CHECK/CONFLICT dan arahkan ke Review Anomalies, jangan auto-commit diam-diam |
| Local/import tercampur | Factory mapping eksplisit dan validation unmapped factory |
| Mapping defect/non-defect tertukar | Definisikan `defect_category` sebagai status dan `defect` sebagai category detail |
| `job_sheet_section` membuat qty/cost salah | Lock rule melalui parser proof-of-accuracy sebelum UI final |
| Sales negatif/koreksi membuat PPM aneh | Terima data, tetapi tampilkan CHECK/outlier |
| Target fiscal half missing | Validation target presence |
| LY F-COST missing | Status `LY data missing`, bukan manual input palsu |
| Browser print berantakan | CSS print khusus, test Chrome/Edge, avoid Playwright |
| SQLite hilang | Backup/restore wajib sejak MVP |
| Portable packaging gagal | Portable Node bundle smoke test dikerjakan dini setelah app shell + SQLite minimal berjalan, lalu diuji lagi saat slice end-to-end selesai |

---

## 23 · Glossary

| Istilah | Definisi |
|---|---|
| QRCC | Quality Reliability Control Center |
| FQMS | Field Quality Management System |
| F-COST | Failure Cost |
| PPM | Parts Per Million, `qty / denominator × 1.000.000` |
| Report Month | Bulan laporan aktif format `YYYYMM` |
| Fiscal Half | FH April–September, LH Oktober–Maret |
| LOCAL/IMPORT | Manufacturer/report scope yang harus dipisah |
| Raw Service CSV | CSV service/repair/claim dari sistem |
| Sales CSV | CSV sales amount dan sales qty per model |
| Sales Month | Kolom periode sales format `YYYY-MM` yang wajib cocok dengan report month |
| Defect Status | Status besar dari raw `defect_category`: DEFECT/NON_DEFECT/N/A |
| Defect Code | Kategori detail dari raw `defect`: PANEL/MAIN_UNIT/USER/etc |
| Master Action | Reference mapping `Action -> Category + Defect` untuk menentukan effective defect classification |
| Long-format | Data disimpan baris per bulan/model/category |
| Wide-format | Data disusun kolom per bulan untuk report |
| View Model | Struktur data siap render report/export |
| Override | Koreksi manual terhadap hasil import/agregasi; untuk raw service awalnya line-level pada `symptom` dan `action` |
| Export Snapshot | Salinan hasil report saat export agar report final lama tidak berubah saat current data direvisi |

---

## 24 · Keputusan Final yang Harus Diikuti

1. Project baru dibangun sebagai Nuxt 4 full-stack monolith dengan TypeScript strict.
2. Database utama adalah SQLite lokal dengan Drizzle.
3. Import sales CSV dan raw service CSV adalah workflow utama.
4. Sales local/import dan raw data local/import boleh digabung dalam satu file; pemisahan dilakukan oleh factory mapping.
5. Halaman entry adalah review/edit hasil agregasi, bukan input manual utama.
6. FQMS target monthly PPM adalah satu nilai global per product + manufacturer + fiscal half.
7. F-COST target adalah satu nilai global per product + manufacturer + fiscal half.
8. FQMS accumulated PPM memakai denominator `accumulated_sales × launching_period`.
9. Total FQMS AVG PPM memakai total exposure, bukan average PPM antar model.
10. F-COST `Achievement` diganti menjadi `Cost vs Target`.
11. LY F-Cost dihitung dari bulan yang sama satu tahun sebelumnya, bukan input manual.
12. PDF memakai browser print, bukan Playwright.
13. Angka parser April 2026 harus dibuktikan akurat sebelum UI/report final dianggap selesai.
14. Phase 4 FQMS accumulated proof April 2026 LCD LOCAL memakai claim akumulasi dari workbook monitoring, sales akumulasi dari trusted CSV, dan denominator `accumulated_sales × launching_period`.
15. Sales aggregation memakai `Report Model` sebagai model laporan; `Model` tetap disimpan sebagai source model untuk traceability.
16. Sales CSV wajib memiliki `Sales Month` agar sistem bisa membuktikan periode data sales dan mencegah upload bulan yang salah.
17. Raw service target operasional memakai staging compare + upsert per notification/line, bukan replace penuh sebagai default.
18. Manual raw service review berlaku per line untuk `symptom` dan `action`; override tidak boleh tertimpa import ulang.
19. `defect_category` dan `defect` raw service dihitung dari effective action memakai master action, bukan diedit manual langsung.
20. Import Center harus menampilkan status bulan terakhir dan kelengkapan data per month/product/scope/import type.
