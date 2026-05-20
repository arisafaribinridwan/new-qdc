Kita lanjut dari repo `d:\ARISAFARI\Works\Project Applications\new-qdc`.

Context penting:
- Ini Nuxt 4 app QRCC Data Center.
- Ikuti `AGENTS.md`, `CLAUDE.md`, `prd.md`, dan `task-plan.md`.
- Jangan buat UI besar dulu.
- Pertahankan boundary:
  HTTP request -> API controller -> service -> repository -> SQLite
- Excel tetap output/template saja, bukan database.
- Jangan ubah format raw sales/raw service/master model hanya karena beda tanda `-`.
- Matching model sudah aman untuk beda format strip:
  - raw/proof: `2TC43GH3000I`
  - report/master: `2T-C43GH3000I`
  - normalisasi membuang karakter non alphanumeric.
- Master FQMS model-series sudah tersedia:
  - table `fqms_model_series`
  - repository `server/repositories/fqmsModelSeries.ts`
  - helper `server/services/fqmsModelSeries.ts`
  - migration `drizzle/0004_fqms_model_series.sql`
- FQMS accumulated backend sudah dibuat:
  - table `fqms_accumulated_model_rows`
  - repository `server/repositories/fqmsAccumulatedModelRows.ts`
  - service `server/services/fqmsAccumulated.ts`
  - migration/seed `drizzle/0005_young_shinko_yamashiro.sql`
  - schema di `server/db/schema.ts`
- `server/reports/viewModel.ts` sudah memakai accumulated FQMS jika rows tersedia, dengan monthly summary sebagai fallback.
- API view model sudah pernah diverifikasi mengembalikan:
  - `fqms.source = accumulated`
  - `fqms.status = ok`
  - active report model count `14`
  - accumulated model count `14`
- Angka proof April 2026 LCD LOCAL yang wajib tetap cocok:
  - accumulated sales: `821,326`
  - defect: `4,061`
  - non-defect: `1,025`
  - total claim: `5,086`
  - exposure: `11,931,633`
  - defect PPM: `340.355759`
  - non-defect PPM: `85.906095`
  - total PPM: `426.261854`
  - preview/export ringkas boleh menampilkan total PPM rounded up sebagai `427`.

Masalah terakhir:
- Saat export Excel FQMS, sheet utama `FQMS` masih terlihat seperti data/template lama:
  - Reporting month masih `Mar-26`
  - Detail Model masih `Model A`, `Model B`, dst.
  - Totalnya masih sekitar sales `768,885`, defect `3,493`, non-defect `921`, total claim `4,414`
- Kemungkinan `server/reports/exportExcel.ts` baru menulis angka accumulated ke tab `QRCC Summary`, tetapi belum mengisi sheet utama `FQMS`.
- Jadi backend/view model kemungkinan sudah benar, tapi mapping Excel template utama belum lengkap.

Task berikutnya:
Lengkapi mapping Excel export FQMS utama agar sheet `FQMS` memakai `viewModel.fqms.accumulated.rows` dan totals dari accumulated view model, bukan membiarkan placeholder/template lama.

Tujuan:
- Sheet utama `FQMS` hasil export harus menampilkan April 2026 LCD LOCAL.
- Header report month harus `Apr-26`.
- Product/vendor tetap `LCD` / `LOCAL`.
- Section C Detail Model harus memakai 14 model accumulated aktual, bukan `Model A` sampai `Model N`.
- Total Section C harus cocok dengan proof:
  - sales `821,326`
  - defect `4,061`
  - non-defect `1,025`
  - total claim `5,086`
  - defect PPM total/display sesuai rule dari view model
  - non-defect PPM total/display sesuai rule dari view model
- Preview dan Excel export tetap memakai view model yang sama.
- Jangan hardcode model matching baru; pakai data/service yang sudah ada.

Langkah kerja yang saya inginkan:
1. Baca dulu:
   - `server/reports/exportExcel.ts`
   - `server/reports/viewModel.ts`
   - `server/reports/types.ts`
   - `server/services/fqmsAccumulated.ts`
   - `server/repositories/fqmsAccumulatedModelRows.ts`
   - `storage/proofs/fqms-accumulated-lcd-local-2026-04.csv`
   - `task-plan.md`
   - jika perlu `spec-report-fqms.md` / `.doc/spec-report-fqms.md`
2. Inspect template `templates/excel/FQMS - LCD LOCAL.xlsx` dengan ExcelJS untuk menemukan cell/range yang harus diisi:
   - report month
   - Section C Detail Model rows
   - total row
3. Implement mapping `viewModel.fqms.accumulated.rows` ke sheet `FQMS`.
4. Bersihkan/overwrite placeholder `Model A` sampai `Model N` dan angka lama di range Section C.
5. Pastikan total row dihitung dari accumulated totals, bukan formula/template lama yang stale.
6. Export Excel ulang dan verifikasi workbook hasil export:
   - sheet `FQMS` bukan hanya `QRCC Summary`
   - model rows dan total cocok proof April 2026.
7. Jalankan verifikasi:
   - `pnpm typecheck`
   - `pnpm lint`
   - command export/API/workbook inspection yang relevan
8. Update `task-plan.md` bila mapping Excel FQMS utama selesai.

Tolong implement langsung, bukan hanya kasih rencana.
