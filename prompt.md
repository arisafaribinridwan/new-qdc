Kita lanjut dari repo `G:\Koding\new-qdc`.

Context penting:
- Ini Nuxt 4 app QRCC Data Center.
- Ikuti `AGENTS.md`, `CLAUDE.md`, `prd.md`, `.doc/spec-report-fqms.md`, dan `task-plan.md`.
- Jangan buat UI besar dulu.
- Pertahankan boundary:
  HTTP request -> API controller -> service -> repository -> SQLite
- Excel tetap output/template saja, bukan database.
- Preview/API dan Excel export harus berasal dari report view model yang sama.
- Jangan ubah format raw sales/raw service/master model hanya karena beda tanda `-`.
- Matching model sudah aman untuk beda format strip:
  - raw/proof/workbook: `2TC43GH3000I`
  - report/master: `2T-C43GH3000I`
  - normalisasi membuang karakter non alphanumeric.
- Master FQMS model-series sudah tersedia dan harus tetap dipakai untuk model aktif:
  - table `fqms_model_series`
  - repository `server/repositories/fqmsModelSeries.ts`
  - helper `server/services/fqmsModelSeries.ts`
- FQMS accumulated backend sudah tersedia dan dipakai untuk Section C:
  - table `fqms_accumulated_model_rows`
  - repository `server/repositories/fqmsAccumulatedModelRows.ts`
  - service `server/services/fqmsAccumulated.ts`
  - importer `scripts/import-fqms-accumulated-monitoring.mjs`
- FQMS historical raw monitoring backend sudah tersedia dan dipakai untuk Section D:
  - table `fqms_historical_defect_rows`
  - repository `server/repositories/fqmsHistoricalDefectRows.ts`
  - importer `scripts/import-fqms-historical-defects.mjs`
  - report service `server/reports/fqmsWorstDefects.ts`
- FQMS monthly monitoring snapshot backend sudah tersedia dan dipakai sebagai data awal Section A/B:
  - table `fqms_monitoring_monthly_snapshots`
  - repository `server/repositories/fqmsMonitoringMonthlySnapshots.ts`
  - service `server/services/fqmsMonitoringSnapshots.ts`
  - importer `scripts/import-fqms-monitoring-monthly-snapshots.mjs`
- 14 workbook monitoring aktif ada di `.doc/raw/*.xlsx`.
- File export terbaru ada di `storage/exports/202604/LCD/LOCAL/202604_LCD_LOCAL_fqms_excel.xlsx`.

Status terakhir yang sudah selesai:
- Data akumulasi dari 14 workbook monitoring sudah masuk SQLite:
  - rows `14`
  - accumulated sales `821,326`
  - defect `4,061`
  - non-defect `1,025`
  - total claim `5,086`
  - exposure `11,931,633`
  - defect PPM raw `340.355759`, display rounded up `341`
  - non-defect PPM raw `85.906095`, display rounded up `86`
  - total PPM raw `426.261854`
- Raw historis dari sheet `raw` 14 workbook monitoring sudah masuk SQLite:
  - table `fqms_historical_defect_rows`
  - rows `7,389`
  - defect `4,061`
  - non-defect `1,025`
- Sheet utama `FQMS` export sudah mengisi header, Section C Detail Model, dan Section D Worst Defect dari view model.
- `R4` sudah diperbaiki agar scope `202604` tampil sebagai `Apr-26`, bukan `Mar-26` karena timezone shift.
- Section C rows `B23:N36` sudah memakai 14 model aktual.
- Section C total row memakai accumulated totals dan tetap cocok proof April 2026.
- Section C display number sudah tanpa desimal dan dibulatkan ke atas.
- Section C model rows sudah diurutkan dari launching month paling lama.
- `C37:E37` sudah merge, fill `#31869B`, font Calibri size 9, text putih.
- `L37` dan `M37` sudah dikosongkan.
- Section D Worst Defect sudah memakai model aktual, bukan placeholder `Model A`, dst.
- Section D sudah membaca `fqms_historical_defect_rows` dan mengisi bucket:
  - `~Jan'26`
  - `Feb'26`
  - `Mar'26`
  - `Apr'26`
- Section D defect PPM memakai denominator Section C: `accumulated_sales_model * launching_period_model`.
- Monthly monitoring snapshots dari sheet `summary` 14 workbook monitoring sudah masuk SQLite:
  - table `fqms_monitoring_monthly_snapshots`
  - rows `171`
  - report month accumulated defect `4,061`
  - accumulated non-defect through report month `1,025`
  - missing cached `ACC SALES QTY`: `171`
  - missing cached `AVERAGE DEFECT PPM`: `171`
- Section A/B view model sudah dibuat dari persisted snapshot:
  - `viewModel.fqms.monitoringSnapshots`
  - source `monitoring_summary_snapshots`
  - status `check`
  - trend months `202511..202604`
  - April result PPM `null` karena denominator belum terbukti
  - April acceptance ratio `null` karena model PPM belum terbukti
- Section A export sudah menulis source data hidden cells `DZ:EE`:
  - month labels terisi
  - target baseline `383` terisi sementara
  - result PPM blank jika denominator missing
- Section B export sudah membersihkan stale template values:
  - total model count terisi dari snapshot
  - OK/NG/Acceptance Ratio blank jika PPM model belum terbukti
- `pnpm typecheck` dan `pnpm lint` sudah lulus setelah implementasi monthly monitoring snapshots.
- Verifikasi API view model dan export sudah dilakukan lewat Nuxt dev server port `3101`.
- Export workbook inspection terakhir memastikan:
  - `R4 = Apr-26`
  - Section B stale ratio kosong saat PPM belum terbukti
  - Section A source cells `DZ3:EE5` terisi target/month dan result blank
  - Section C tetap cocok totals proof
  - Section D tetap terisi dari historical rows

Catatan penting dari inspeksi workbook/template:
- Sheet `summary` workbook monitoring memakai formula Excel.
- Row penting di sheet `summary`:
  - row 7: `PASSING MONTH`
  - row 8: `SALES QTY`
  - row 9: `ACC SALES QTY`
  - row 10: `NON-DEFECT QTY`
  - row 11: `DEFECT QTY`
  - row 12: `ACC DEFECT`
  - row 13: `AVERAGE DEFECT PPM`
- Untuk April 2026, workbook `01-2TC32GH3000I.xlsx` memakai kolom report month `AD`.
- Cached result untuk `ACC SALES QTY` dan `AVERAGE DEFECT PPM` kosong di workbook `.doc/raw`, sehingga jangan isi result PPM / OK-NG palsu.
- Target table global product/manufacturer/fiscal half belum tersedia; sementara Section A/B dan Section C export masih membaca baseline target `383` dari template/constant dan harus dianggap `CHECK` sampai target master dibuat.
- ExcelJS export saat ini diketahui tidak mempertahankan chart XML dari template. Jangan mengklaim chart visual final sudah preserved sebelum diverifikasi ulang di file export.

Hal yang belum selesai:
- Section A — Quality Trend belum bisa menampilkan result PPM karena denominator bulanan historis belum tersedia.
- Section B — Acceptance Ratio belum bisa menghitung OK/NG/ratio karena PPM model bulanan belum tersedia.
- Target monthly PPM masih baseline sementara, belum dari master target SQLite.
- Chart visual Excel belum boleh dianggap final karena ExcelJS output perlu diverifikasi apakah chart parts dipertahankan.

Rekomendasi task berikutnya:
Fokus ke data truth untuk Section A/B denominator dan target master. Jangan polish chart dulu. Buat sumber historis sales bulanan/accumulated sales yang auditable di SQLite, lalu hitung ulang Section A Quality Trend dan Section B Acceptance Ratio dari SQLite. Jika source sales history bulanan belum tersedia di repo, berhenti dengan CHECK yang jelas dan dokumentasikan kebutuhan input operator.

Task berikutnya:
Implement FQMS monthly sales history + target master untuk menyelesaikan Section A Quality Trend dan Section B Acceptance Ratio secara benar.

Tujuan:
- Menghilangkan ketergantungan Section A/B pada cached formula Excel yang kosong.
- Menyediakan denominator bulanan historis per model aktif:
  - `accumulated_sales_model_month`
  - `passing_month_model_month`
  - `exposure_model_month = accumulated_sales_model_month * passing_month_model_month`
- Menghitung Section A result PPM:
  - total accumulated defect seluruh model aktif pada bulan tersebut
  - total exposure seluruh model aktif pada bulan tersebut
  - result PPM = total accumulated defect / total exposure * 1,000,000
- Menghitung Section B Acceptance Ratio:
  - total model aktif/monitoring pada bulan tersebut
  - OK model count
  - NG model count
  - acceptance ratio = OK / total model
  - quality level memakai target monthly PPM global product/manufacturer/fiscal half
- Menyimpan target monthly PPM di SQLite, bukan membaca template sebagai sumber truth.
- Preview/API dan Excel export tetap memakai view model yang sama.
- Excel writer hanya mapping view model ke template, bukan melakukan kalkulasi bisnis.

Langkah kerja yang saya inginkan:
1. Baca dulu:
   - `server/db/schema.ts`
   - `server/repositories/fqmsMonitoringMonthlySnapshots.ts`
   - `server/services/fqmsMonitoringSnapshots.ts`
   - `server/reports/viewModel.ts`
   - `server/reports/types.ts`
   - `server/reports/exportExcel.ts`
   - `server/services/fqmsAccumulated.ts`
   - `server/services/fqmsModelSeries.ts`
   - `scripts/import-fqms-monitoring-monthly-snapshots.mjs`
   - `scripts/import-fqms-accumulated-monitoring.mjs`
   - `.doc/spec-report-fqms.md`
   - `task-plan.md`
2. Cari/inspect sumber sales history bulanan yang tersedia di repo:
   - `.doc/**`
   - `storage/proofs/**`
   - CSV/XLSX lain yang mungkin berisi sales bulanan atau accumulated sales per model per month
   - jangan mengarang file/path eksternal yang belum ada
3. Jika sumber sales history bulanan tersedia:
   - rancang schema SQLite baru atau perluas snapshot yang ada, misalnya `fqms_monthly_model_sales` atau field import yang jelas
   - fields minimal: `report_scope_id`, `source_model_code`, `report_model_code`, `month_key`, `sales_qty`, `accumulated_sales`, `source_filename`, `source_json`
   - buat repository CRUD/query
   - buat importer repeatable
   - validasi total April 2026 tetap konsisten dengan accumulated Section C sales `821,326`
4. Jika sumber sales history bulanan tidak tersedia:
   - jangan isi angka palsu
   - pertahankan Section A/B status `CHECK`
   - dokumentasikan input minimum yang dibutuhkan, format CSV yang disarankan, dan reason kenapa Section A/B belum final
   - tetap boleh buat importer skeleton hanya kalau format input didefinisikan jelas dan tidak mengarang data
5. Implement target monthly PPM master di SQLite:
   - table misalnya `fqms_targets`
   - fields minimal: `product_id`, `manufacturer_id`, `fiscal_year`, `fiscal_half`, `target_monthly_ppm`, `valid_from_month`, `source_json`
   - seed/import baseline April 2026 LCD LOCAL target `383` sebagai explicit seed/source, bukan baca template runtime
   - repository target lookup by product/manufacturer/month
6. Update `server/services/fqmsMonitoringSnapshots.ts`:
   - gunakan target master dari SQLite
   - gunakan sales history denominator jika tersedia
   - jika denominator missing, return CHECK/blank, bukan `Infinity`, `NaN`, atau angka misleading
   - Section A result PPM harus berbasis total exposure, bukan average antar model
   - Section B OK/NG harus berbasis model PPM dibanding target global
7. Update `server/reports/types.ts` jika view model butuh field audit tambahan:
   - denominator source/status
   - target source/status
   - missing sales months/model count
8. Update `server/reports/exportExcel.ts`:
   - Section A/B tetap hanya mapping view model
   - jangan buat chart hardcode jika data denominator belum terbukti
   - jika data sudah lengkap, isi Section A result PPM dan Section B OK/NG/ratio
9. Verifikasi export workbook:
   - Section C tetap tidak berubah dan totals tetap cocok proof April 2026
   - Section D tetap tidak berubah dan tetap membaca `fqms_historical_defect_rows`
   - Section A tidak menampilkan stale template values
   - Section B tidak menampilkan stale template values
   - jika denominator sudah tersedia, Section A/B menampilkan angka dari view model
10. Verifikasi chart preservation:
   - inspect output `.xlsx` zip untuk `xl/charts/*.xml`
   - jika ExcelJS tetap drop chart XML, dokumentasikan CHECK dan jangan klaim chart visual final
   - jangan ganti library besar tanpa alasan dan tanpa persetujuan
11. Jalankan verifikasi:
   - `pnpm typecheck`
   - `pnpm lint`
   - command import sales history/target jika dibuat
   - command import snapshot jika perlu
   - command export/API/workbook inspection yang relevan
12. Update `task-plan.md` dan `.doc/spec-report-fqms.md` sesuai behavior Section A/B yang benar-benar diimplementasikan.

Catatan penting:
- Jangan mengandalkan Excel sebagai database. Workbook hanya sumber import/verifikasi.
- Jangan mengisi angka Section A/B yang denominatornya belum bisa dibuktikan.
- Jangan mengubah Section C/D yang sudah cocok kecuali memang diperlukan untuk integrasi view model.
- Jangan mengubah raw sales/raw service/master model format hanya demi strip `-`.
- Jangan otomatis stage/commit file yang tidak terkait seperti CSV `.doc/*.csv`, template binary, atau output export jika perubahan tidak disengaja.
- Jika butuh file input baru untuk monthly sales history, jelaskan format minimum dan minta user menyediakan file; jangan membuat data dummy sebagai truth.

Tolong implement langsung sejauh data tersedia. Jika data denominator bulanan tidak tersedia, berhenti pada CHECK yang eksplisit dan update dokumentasi dengan kebutuhan input yang tepat.

---

Catatan snapshot history saat ini:

Saat ini di local repo/database kamu **belum punya 12 item itu sebagai satu paket snapshot history lengkap**. Yang sudah ada baru sebagian, terutama untuk FQMS monitoring.

Di [schema.ts:122-143](server/db/schema.ts#L122-L143), table snapshot history utama yang sudah ada adalah:

| Table | Isi utama | Status data lokal |
|---|---|---:|
| `fqms_monitoring_monthly_snapshots` | snapshot bulanan dari monitoring workbook: `sales_qty`, `accumulated_sales`, `monthly_defect_qty`, `accumulated_defect_qty`, `monthly_non_defect_qty`, `average_defect_ppm` | 171 rows |
| `fqms_accumulated_model_rows` | accumulated per model untuk report month: launching period, accumulated sales, defect/non-defect/total claim | 14 rows |
| `fqms_historical_defect_rows` | raw/history defect rows dari monitoring workbook untuk worst defect | 7,389 rows |

Selain itu ada summary current-scope, tapi ini **bukan history snapshot detail**:

| Table | Isi |
|---|---|
| `fqms_summaries` di [schema.ts:241-254](server/db/schema.ts#L241-L254) | monthly summary FQMS: sales qty, claim qty, defect/non-defect count |
| `fcost_summaries` di [schema.ts:257-270](server/db/schema.ts#L257-L270) | monthly summary F-COST: row count, part/labor/transport/total cost rupiah |

Mapping terhadap list kamu:

| No | Metric | Kondisi sekarang |
|---:|---|---|
| 1 | FQMS avg defect PPM | **Ada**: `fqms_monitoring_monthly_snapshots.average_defect_ppm` |
| 2 | FQMS avg non defect PPM | **Belum ada**. Baru ada `monthly_non_defect_qty`, belum ada avg/accumulated non-defect PPM |
| 3 | Total model monitoring | **Belum disimpan sebagai kolom**. Saat ini dihitung di view model sebagai `totalModelCount` |
| 4 | OK model monitoring | **Belum disimpan sebagai kolom**. Dihitung dari snapshot + target di [fqmsMonitoringSnapshots.ts:20-29](server/services/fqmsMonitoringSnapshots.ts#L20-L29) |
| 5 | NG model monitoring | **Belum disimpan sebagai kolom**. Sama, masih computed |
| 6 | Sales Amount | **Belum ada**. Yang ada Sales Qty, bukan Sales Amount/rupiah |
| 7 | F-COST amount | **Ada sebagian** di `fcost_summaries.total_cost_rupiah`, tapi belum dalam table history snapshot |
| 8 | Target F-COST | **Belum ada** |
| 9 | Ratio vs Sales | **Belum ada** |
| 10 | Achievement | **Belum ada**; di PRD label ini juga sudah diganti jadi `Cost vs Target` |
| 11 | Sales Qty | **Ada**: `raw_sales_rows.quantity`, `fqms_summaries.sales_quantity`, dan `fqms_monitoring_monthly_snapshots.sales_qty` |
| 12 | F-Cost Qty | **Ada sebagian** sebagai `fcost_summaries.row_count` / `costRows`, tapi belum eksplisit sebagai metric snapshot bernama F-Cost Qty |

Jadi kesimpulannya: **yang sudah siap sebagai snapshot history paling kuat baru FQMS monitoring monthly snapshot**. Untuk list kamu yang lengkap, kita masih perlu menambahkan snapshot/history untuk F-COST + sales amount + target + ratio/achievement/cost-vs-target, atau bikin satu table metric snapshot generik supaya 12 metric itu tersimpan konsisten per month/scope.
