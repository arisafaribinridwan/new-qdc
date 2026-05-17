<template>
  <div class="space-y-6">
    <section>
      <h2 class="text-2xl font-semibold">Dashboard</h2>
      <p class="mt-2 text-slate-600">
        App shell awal untuk QRCC Data Center. Tahap berikutnya: database schema, CSV import, dan aggregation proof.
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          Report Month
        </template>
        <p class="text-sm text-slate-600">Pilih atau buat bulan laporan.</p>
      </UCard>

      <UCard>
        <template #header>
          Import Center
        </template>
        <p class="text-sm text-slate-600">Import sales CSV dan raw service CSV.</p>
      </UCard>

      <UCard>
        <template #header>
          Validation
        </template>
        <p class="text-sm text-slate-600">Jalankan validasi OK/CHECK sebelum export.</p>
      </UCard>
    </section>
  </div>
</template>
