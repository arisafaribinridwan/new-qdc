# PRD — QRCC Data Center FQMS/F-COST Automated Monthly Workflow

> **Versi**: 3.1 · **Terakhir diperbarui**: 2026-05-17
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
| Packaging | Bun compile / Node SEA / portable Node bundle | Target akhir zip portable berisi exe/bat, data, dan templates |

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

## 20 · Scope MVP

Masuk MVP:

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
| Data double-count karena re-import | Replace mode atau active import version |
| Local/import tercampur | Factory mapping eksplisit dan validation unmapped factory |
| Mapping defect/non-defect tertukar | Definisikan `defect_category` sebagai status dan `defect` sebagai category detail |
| `job_sheet_section` membuat qty/cost salah | Lock rule melalui parser proof-of-accuracy sebelum UI final |
| Sales negatif/koreksi membuat PPM aneh | Terima data, tetapi tampilkan CHECK/outlier |
| Target fiscal half missing | Validation target presence |
| LY F-COST missing | Status `LY data missing`, bukan manual input palsu |
| Browser print berantakan | CSS print khusus, test Chrome/Edge, avoid Playwright |
| SQLite hilang | Backup/restore wajib sejak MVP |
| Portable packaging gagal | Packaging dikerjakan setelah core stabil dan diuji di Windows bersih |

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
| Defect Status | Status besar dari raw `defect_category`: DEFECT/NON_DEFECT/N/A |
| Defect Code | Kategori detail dari raw `defect`: PANEL/MAIN_UNIT/USER/etc |
| Long-format | Data disimpan baris per bulan/model/category |
| Wide-format | Data disusun kolom per bulan untuk report |
| View Model | Struktur data siap render report/export |
| Override | Koreksi manual terhadap hasil import/agregasi |

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
