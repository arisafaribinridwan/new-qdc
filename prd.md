# PRD — QRCC Data Center FQMS/F-COST Automated Monthly Workflow

> **Versi**: 3.0 · **Terakhir diperbarui**: 2026-05-17
>
> Dokumen ini adalah **sumber kebenaran utama (single source of truth)** untuk membangun ulang aplikasi QRCC Data Center modul FQMS/F-COST dari scratch. Jika ada konflik antara dokumen ini dengan PRD lama, discovery notes, memory proyek, atau implementasi lama, **ikuti dokumen ini**.

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

## 5 · Arsitektur Backend

Backend Nuxt/Nitro wajib memakai pola **API → Service → Repository → Database**.

```text
HTTP Request → API Controller → Service → Repository → SQLite
```

| Layer | Tanggung jawab | Dilarang |
|---|---|---|
| API / Controller (`server/api/**/*.ts`) | Terima request, validasi input, parse multipart upload, format response JSON | Business logic dan query DB langsung |
| Service (`server/services/*.ts`) | Parser CSV, import orchestration, aggregation, calculation, validation, report view model | Import `h3`, menerima `event`, query DB langsung |
| Repository (`server/repositories/*.ts`) | CRUD dan query Drizzle/SQLite | Business logic, PPM calculation, HTTP response |
| Report builder (`server/reports/**`) | Transform DB long-format menjadi view model report/Excel | Menjadi tempat penyimpanan data utama |

Aturan penting: service tidak boleh tahu HTTP. API handler mengambil file/body dari request, memanggil service dengan parameter plain object, lalu mengembalikan response. Repository tidak boleh menghitung PPM, ratio, validation, atau report business rules.

---

## 6 · Struktur Folder Target

```text
qdc/
  app/
    assets/css/
    components/
    composables/
    layouts/
    pages/
    types/
    utils/
  server/
    api/
      import/
      report-months/
      models/
      references/
      validation/
      reports/
      settings/
    db/
      client.ts
      schema.ts
      migrations/
      seed.ts
    repositories/
    services/
    reports/
      view-models/
      excel/
      print/
  shared/
    constants/
    types/
    validators/
  templates/
    excel/
    print/
  data/
    sqlite.db
  storage/
    imports/
    exports/
    backups/
```

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

## 8 · Format CSV Input

### 8.1 Sales CSV

Sample sales CSV memiliki header:

```text
Model,Category,Sales Amount,Sales (Qty),Factory
```

Contoh row:

```text
2TC32GH3000I,LCD SEID,31167314087,12892,SKW
```

Mapping field:

| CSV field | Makna | Target data |
|---|---|---|
| `Model` | Model produk | `model_name` / master model |
| `Category` | Product/category report, contoh `LCD SEID` | product/report category mapping |
| `Sales Amount` | Nilai sales bulanan | `monthly_fcost_summaries.sales_amount` dan sales audit |
| `Sales (Qty)` | Qty sales bulanan | `monthly_model_summaries.sales_qty` dan `monthly_fcost_summaries.sales_qty` |
| `Factory` | Factory/vendor asal | Mapping ke manufacturer/report scope |

Sales CSV adalah input resmi, bukan input manual. Jika sales local dan import digabung dalam satu CSV, sistem harus memproses semua row dan memisahkannya dengan rule mapping factory/manufacturer.

### 8.2 Raw Service CSV

Sample raw service CSV memiliki header:

```text
notification,job_sheet_section,malfunction_start_date,basic_finish_date,model_name,category,serial_number,symptom_code,symptom_code_description,pmacttype,pmacttype_description,symptom_comment,repair_comment,description,warranty,planner_group,branch,purchased_date,labor_cost,transportation_cost,parts_cost,part_used,section,prod_lot,prod_date,inch,total_cost,diff_month,part_name,panel_usage,factory,model_series,symptom,action,defect_category,defect,keydate
```

Kolom wajib untuk pemrosesan awal:

| CSV field | Makna | Catatan |
|---|---|---|
| `notification` | Nomor job sheet/claim | Dipakai untuk trace dan potensi dedup |
| `job_sheet_section` | Section row | Perlu rule apakah qty memakai section `1` saja |
| `basic_finish_date` | Tanggal selesai | Cross-check bulan report |
| `model_name` | Model asli | Mapping ke master model/grouping |
| `category` | Product/category report | Contoh `LCD SEID` |
| `labor_cost` | Biaya labor | F-COST item Labor |
| `transportation_cost` | Biaya trip/transport | F-COST item Trip |
| `parts_cost` | Biaya part | F-COST item Part |
| `total_cost` | Total F-COST row | Cross-check item sum |
| `part_name` | Nama/kategori part | Mapping kategori part jika tersedia |
| `factory` | Factory/vendor asal | Mapping ke manufacturer/report scope |
| `model_series` | Seri model | Audit/report helper |
| `action` | Tindakan repair | Repair action entries |
| `defect_category` | Status besar: `DEFECT`, `NON_DEFECT`, `N/A`, kosong | Jangan disamakan dengan kategori detail |
| `defect` | Kategori detail: `PANEL`, `MAIN_UNIT`, `POWER_UNIT`, `USER`, dll | Mapping defect/non-defect category |
| `keydate` | Bulan data format `YYYYMM` | Wajib cocok dengan report month mayoritas/semua row |

Catatan penting: di raw CSV, nama `defect_category` terlihat sebagai status besar (`DEFECT`/`NON_DEFECT`/`N/A`), sedangkan `defect` berisi kategori detail seperti `MAIN_UNIT`, `PANEL`, `POWER_UNIT`, `SOFTWARE`, `USER`, `SETTING`, dan `EXPLANATION`. Implementasi harus memakai definisi ini agar angka report tidak tertukar.

---

## 9 · Import Rules

### 9.1 Import history

Setiap upload dicatat di `data_imports`. Import harus bisa ditelusuri berdasarkan bulan, tipe import, file name, row count, timestamp, dan status.

### 9.2 Duplicate handling

Sistem harus mencegah duplikasi import yang membuat angka double-count. Minimal lakukan salah satu dari dua strategi:

1. Replace mode: import baru untuk kombinasi report month + import type + product/manufacturer mengganti hasil import sebelumnya.
2. Versioned mode: semua import disimpan, tetapi hanya import aktif terakhir yang dipakai untuk summary.

MVP direkomendasikan memakai replace mode karena lebih mudah dipahami operator.

### 9.3 Header validation

Parser harus mengecek kolom wajib. Kolom tambahan boleh diabaikan atau disimpan di JSON raw payload. Jika kolom wajib hilang, import ditolak dengan pesan jelas.

### 9.4 Month validation

Untuk raw service CSV, `keydate` harus sesuai report month. Jika mayoritas row berbeda dari report month, tolak import. Jika ada sedikit row outlier, tampilkan CHECK dan daftar sample row.

Untuk sales CSV, jika file tidak memiliki kolom bulan, bulan mengikuti report month yang dipilih user. Jika nanti sales CSV memiliki kolom bulan, sistem harus memvalidasi kesesuaian bulan.

### 9.5 Factory/manufacturer mapping

Karena file sales dan raw service dapat berisi gabungan local/import, mapping factory ke report manufacturer harus eksplisit di tabel reference. Contoh factory pada sample: `SEID`, `SKW`, `MOKA`, `MTC`. Aplikasi tidak boleh mengasumsikan mapping permanen di kode.

### 9.6 Job sheet section rule

Raw service data dapat memiliki beberapa row untuk satu notification, misalnya row utama `job_sheet_section = 1` dan row tambahan `job_sheet_section = 0`. Untuk qty defect/non-defect dan repair action, MVP harus memakai rule eksplisit. Rekomendasi awal:

```text
claim_qty_rows = row dengan job_sheet_section = 1
cost_rows = semua row yang memiliki cost, tetapi cross-check terhadap total_cost section utama
```

Rule final harus diverifikasi terhadap Excel manual. Jika data historis menunjukkan section `0` berisi part tambahan yang perlu dihitung cost, F-COST item breakdown dapat memakai semua row cost, sementara claim qty tetap memakai section `1` atau notification unik.

---

## 10 · Data Model

### 10.1 report_months

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| month_key | text UNIQUE | `YYYYMM`, contoh `202604` |
| month_label | text | `Apr 2026` / `Apr-26` |
| period_start | text | ISO date |
| period_end | text | ISO date |
| fiscal_year | text | Contoh `2026` |
| fiscal_half | text | `FH` atau `LH` |
| status | text | `draft`, `imported`, `validated`, `exported`, `archived` |
| created_at | text | ISO timestamp |
| updated_at | text | ISO timestamp |

### 10.2 products

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| code | text UNIQUE | Contoh `LCD` |
| name | text | Nama produk |
| active | integer | `1`/`0` |

### 10.3 manufacturers

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| code | text UNIQUE | `LOCAL`, `IMPORT` |
| name | text | Label report |
| active | integer | `1`/`0` |

### 10.4 factory_mappings

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| factory_code | text | Contoh `SEID`, `SKW`, `MOKA`, `MTC` |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| active | integer | `1`/`0` |
| remark | text | Catatan |

### 10.5 models

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| model_name | text | Nama model asli |
| model_series | text nullable | Seri model |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK nullable | Jika model spesifik manufacturer |
| launching_month_key | text nullable | `YYYYMM`, dipakai FQMS accumulated period |
| active_status | text | `Active` / `Inactive` |
| report_include | integer | `1` masuk monitoring/report |
| effective_from | text nullable | ISO date |
| effective_to | text nullable | ISO date |
| remark | text nullable | Catatan |
| created_at | text | ISO timestamp |
| updated_at | text | ISO timestamp |

### 10.6 model_group_rules

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| source_model | text | Model asli dari CSV |
| report_model | text | Model yang tampil di report |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK nullable | Scope rule |
| rule_type | text | `exact`, `pattern`, atau tipe lain |
| priority | integer | Urutan rule |
| active | integer | `1`/`0` |
| remark | text nullable | Catatan |

Data original tetap disimpan per model asli. Grouping hanya diterapkan saat membangun report view model atau summary khusus report.

### 10.7 defect_categories

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| code | text UNIQUE | Contoh `PANEL`, `MAIN_UNIT` |
| name | text | Label report |
| sort_order | integer | Urutan tampil |
| active | integer | `1`/`0` |

Kategori defect awal: `PANEL`, `MAIN_UNIT`, `POWER_UNIT`, `SOFTWARE`, `OTHER`.

### 10.8 nondefect_categories

Struktur sama dengan `defect_categories`. Kategori non-defect awal: `USER`, `SETTING`, `EXPLANATION`, `SIGNAL`, `OTHER`.

### 10.9 repair_actions

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| code | text UNIQUE | Contoh `REPLACE_PANEL` |
| name | text | Label action |
| active | integer | `1`/`0` |
| sort_order | integer | Urutan tampil |

### 10.10 fiscal_quality_targets

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| fiscal_year | text | Contoh `2026` |
| fiscal_half | text | `FH` atau `LH` |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| target_monthly_ppm | real | Satu nilai global per report/fiscal half |
| effective_from | text | ISO date |
| effective_to | text | ISO date |
| remark | text nullable | Catatan |

### 10.11 fiscal_fcost_targets

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| fiscal_year | text | Contoh `2026` |
| fiscal_half | text | `FH` atau `LH` |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| target_fcost | real | Target F-COST bulanan; berlaku sama untuk bulan dalam fiscal half |
| effective_from | text | ISO date |
| effective_to | text | ISO date |
| remark | text nullable | Catatan |

### 10.12 data_imports

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| import_type | text | `sales` atau `raw_service` |
| file_name | text | Nama file CSV |
| file_hash | text nullable | Untuk duplicate detection |
| total_rows | integer | Jumlah row terbaca |
| accepted_rows | integer | Jumlah row diproses |
| rejected_rows | integer | Jumlah row ditolak |
| status | text | `pending`, `processed`, `failed`, `replaced` |
| imported_at | text | ISO timestamp |
| message | text nullable | Error/summary |

### 10.13 raw_sales_data

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| import_id | integer FK | → data_imports.id |
| report_month_id | integer FK | → report_months.id |
| model_name | text | CSV `Model` |
| category | text | CSV `Category` |
| sales_amount | real | CSV `Sales Amount` |
| sales_qty | integer | CSV `Sales (Qty)` |
| factory | text | CSV `Factory` |
| product_id | integer FK nullable | Hasil mapping |
| manufacturer_id | integer FK nullable | Hasil mapping |
| raw_json | text nullable | Payload row asli |

### 10.14 raw_service_data

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| import_id | integer FK | → data_imports.id |
| report_month_id | integer FK | → report_months.id |
| notification | text | Job sheet |
| job_sheet_section | text | Section row |
| basic_finish_date | text | Tanggal selesai |
| model_name | text | Model asli |
| category | text | Product/category CSV |
| serial_number | text nullable | Serial |
| labor_cost | real | Labor |
| transportation_cost | real | Trip/transport |
| parts_cost | real | Part |
| total_cost | real | Total row |
| part_name | text nullable | Nama/kategori part |
| factory | text | Factory CSV |
| model_series | text nullable | Seri model |
| symptom | text nullable | Symptom normalized |
| action | text nullable | Repair action |
| defect_status | text nullable | Dari CSV `defect_category` |
| defect_code | text nullable | Dari CSV `defect` |
| keydate | text | `YYYYMM` |
| product_id | integer FK nullable | Hasil mapping |
| manufacturer_id | integer FK nullable | Hasil mapping |
| raw_json | text nullable | Payload row asli |

### 10.15 monthly_model_summaries

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| model_id | integer FK | → models.id |
| sales_qty | integer | Dari sales CSV |
| sales_amount | real | Dari sales CSV, jika dibutuhkan audit/F-COST |
| total_defect_qty | integer | Hasil raw service aggregation |
| total_nondefect_qty | integer | Hasil raw service aggregation |
| defect_ppm | real nullable | `total_defect_qty / sales_qty × 1.000.000` untuk monthly check |
| nondefect_ppm | real nullable | `total_nondefect_qty / sales_qty × 1.000.000` |
| source_import_id | integer FK nullable | Import yang menghasilkan summary |
| override_flag | integer | `1` jika diedit manual |
| remark | text nullable | Catatan |
| created_at | text | ISO timestamp |
| updated_at | text | ISO timestamp |

Constraint: `UNIQUE(report_month_id, product_id, manufacturer_id, model_id)`.

### 10.16 defect_category_entries

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| model_id | integer FK | → models.id |
| category_id | integer FK | → defect_categories.id |
| qty | integer | Jumlah bulanan |
| sales_qty_snapshot | integer | Snapshot audit |
| ppm | real nullable | Calculated monthly PPM |
| source_import_id | integer FK nullable | Import source |
| override_flag | integer | `1` jika diedit manual |
| remark | text nullable | Catatan |

Constraint: `UNIQUE(report_month_id, product_id, manufacturer_id, model_id, category_id)`.

### 10.17 nondefect_category_entries

Struktur sama dengan `defect_category_entries`, tetapi FK `category_id` mengarah ke `nondefect_categories`.

### 10.18 repair_action_entries

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| model_id | integer FK | → models.id |
| repair_action | text | Dari raw `action` atau master action |
| qty | integer | Jumlah action |
| total | integer | Total defect/action denominator jika dibutuhkan |
| defect_occup | real nullable | `qty / total_defect_model` |
| defect_ppm | real nullable | Mengikuti denominator FQMS Section D |
| source_import_id | integer FK nullable | Import source |
| remark | text nullable | Catatan |

### 10.19 monthly_fcost_summaries

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| sales_amount | real | Dari sales CSV |
| sales_qty | integer | Dari sales CSV |
| fcost_amount | real | Dari raw service `total_cost` / item sum |
| fcost_qty | integer | Jumlah claim/job F-COST |
| source_import_id | integer FK nullable | Import source |
| override_flag | integer | `1` jika diedit manual |
| remark | text nullable | Catatan |

Constraint: `UNIQUE(report_month_id, product_id, manufacturer_id)`.

### 10.20 monthly_fcost_item_breakdowns

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| item_type | text | `Part`, `Labor`, `Trip` |
| amount | real | Amount bulanan |
| source_import_id | integer FK nullable | Import source |
| remark | text nullable | Catatan |

Constraint: `UNIQUE(report_month_id, product_id, manufacturer_id, item_type)`.

### 10.21 monthly_fcost_part_category_breakdowns

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| part_category | text | `Panel`, `Main Unit`, `Power Unit`, `Other` |
| amount | real | Amount bulanan |
| qty | integer | Qty bulanan |
| source_import_id | integer FK nullable | Import source |
| remark | text nullable | Catatan |

Constraint: `UNIQUE(report_month_id, product_id, manufacturer_id, part_category)`.

### 10.22 fiscal_half_snapshots

Opsional tetapi berguna untuk data pembanding fiscal half historis jika data bulanan lama belum lengkap.

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| fiscal_year | text | Contoh `2025` |
| fiscal_half | text | `FH`/`LH` |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| sales_amount | real nullable | Snapshot |
| fcost_amount | real nullable | Snapshot |
| target_fcost | real nullable | Snapshot |
| sales_qty | integer nullable | Snapshot |
| fcost_qty | integer nullable | Snapshot |
| remark | text nullable | Catatan |

### 10.23 validation_runs

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| status | text | `OK` atau `CHECK` |
| checked_at | text | ISO timestamp |
| summary_json | text | JSON hasil validasi |

### 10.24 export_jobs

| Field | Type | Keterangan |
|---|---|---|
| id | integer PK | Auto-increment |
| report_month_id | integer FK | → report_months.id |
| product_id | integer FK | → products.id |
| manufacturer_id | integer FK | → manufacturers.id |
| report_type | text | `fqms`, `fcost`, `combined` |
| export_type | text | `excel`, `print_pdf` |
| file_name | text | Nama file output |
| file_path | text nullable | Lokasi output jika file dibuat |
| status | text | `pending`, `done`, `error` |
| created_at | text | ISO timestamp |
| message | text nullable | Pesan error |

---

## 11 · Fiscal Calendar

Fiscal calendar memakai Japanese corporate half-year:

| Term | Period | Label |
|---|---|---|
| FH | April – September | Tahun kalender April |
| LH | Oktober – Maret | Tahun kalender Oktober |

Aturan derivasi:

```text
Jika bulan 04–09 → fiscal_half = FH, fiscal_year = tahun kalender bulan itu
Jika bulan 10–12 → fiscal_half = LH, fiscal_year = tahun kalender bulan itu
Jika bulan 01–03 → fiscal_half = LH, fiscal_year = tahun kalender - 1
```

Contoh:

| Report month | Label | Fiscal year | Fiscal half |
|---|---|---|---|
| 2026-04 | Apr 2026 | 2026 | FH |
| 2026-09 | Sep 2026 | 2026 | FH |
| 2026-10 | Oct 2026 | 2026 | LH |
| 2027-03 | Mar 2027 | 2026 | LH |

Target monthly PPM FQMS dan target F-COST di-update pada bulan pertama setiap fiscal half: April untuk FH dan Oktober untuk LH. Target disimpan sebagai plain year + half (`2026` + `FH`), bukan `FY2026`.

---

## 12 · FQMS Report Specification

### 12.1 Referensi report

Report FQMS adalah report monitoring Field Quality untuk product `LCD` dengan manufacturer/report scope `LOCAL` atau `IMPORT`. Report LOCAL dan IMPORT harus dipisah. Product + manufacturer menjadi konteks/filter untuk input, validation, preview, dan export.

Referensi lama: workbook `FQMS - LCD LOCAL.xlsx` dan PDF `FQMS - LCD LOCAL_rev.pdf`. Workbook berisi sheet `FQMS`, print area `A1:S83`, dan chart. PDF lama adalah hasil print/export dari Excel.

### 12.2 FQMS sections

FQMS MVP terdiri dari:

| Section | Nama | Isi |
|---|---|---|
| A | Quality Trend | Chart Target vs Result PPM bulanan |
| B | Acceptance Ratio | OK/NG ratio model per bulan/fiscal snapshot |
| C | Detail Model | Detail cumulative model monitoring |
| D | Worst Defect | Top defect category per model |

`Quality Issue and Follow Up` tidak masuk scope FQMS MVP awal. Bagian tersebut dibahas terpisah sebagai Market Quality Issue.

### 12.3 Target Monthly PPM

Target monthly PPM adalah satu nilai global per product + manufacturer + fiscal half. Contoh target `383` berlaku untuk semua model dalam report tersebut, bukan per model.

Saat generate report, aplikasi memilih target berdasarkan report month dan fiscal half yang berlaku. Target dipakai untuk Section C quality level dan chart target Section A.

### 12.4 Monthly input and accumulation

Data dasar disimpan per bulan. Report Section C menampilkan akumulasi dari launching month model sampai report month.

```text
launching_period = selisih bulan antara report_month dan launching_month
sales = akumulasi sales bulanan dari launching_month sampai report_month
defect_qty = akumulasi defect bulanan dari launching_month sampai report_month
nondefect_qty = akumulasi non-defect bulanan dari launching_month sampai report_month
total_claim = defect_qty + nondefect_qty
```

Formula PPM Section C:

```text
avg_defect_ppm = defect_qty / (sales × launching_period) × 1.000.000
avg_nondefect_ppm = nondefect_qty / (sales × launching_period) × 1.000.000
defect_quality_level = NG jika avg_defect_ppm >= target_monthly_ppm, selain itu OK
```

Jika `sales = 0` atau `launching_period = 0`, jangan tampilkan angka PPM palsu. Tampilkan CHECK.

### 12.5 Section C — Detail Model

Field utama per model:

| Field | Definisi |
|---|---|
| Model | Model report setelah grouping |
| Launching Month | Bulan launching model |
| Launching Period | Selisih bulan launching sampai report month |
| Sales | Akumulasi sales |
| Defect Qty | Akumulasi defect |
| Non Defect Qty | Akumulasi non-defect |
| Total Claim | Defect + Non Defect |
| AVG Defect PPM | Defect rata-rata berbobot exposure |
| AVG Non Defect PPM | Non-defect rata-rata berbobot exposure |
| Target Monthly PPM | Target global fiscal half |
| Defect Quality Level | OK/NG |

Total row Section C:

```text
total_sales = sum(sales semua model aktif)
total_defect = sum(defect_qty semua model aktif)
total_nondefect = sum(nondefect_qty semua model aktif)
total_claim = total_defect + total_nondefect
total_exposure = sum(sales_model × launching_period_model semua model aktif)
total_avg_defect_ppm = total_defect / total_exposure × 1.000.000
total_avg_nondefect_ppm = total_nondefect / total_exposure × 1.000.000
```

Total AVG defect PPM bukan average sederhana antar model. Denominator memakai total exposure `sales × launching_period`.

### 12.6 Section A — Quality Trend

Section A adalah chart bulanan `Target` vs `Result`. Bulan paling kanan adalah report month aktif.

```text
month = bulan pada periode trend
result_ppm = total_avg_defect_ppm seluruh model aktif pada bulan tersebut
target_ppm = target monthly PPM fiscal half yang berlaku pada bulan tersebut
```

Result dihitung dengan formula Section C untuk snapshot bulan tersebut.

### 12.7 Section B — Acceptance Ratio

Section B memakai periode bulan dinamis seperti Section A. Nilai OK dan NG dihitung dari snapshot model aktif/monitoring pada bulan tersebut.

```text
total_model = jumlah model aktif/monitoring pada bulan tersebut
ok_models = jumlah model dengan quality_level OK
ng_models = jumlah model dengan quality_level NG
acceptance_ratio = ok_models / total_model
```

Label fiscal half seperti `2025FH` mengambil nilai dari data bulan terakhir di fiscal half tersebut, contoh `2025FH` memakai snapshot September 2025.

### 12.8 Section D — Worst Defect

Section D memakai data defect bulanan per model × defect category. Untuk report month tertentu, aplikasi menampilkan top defect category untuk masing-masing model aktif yang tampil di Section C.

Kolom bulan dibatasi 4 bucket:

```text
bucket_older = total semua bulan sebelum 3 bulan terakhir
month_minus_2
month_minus_1
report_month
```

Contoh report month `Mar-26`:

```text
~Dec'25 = total semua bulan sebelum Jan-26
Jan'26
Feb'26
Mar'26
```

Formula:

```text
total = bucket_older + month_minus_2 + month_minus_1 + report_month
defect_occup = total_defect_category / total_defect_model
defect_ppm = total_defect_category / (accumulated_sales_model × launching_period_model) × 1.000.000
```

`defect_ppm` Section D harus memakai denominator `accumulated_sales_model × launching_period_model` agar konsisten dengan Section C.

---

## 13 · F-COST Report Specification

### 13.1 Referensi report

Report F-COST adalah report monitoring Failure Cost untuk product `LCD` dan manufacturer/report scope `LOCAL` atau `IMPORT`. Product + manufacturer menjadi konteks/filter report.

Referensi lama: workbook `FCOST - LCD LOCAL.xlsx` dan PDF `FCOST - LCD LOCAL_rev.pdf`. Workbook berisi sheet `F-Cost`, print area `A1:R39`, dan chart. PDF lama adalah hasil print/export dari Excel.

### 13.2 F-COST sections

F-COST MVP terdiri dari:

| Section | Nama | Isi |
|---|---|---|
| Summary cards | Fiscal half/current month summary | Total sales, total F-COST, report month F-COST, cost vs target |
| A | Monthly F-Cost | Previous fiscal half, monthly current half, total current half |
| B | F-Cost Trend | Chart F-Cost vs Target current fiscal half |
| C | Detail F-Cost & Part Contribution | Breakdown Part/Labor/Trip dan part category |

### 13.3 Amount unit

Template lama memakai satuan `Amount < Rp. K>`. Sistem harus konsisten menyimpan dan menampilkan amount sesuai satuan yang disepakati. Jika CSV berisi rupiah penuh, service harus mengkonversi ke Rp K sebelum report, atau menyimpan rupiah penuh dan view model melakukan scaling. Keputusan implementasi harus konsisten dan terdokumentasi di constant.

### 13.4 Reporting period

F-COST menampilkan tiga tipe periode sekaligus:

1. Kolom agregat previous fiscal half, contoh `2025FH`.
2. Kolom bulanan current fiscal half, contoh `Oct-25` sampai `Mar-26`.
3. Kolom total current fiscal half, contoh `2025LH`.

Untuk report month di tengah fiscal half, current fiscal half berjalan dari awal half sampai report month. Contoh report `Apr-26` current half baru berisi April 2026; report `Sep-26` berisi April–September 2026.

### 13.5 Summary cards

```text
total_sales_current_half = sum(sales_amount bulanan current half)
total_fcost_current_half = sum(fcost_amount bulanan current half)
fcost_report_month = fcost_amount pada report_month
cost_vs_target_report_month = fcost_amount report_month / target_fcost report_month
```

Istilah lama `Achievement` diganti menjadi `Cost vs Target` karena metrik ini membandingkan realisasi biaya terhadap target biaya. Untuk F-COST, angka lebih rendah dari 100% berarti biaya aktual berada di bawah target.

### 13.6 Section A — Monthly F-Cost

Field utama per periode:

| Field | Formula/Definisi |
|---|---|
| Sales Amount | Dari sales CSV |
| F-Cost Amount | Dari raw service cost |
| Target F-Cost | Target fiscal half |
| Ratio vs Sales | `fcost_amount / sales_amount` |
| Cost vs Target | `fcost_amount / target_fcost` |
| Sales Qty | Dari sales CSV |
| F-Cost Qty | Jumlah claim/job F-COST |
| Ratio % | `fcost_qty / sales_qty` |
| LY F-Cost | F-COST bulan yang sama satu tahun sebelumnya |
| Ratio vs LY F-Cost | `fcost_amount / ly_fcost` |

Total current fiscal half:

```text
total_sales_amount = sum(sales_amount bulanan current half)
total_fcost_amount = sum(fcost_amount bulanan current half)
total_target_fcost = sum(target_fcost bulanan current half)
total_sales_qty = sum(sales_qty bulanan current half)
total_fcost_qty = sum(fcost_qty bulanan current half)
total_ly_fcost = sum(ly_fcost bulan pasangan tahun sebelumnya)
total_ratio_vs_sales = total_fcost_amount / total_sales_amount
total_cost_vs_target = total_fcost_amount / total_target_fcost
total_fcost_qty_ratio = total_fcost_qty / total_sales_qty
total_ratio_vs_ly_fcost = total_fcost_amount / total_ly_fcost
```

Previous fiscal half dihitung dari data bulanan fiscal half sebelumnya jika tersedia. Jika data bulanan historis belum lengkap, boleh memakai `fiscal_half_snapshots` sebagai pembanding awal.

LY F-Cost bukan input manual. Sistem mengambil F-COST dari bulan yang sama satu tahun sebelumnya. Jika tidak tersedia, tampilkan CHECK atau kosong dengan status `LY data missing`.

### 13.7 Section B — F-Cost Trend

Section B adalah chart current fiscal half. Series yang tampil:

```text
month
fcost_amount = fcost_amount bulanan
target_fcost = target_fcost bulanan
```

Chart tidak memakai kolom agregat previous fiscal half dan tidak memakai total current fiscal half sebagai data point.

### 13.8 Section C — Detail F-Cost & Part Contribution

Breakdown dicatat per bulan dan report menjumlahkan breakdown dari awal fiscal half sampai report month.

Item utama:

```text
items = Part, Labor, Trip
item_ratio = item_amount / total_fcost_current_half
total_fcost_current_half = sum(Part + Labor + Trip)
```

Mapping awal dari raw service CSV:

| Item | Source field |
|---|---|
| Part | `parts_cost` |
| Labor | `labor_cost` |
| Trip | `transportation_cost` |

Part category contribution:

```text
part_category_amount
part_category_qty
part_category_ratio = part_category_amount / total_part_amount
```

Kategori part awal:

| Category | Mapping awal |
|---|---|
| Panel | `part_name = PANEL` atau defect/action panel |
| Main Unit | `part_name = MAIN_UNIT` atau action/main unit |
| Power Unit | `part_name = POWER_UNIT` atau action/power unit |
| Other | Selain kategori utama |

Rasio kategori part tidak disimpan sebagai input manual. Rasio selalu dihitung dari amount agar total aktual kembali ke 100%.

---

## 14 · Aggregation Rules

### 14.1 Sales aggregation

Dari `raw_sales_data`, agregasi per report month + product + manufacturer + model:

```text
monthly_model_summaries.sales_qty = sum(Sales (Qty))
monthly_model_summaries.sales_amount = sum(Sales Amount)
monthly_fcost_summaries.sales_qty = sum(Sales (Qty)) seluruh model dalam product/manufacturer
monthly_fcost_summaries.sales_amount = sum(Sales Amount) seluruh model dalam product/manufacturer
```

Sales qty dapat bernilai negatif pada data koreksi. Sistem boleh menerima nilai negatif, tetapi validation harus menandai CHECK jika total sales per model atau total sales report menjadi negatif/tidak wajar.

### 14.2 Defect/non-defect aggregation

Dari `raw_service_data`, agregasi awal memakai row claim utama sesuai rule `job_sheet_section`.

```text
Jika defect_status = DEFECT → masuk defect_category_entries
Jika defect_status = NON_DEFECT → masuk nondefect_category_entries
Jika defect_status = N/A atau kosong → tidak dihitung sebagai defect/non-defect category, tetapi tetap disimpan raw dan dapat masuk cost/action sesuai rule F-COST
```

Mapping kategori detail:

```text
defect_code PANEL/MAIN_UNIT/POWER_UNIT/SOFTWARE/OTHER → defect_categories
defect_code USER/SETTING/EXPLANATION/SIGNAL/OTHER → nondefect_categories
```

Jika `defect_status` dan `defect_code` tidak konsisten, import tetap disimpan tetapi validation menandai CHECK.

### 14.3 Repair action aggregation

Repair action entries dihitung dari raw `action` per model. Untuk action kosong, sistem boleh mapping ke `UNKNOWN` atau mengabaikan dari report action tergantung kebutuhan report. UNKNOWN harus ditampilkan di validation sebagai data yang perlu distandarkan.

### 14.4 F-COST aggregation

F-COST amount dihitung dari raw service cost sesuai product/manufacturer/report month.

```text
part_amount = sum(parts_cost)
labor_amount = sum(labor_cost)
trip_amount = sum(transportation_cost)
fcost_amount = part_amount + labor_amount + trip_amount
```

`total_cost` dipakai sebagai cross-check. Jika `sum(total_cost)` berbeda signifikan dari `sum(parts_cost + labor_cost + transportation_cost)`, validation menandai CHECK.

`fcost_qty` dihitung sebagai jumlah claim/job yang memiliki F-COST relevan. Rule awal: jumlah row utama `job_sheet_section = 1` yang masuk scope product/manufacturer/report month. Jika manual Excel memakai notification unik, service harus disesuaikan setelah validasi angka.

---

## 15 · Validation Rules

Semua validasi menghasilkan status `OK` atau `CHECK`, alasan, severity, dan link ke halaman review terkait.

| # | Rule | Deskripsi |
|---|---|---|
| V1 | Import presence | Sales CSV dan raw service CSV untuk report month/scope harus tersedia |
| V2 | Header validation | Semua kolom wajib CSV tersedia |
| V3 | Report month consistency | Raw `keydate` harus sesuai report month |
| V4 | Factory mapping completeness | Semua factory di CSV harus punya mapping aktif |
| V5 | Model mapping completeness | Semua model yang masuk report harus ada di master model atau dibuat otomatis dengan status review |
| V6 | Active model completeness | Semua model active + report_include harus punya monthly summary |
| V7 | Duplicate summary | Tidak boleh ada duplikasi kombinasi report_month + product + manufacturer + model |
| V8 | Sales qty presence | Model dengan claim qty > 0 harus punya sales_qty > 0 |
| V9 | Monthly PPM denominator | Jika sales_qty = 0, PPM harus CHECK, bukan angka |
| V10 | Defect total match | Σ defect entries = monthly summary total_defect_qty |
| V11 | Non-defect total match | Σ nondefect entries = monthly summary total_nondefect_qty |
| V12 | Category standardization | Semua defect/non-defect/action harus memakai reference atau flagged UNKNOWN |
| V13 | Target PPM presence | Target monthly PPM fiscal half harus tersedia |
| V14 | F-COST completeness | F-COST summary bulan terpilih harus tersedia |
| V15 | F-COST target presence | Target F-COST fiscal half berjalan harus tersedia |
| V16 | F-COST item breakdown match | Part + Labor + Trip harus sama dengan total F-COST current half |
| V17 | F-COST part category match | Σ part category amount harus sama dengan total Part amount |
| V18 | F-COST total cost cross-check | `total_cost` raw harus selaras dengan item costs sesuai toleransi |
| V19 | LY F-Cost presence | Data F-COST bulan yang sama satu tahun sebelumnya harus tersedia untuk ratio vs LY |
| V20 | Previous fiscal half data | Previous fiscal half data harus tersedia dari monthly data atau snapshot |
| V21 | Negative/outlier data | Sales/cost/qty negatif atau ekstrem harus ditandai CHECK untuk review |
| V22 | Print readiness | Report preview tidak boleh punya missing critical section sebelum export |

Jika denominator rasio bernilai 0 atau missing, tampilkan CHECK/kosong, bukan `Infinity`, `NaN`, atau angka menyesatkan.

---

## 16 · UI Page Map

| Route | Fungsi |
|---|---|
| `/` | Dashboard: active month, import status, validation status, next action |
| `/report-months` | Kelola bulan laporan dan fiscal metadata |
| `/models` | Master model, launching month, active/report include |
| `/references/factories` | Mapping factory ke product/manufacturer |
| `/references/defect-categories` | Reference defect categories |
| `/references/nondefect-categories` | Reference non-defect categories |
| `/references/repair-actions` | Reference repair action |
| `/references/grouping-rules` | Model grouping rules |
| `/targets/fqms` | Target monthly PPM per fiscal half |
| `/targets/fcost` | Target F-COST per fiscal half |
| `/import` | Import center untuk sales CSV dan raw service CSV |
| `/import/sales` | Detail import sales CSV, preview rows, errors |
| `/import/raw-service` | Detail import raw service CSV, preview rows, errors |
| `/entry/sales` | Review sales hasil import |
| `/entry/summary` | Review monthly model summary hasil agregasi |
| `/entry/defect` | Review defect category entries |
| `/entry/nondefect` | Review non-defect category entries |
| `/entry/repair-action` | Review repair action entries |
| `/entry/fcost` | Review F-COST summary dan breakdown |
| `/validation` | Status validasi OK/CHECK + link perbaikan |
| `/reports/preview` | Preview report print-friendly |
| `/reports/export` | Export Excel dan instruksi Print to PDF/history |
| `/settings/backup` | Backup/restore SQLite database |

Dashboard harus menjawab tiga hal: bulan apa yang aktif, data apa yang belum lengkap/salah, dan langkah berikutnya apa.

---

## 17 · Report Preview dan Export

### 17.1 Preview

Report preview harus memakai data dari report view model, bukan langsung query acak dari UI. Preview harus menjadi sumber yang sama untuk print PDF.

### 17.2 Browser Print to PDF

Gunakan CSS print:

```css
@media print {
  @page {
    size: A4 landscape;
    margin: 0;
  }

  .no-print {
    display: none !important;
  }

  table, tr, .report-card {
    break-inside: avoid;
  }
}
```

Orientasi bisa berbeda per template jika referensi lama portrait. Keputusan final per report:

| Report | Default print |
|---|---|
| FQMS | Sesuaikan template final; referensi lama portrait |
| F-COST | Sesuaikan template final; referensi lama portrait |
| Combined presentation | Boleh landscape jika layout meeting membutuhkan |

### 17.3 Excel export

Excel export memakai ExcelJS dan template workbook. Template tidak menjadi database. Data diisi dari report view model.

Nama file rekomendasi:

```text
QRCC FQMS - LCD LOCAL Apr 2026.xlsx
QRCC F-COST - LCD LOCAL Apr 2026.xlsx
QRCC Data Presentasi Meeting LCD LOCAL Apr 2026.xlsx
```

---

## 18 · API Endpoint Target

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/import/sales` | Upload dan proses sales CSV |
| POST | `/api/import/raw-service` | Upload dan proses raw service CSV |
| POST | `/api/import/reprocess` | Re-run aggregation dari raw data aktif |
| GET | `/api/import/history` | List import history |
| GET/POST | `/api/report-months` | CRUD report month |
| GET/POST | `/api/models` | CRUD model |
| GET/POST | `/api/references/*` | CRUD references |
| GET/POST | `/api/targets/fqms` | CRUD target PPM |
| GET/POST | `/api/targets/fcost` | CRUD target F-COST |
| GET | `/api/review/sales` | Review sales data |
| GET | `/api/review/summary` | Review monthly summary |
| GET | `/api/review/defect` | Review defect entries |
| GET | `/api/review/nondefect` | Review non-defect entries |
| GET | `/api/review/fcost` | Review F-COST summary/breakdown |
| POST | `/api/validation/run` | Jalankan validation engine |
| GET | `/api/reports/view-model` | Ambil report view model |
| POST | `/api/reports/export-excel` | Generate Excel |
| POST | `/api/settings/backup` | Backup database |
| POST | `/api/settings/restore` | Restore database |

---

## 19 · Roadmap Implementasi dari Scratch

### Phase 0 — Project bootstrap

- Setup Nuxt 4 + Nuxt UI 4 + TypeScript strict.
- Setup lint/typecheck.
- Setup app identity QRCC Data Center.
- Buat sidebar shell dan page map kosong.

### Phase 1 — Database core

- Install Drizzle + SQLite driver.
- Buat schema dan migration awal.
- Seed products, manufacturers, defect categories, non-defect categories, repair actions, dan factory mappings awal.
- Buat repository layer.

### Phase 2 — CSV parser proof of accuracy

- Implement parser sales CSV.
- Implement parser raw service CSV.
- Buat aggregation service tanpa UI kompleks.
- Verifikasi angka April 2026 terhadap hitungan manual Excel.
- Lock rule `job_sheet_section`, defect/non-defect mapping, dan F-COST cost mapping.

### Phase 3 — Import UI

- Buat `/import` center.
- Upload sales CSV dan raw service CSV.
- Tampilkan preview rows, row count, accepted/rejected count, dan errors.
- Implement replace/reprocess mode.

### Phase 4 — Master data and targets

- CRUD report months.
- CRUD models dan launching month.
- CRUD factory mappings.
- CRUD grouping rules.
- CRUD FQMS target PPM dan F-COST target.

### Phase 5 — Review pages

- Review sales.
- Review summary.
- Review defect/non-defect.
- Review repair actions.
- Review F-COST summary, item breakdown, dan part category breakdown.
- Support manual override dengan audit flag.

### Phase 6 — Validation engine

- Implement V1–V22.
- Simpan validation runs.
- Tampilkan OK/CHECK dengan link perbaikan.

### Phase 7 — Report view model

- Build FQMS Section A/B/C/D view model.
- Build F-COST Summary/A/B/C view model.
- Implement grouping model saat render.
- Implement fiscal half/current half/LY logic.

### Phase 8 — Report preview and print

- Buat print-friendly report preview.
- Implement tombol `window.print()`.
- Test Chrome/Edge Print to PDF.
- Tuning CSS agar mirip report lama.

### Phase 9 — Excel export

- Siapkan template workbook.
- Mapping view model ke cell/named range.
- Simpan export history.

### Phase 10 — Backup/restore and packaging

- Implement backup/restore SQLite.
- Buat portable package.
- Test di Windows bersih tanpa Node.js.
- Dokumentasikan cara pakai operator.

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
