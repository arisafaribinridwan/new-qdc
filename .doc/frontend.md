# Frontend PRD — QRCC Data Center

> **Versi**: 1.0 · **Terakhir diperbarui**: 2026-05-17
>
> Dokumen ini memuat kebutuhan frontend, page map, report preview, print/export UX, dan shell aplikasi. Untuk product core lihat [`prd.md`](prd.md). Untuk backend lihat [`backend.md`](backend.md).

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


## Prinsip Frontend

1. UI harus membantu operator menyelesaikan workflow bulanan dengan urutan jelas: pilih bulan, import, review, validasi, preview, export, backup.
2. Dashboard harus selalu menjawab bulan aktif, status kelengkapan data, status validasi, dan next action.
3. Halaman entry adalah review/edit hasil agregasi, bukan input manual utama.
4. Report preview dan Excel export harus memakai report view model yang sama dari backend.
5. Browser Print to PDF dipakai untuk PDF; UI harus menyediakan instruksi dan tombol print yang jelas tanpa Playwright.

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
