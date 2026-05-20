# Spec Report FQMS — QRCC Data Center

> **Versi**: 1.1 · **Terakhir diperbarui**: 2026-05-20
>
> Dokumen ini adalah spesifikasi report FQMS. Untuk PRD core lihat [`prd.md`](prd.md). Untuk backend view model dan API lihat [`backend.md`](backend.md).

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

Untuk presentasi Slice 0 di preview/export, angka PPM FQMS ditampilkan sebagai bilangan bulat dengan pembulatan ke atas. Nilai presisi tetap dipakai di view model untuk kalkulasi dan audit.

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

Aturan export Excel Section C untuk template `FQMS - LCD LOCAL.xlsx`:

- Model rows diurutkan dari `Launching Month` paling lama, lalu `Model`.
- Report month pada header harus menampilkan bulan aktif report, misalnya scope `202604` tampil sebagai `Apr-26`.
- Kolom numerik presentasi seperti `Launching Period`, `Sales`, `Defect`, `Non Defect`, `Total Claim`, `AVG Defect PPM`, `AVG Non Defect PPM`, `Target Monthly PPM`, dan helper exposure ditampilkan tanpa desimal dan dibulatkan ke atas.
- Total row Section C memakai totals dari accumulated view model; cell `L37` dan `M37` dikosongkan karena target/quality level tidak berlaku untuk label total.
- Label total `C37:E37` di-merge dengan fill `#31869B`, font Calibri 9, dan text putih agar mengikuti template referensi.

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

Implementasi Slice 0:

- Model Section D mengikuti urutan/model aktif Section C.
- Defect berasal dari effective raw service row: `job_sheet_section = 1`, model masuk active FQMS model set, action ada di `master_actions`, category `DEFECT`, dan defect bukan kosong/`N/A`.
- `defect_occup` memakai total defect model pada bucket yang tersedia di SQLite.
- Untuk April 2026, SQLite baru memiliki raw service month `202604`; karena itu bucket `~Jan'26`, `Feb'26`, dan `Mar'26` dibiarkan blank/non-blocking CHECK, sedangkan bucket `Apr'26` diisi dari data yang tersedia.
- Export Excel membersihkan placeholder template `Model A`, `Model B`, dan seterusnya pada range Worst Defect.

---
