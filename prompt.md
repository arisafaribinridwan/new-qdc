Kita lanjut dari repo `d:\ARISAFARI\Works\Project Applications\new-qdc`.

Context penting:
- Ini Nuxt 4 app QRCC Data Center.
- Ikuti `AGENTS.md`, `CLAUDE.md`, `prd.md`, `.doc/spec-report-fqms.md`, dan `task-plan.md`.
- Jangan buat UI besar dulu.
- Pertahankan boundary:
  HTTP request -> API controller -> service -> repository -> SQLite
- Excel tetap output/template saja, bukan database.
- Preview dan Excel export harus berasal dari report view model yang sama.
- Jangan ubah format raw sales/raw service/master model hanya karena beda tanda `-`.
- Matching model sudah aman untuk beda format strip:
  - raw/proof: `2TC43GH3000I`
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
  - schema di `server/db/schema.ts`
- PR terakhir untuk FQMS Section C export sudah dibuat:
  - branch `fix/fqms-excel-section-c-export`
  - PR `https://github.com/arisafaribinridwan/new-qdc/pull/12`

Status terakhir yang sudah selesai:
- Sheet utama `FQMS` export sudah mengisi header dan Section C Detail Model dari `viewModel.fqms.accumulated.rows`.
- `R4` sudah diperbaiki agar scope `202604` tampil sebagai `Apr-26`, bukan `Mar-26` karena timezone shift.
- Section C rows `B23:N36` sudah memakai 14 model aktual, bukan `Model A` sampai `Model N`.
- Section C total row memakai accumulated totals:
  - sales `821,326`
  - defect `4,061`
  - non-defect `1,025`
  - total claim `5,086`
  - exposure `11,931,633`
  - defect PPM raw `340.355759`, display rounded up `341`
  - non-defect PPM raw `85.906095`, display rounded up `86`
- Section C display number sudah tanpa desimal dan dibulatkan ke atas.
- Section C model rows sudah diurutkan dari launching month paling lama.
- `C37:E37` sudah merge, fill `#31869B`, font Calibri size 9, text putih.
- `L37` dan `M37` sudah dikosongkan.
- `pnpm typecheck` dan `pnpm lint` sudah pernah lulus setelah perubahan Section C.

Hal yang belum terhubung di template FQMS:
- Section A — Quality Trend masih data/template lama.
- Section B — Acceptance Ratio masih data/template lama.
- Section D — Worst Defect masih data/template lama dengan placeholder `Model A`, `Model B`, dst.

Rekomendasi task berikutnya:
Fokus dulu ke Section D — Worst Defect pada sheet utama `FQMS`, karena Section C sudah benar tetapi bagian bawah report masih menampilkan placeholder lama. Section A/B butuh trend snapshot lintas bulan dan target history yang lebih luas; Section D lebih dekat dengan data raw service/effective action yang sudah ada.

Task berikutnya:
Implement FQMS Section D minimal Slice 0 agar sheet `FQMS` tidak lagi menyisakan placeholder/template lama pada area Worst Defect.

Tujuan:
- Section D `Worst Defect` memakai model aktual dari view model/model-series yang sama dengan Section C.
- Placeholder `Model A`, `Model B`, dst. di Section D harus dibersihkan/overwrite.
- Defect category di Section D harus berasal dari effective raw service rows + `master_actions`, bukan dari template lama.
- Untuk Slice 0, hitung dari row FQMS reportable:
  - `job_sheet_section = 1`
  - model masuk active FQMS model-series
  - action ada di `master_actions`
  - category `DEFECT`
  - defect bukan kosong/`N/A`
- Grouping minimal yang dibutuhkan:
  - report model
  - defect name/category sesuai master action output yang dipakai aplikasi
  - current report month count
  - total defect per model untuk occupancy
  - defect PPM memakai denominator Section C: `accumulated_sales_model * launching_period_model`
- Jika data historis untuk bucket lama Section D (`~Dec`, `Jan`, `Feb`, `Mar`, dst.) belum tersedia, jangan isi angka palsu. Bersihkan stale value dan isi hanya bucket yang bisa dibuktikan dari data saat ini, atau tampilkan status `CHECK`/blank sesuai pola report.
- Preview/API dan Excel export tetap memakai view model yang sama; jangan membuat logic hitung terpisah hanya di Excel writer.
- Jangan hardcode model matching baru; pakai helper normalisasi/model-series yang sudah ada.

Langkah kerja yang saya inginkan:
1. Baca dulu:
   - `server/reports/exportExcel.ts`
   - `server/reports/viewModel.ts`
   - `server/reports/types.ts`
   - `server/services/fqmsAccumulated.ts`
   - `server/services/fqmsModelSeries.ts`
   - repository raw service/effective action/master action yang relevan
   - `.doc/spec-report-fqms.md`
   - `task-plan.md`
2. Inspect template `templates/excel/FQMS - LCD LOCAL.xlsx` dengan ExcelJS untuk menemukan cell/range Section D:
   - header month buckets
   - model rows
   - defect/category rows
   - total/occupancy/PPM columns
   - merge ranges yang harus dipertahankan atau diubah
3. Rancang view model Section D kecil di layer report/service yang tetap mengikuti boundary:
   - repository hanya query data
   - service/report layer melakukan grouping/calculation
   - Excel writer hanya mapping view model ke template
4. Implement Section D data structure di `ReportViewModel` bila diperlukan.
5. Implement mapping Section D ke sheet `FQMS`.
6. Bersihkan placeholder `Model A` dst. dan angka lama pada range Section D.
7. Export Excel ulang dan verifikasi workbook hasil export:
   - Section C tetap tidak berubah dan totals tetap cocok proof April 2026.
   - Section D tidak lagi berisi placeholder lama.
   - Section D hanya menampilkan data yang benar-benar tersedia dari aplikasi.
8. Jalankan verifikasi:
   - `pnpm typecheck`
   - `pnpm lint`
   - command export/API/workbook inspection yang relevan
9. Update `task-plan.md` dan `.doc/spec-report-fqms.md` sesuai behavior Section D yang benar-benar diimplementasikan.

Catatan git/working tree:
- Jangan otomatis stage/commit file yang tidak terkait seperti CSV `.doc/*.csv`, `prompt.md`, atau template binary jika perubahan tidak sengaja.
- Kalau perlu commit/PR, pastikan hanya file terkait implementasi dan dokumentasi yang masuk commit.

Tolong implement langsung, bukan hanya kasih rencana.
