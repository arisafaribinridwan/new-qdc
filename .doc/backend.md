# Backend PRD — QRCC Data Center

> **Versi**: 1.0 · **Terakhir diperbarui**: 2026-05-17
>
> Dokumen ini memuat kebutuhan backend, database, import CSV, aggregation, validation, dan API target. Untuk product core lihat [`prd.md`](prd.md). Untuk frontend lihat [`frontend.md`](frontend.md).

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
