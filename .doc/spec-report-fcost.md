# Spec Report F-COST — QRCC Data Center

> **Versi**: 1.0 · **Terakhir diperbarui**: 2026-05-17
>
> Dokumen ini adalah spesifikasi report F-COST. Untuk PRD core lihat [`prd.md`](prd.md). Untuk backend view model dan API lihat [`backend.md`](backend.md).

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
