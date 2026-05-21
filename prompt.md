Kita lanjut dari repo `d:\ARISAFARI\Works\Project Applications\new-qdc`.

Context penting:
- Ini Nuxt 4 app QRCC Data Center.
- Ikuti `AGENTS.md`, `CLAUDE.md`, `prd.md`, `.doc/spec-report-fqms.md`, dan `task-plan.md`.
- `prd.md` adalah source of truth jika ada catatan lama yang konflik.
- Jangan buat UI besar dulu; ikuti Slice 0 dan prioritas di `task-plan.md`.
- Pertahankan boundary backend:
  HTTP request -> API controller -> service -> repository -> SQLite
- Excel tetap output/template saja, bukan database.
- Preview/API dan Excel export harus berasal dari report view model yang sama.
- Jangan ubah format raw sales/raw service/master model hanya karena beda tanda `-`.
- Matching model sudah aman untuk beda format strip; normalisasi membuang karakter non-alphanumeric.
- Master FQMS model-series, accumulated backend, historical defect rows, monitoring snapshots, dan verified sales history sudah tersedia. Jangan ganti sumber truth ini kecuali memang bagian dari task aktif.

Status ringkas saat ini:
- Phase 0 sampai Phase 6 pada `task-plan.md` mayoritas sudah selesai.
- April 2026 LCD LOCAL FQMS/F-COST proof sudah cocok dengan referensi.
- Section C dan Section D FQMS sudah berbasis data SQLite dan cocok dengan proof.
- Section A/B sudah memakai monitoring snapshots dan sales history verified untuk denominator, tetapi target master SQLite belum tersedia.
- Verified sales history `.doc/sales-history-lcd-local.csv` sudah menjadi sumber truth Slice 0 untuk sales qty dan sales amount.
- `pnpm typecheck` dan `pnpm lint` terakhir lulus setelah implementasi monitoring snapshots/sales history.

Hal yang masih aktif/belum selesai:
- Target monthly PPM masih baseline explicit `383`; perlu table master SQLite dan lookup target by product/manufacturer/month.
- Target F-COST dan `Cost vs Target` belum dari master target SQLite.
- `F-Cost Qty` masih memakai `fcost_summaries.row_count` / `costRows`; belum ada metric snapshot eksplisit.
- UI Phase 7 masih punya gap:
  - preview compare saat upload raw service menemukan existing data
  - edit minimal dari Review Anomalies untuk unblock import
  - gate flow end-to-end Slice 0 dari UI
- Portable Node bundle smoke test Phase 8 belum dikerjakan.
- Chart visual Excel belum boleh dianggap final; ExcelJS output perlu dicek apakah `xl/charts/*.xml` tetap dipertahankan.

Task berikutnya yang disarankan:
Implement target master SQLite untuk FQMS target monthly PPM dan F-COST target, lalu hubungkan ke view model, validation, preview, dan Excel export.

Tujuan:
- Target tidak lagi dibaca dari template atau constant runtime.
- Section A/B memakai target global product/manufacturer/fiscal half dari SQLite.
- F-COST memakai target master untuk `Cost vs Target`.
- Jika target/denominator missing, tampilkan CHECK/blank yang jelas, bukan `Infinity`, `NaN`, atau angka misleading.
- Excel writer tetap hanya mapping view model ke template, bukan melakukan kalkulasi bisnis.

Langkah kerja:
1. Baca dulu file yang relevan:
   - `server/db/schema.ts`
   - `server/reports/viewModel.ts`
   - `server/reports/types.ts`
   - `server/reports/exportExcel.ts`
   - `server/services/fqmsMonitoringSnapshots.ts`
   - service/repository F-COST yang terkait summary/view model
   - `.doc/spec-report-fqms.md`
   - `task-plan.md`
2. Tambahkan target master SQLite, misalnya:
   - `fqms_targets`: `product_id`, `manufacturer_id`, `fiscal_year`, `fiscal_half`, `target_monthly_ppm`, `valid_from_month`, `source_json`
   - `fcost_targets`: `product_id`, `manufacturer_id`, `fiscal_year`, `fiscal_half`, `target_cost_rupiah` atau field target yang sesuai PRD, `valid_from_month`, `source_json`
3. Seed/import baseline April 2026 LCD LOCAL target FQMS `383` sebagai explicit seed/source di SQLite.
4. Buat repository lookup target by product/manufacturer/month.
5. Update service/view model agar target source/status jelas dan tetap CHECK jika target missing.
6. Update validation export readiness jika target critical/warning behavior perlu ditegaskan sesuai PRD/task-plan.
7. Update Excel export hanya untuk mapping field target/cost-vs-target dari view model.
8. Verifikasi:
   - `pnpm typecheck`
   - `pnpm lint`
   - API view model untuk April 2026 LCD LOCAL
   - export workbook inspection yang relevan
   - Section C/D tidak berubah
9. Update `task-plan.md` dan `.doc/spec-report-fqms.md` sesuai behavior yang benar-benar diimplementasikan.

Catatan penting:
- Jangan mengisi angka palsu untuk target atau denominator yang belum ada.
- Jangan mengubah Section C/D yang sudah cocok kecuali diperlukan untuk integrasi target.
- Jangan otomatis stage/commit file yang tidak terkait seperti CSV `.doc/*.csv`, template binary, atau output export jika perubahan tidak disengaja.
- Jangan ganti library Excel/export besar tanpa alasan dan tanpa persetujuan.
