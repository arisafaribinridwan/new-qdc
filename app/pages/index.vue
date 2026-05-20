<script setup lang="ts">
type ImportType = 'sales' | 'raw_service'
type ActionKey = ImportType | 'reprocess' | 'validation' | 'export' | 'refresh' | 'override'
type IssueFilter = 'all' | 'blocking' | 'non_blocking'
type ReviewImpactFilter = 'fqms' | 'fcost' | 'all'
type ReviewAnomalyCode =
  | 'MISSING_MODEL'
  | 'KEYDATE_OUTLIER'
  | 'FACTORY_MAPPING_MISMATCH'
  | 'ACTION_UNCLASSIFIED'
  | 'HAS_MANUAL_OVERRIDE'

type ImportHistoryItem = {
  id: number
  monthKey: string
  importType: ImportType
  sourceFilename: string
  mode: 'replace'
  status: 'pending' | 'completed' | 'failed'
  rowCount: number
  acceptedCount: number
  rejectedCount: number
  warningCount: number
  replacedImportId: number | null
  importedAt: string
}

type ImportStatusItem = {
  importType: ImportType
  hasCurrentMonthImport: boolean
  currentMonthImport: ImportHistoryItem | null
  lastImportedMonth: string | null
  lastImport: ImportHistoryItem | null
}

type ImportStatus = {
  reportScopeId: number | null
  imports: Record<ImportType, ImportStatusItem>
  rawService: {
    manualOverrideCount: number
  }
}

type ImportSummary = {
  importId: number
  importType: ImportType
  sourceFilename: string
  status: string
  rowCount: number
  acceptedCount: number
  rejectedCount: number
  warningCount: number
  replacedImportId: number | null
}

type ReportViewModel = {
  generatedAt: string
  scope: {
    monthLabel: string
    monthKey: string
    fiscalYear: number
    fiscalHalf: 'FH' | 'LH'
    productCode: string
    productName: string
    manufacturerCode: string
    manufacturerName: string
  }
  imports: {
    salesImportId: number | null
    rawServiceImportId: number | null
  }
  fqms: {
    status: 'ok' | 'check'
    salesQuantity: number
    claimQuantity: number
    defectCount: number
    nonDefectCount: number
    unclassifiedClaimRows: number
    ppm: number | null
    denominatorStatus: 'ok' | 'missing_or_zero'
    computedAt: string
  } | null
  fcost: {
    status: 'ok' | 'check'
    serviceRows: number
    costRows: number
    partsCostRupiah: number
    laborCostRupiah: number
    transportationCostRupiah: number
    totalCostRupiah: number
    rawTotalCostRupiah: number
    totalCostDifferenceRupiah: number
    crossCheckStatus: 'ok' | 'check'
    computedAt: string
  } | null
}

type ValidationIssue = {
  id: number
  code: string
  severity: 'critical' | 'error' | 'warning' | 'check'
  reason: string
  relatedPage: string | null
}

type ValidationRunResult = {
  status: 'ok' | 'blocked' | 'check'
  exportReady: boolean
  issues: ValidationIssue[]
  summary: {
    issueCounts: Record<ValidationIssue['severity'], number>
    importStatus: {
      sales: boolean
      rawService: boolean
    }
    rawService: {
      manualOverrideCount: number
      stagingCompare: Record<string, number>
    }
    aggregation: {
      salesQuantity: number | null
      fqmsClaimQuantity: number | null
      fcostTotalRupiah: number | null
    }
  }
}

type ReportExportResult = {
  validation: {
    status: ValidationRunResult['status']
    exportReady: boolean
  }
  exports: Array<{
    exportType: 'fqms_excel' | 'fcost_excel'
    outputPath: string
  }>
}

type ExportJob = {
  id: number
  exportType: 'fqms_excel' | 'fcost_excel'
  status: 'pending' | 'completed' | 'blocked' | 'failed'
  outputPath: string | null
  createdAt: string
  completedAt: string | null
}

type ReportExportStatus = {
  exported: boolean
  latestByType: Record<ExportJob['exportType'], ExportJob | null>
  jobs: ExportJob[]
}

type ReviewAnomalyItem = {
  rowId: number
  rowNumber: number
  notification: string | null
  lineKey: string
  source: {
    rowNumber: number
    notification: string | null
    lineKey: string
    keydate: string
    factoryCode: string | null
    modelCode: string | null
    modelName: string | null
    jobSheetSection: number | null
    symptomCode: string | null
    symptomName: string | null
    action: string | null
    partCode: string | null
    partName: string | null
    serialNumber: string | null
    branch: string | null
    warranty: string | null
    totalCost: number
  }
  keydate: string
  factoryCode: string | null
  modelCode: string | null
  modelName: string | null
  symptom: {
    source: string | null
    override: string | null
    effective: string | null
  }
  action: {
    source: string | null
    override: string | null
    effective: string | null
  }
  defectCategory: {
    source: string | null
    effective: string | null
  }
  defect: {
    source: string | null
    effective: string | null
  }
  issueCodes: ReviewAnomalyCode[]
}

type ReviewAnomaliesResult = {
  impactFilter: ReviewImpactFilter
  totalItemCount: number
  allItemCount: number
  impactSummary: Record<ReviewImpactFilter, number>
  summary: Record<ReviewAnomalyCode, number>
  items: ReviewAnomalyItem[]
}

type ReviewActionOption = {
  action: string
  category: string
  defect: string
  isActive: boolean
}

type ReviewActionOptionsResult = {
  items: ReviewActionOption[]
}

type OverrideDraft = {
  overrideSymptom: string
  overrideAction: string
  note: string
}

const scope = {
  monthKey: '202604',
  productCode: 'LCD',
  manufacturerCode: 'LOCAL'
}

const toast = useToast()
const salesFileInput = ref<HTMLInputElement | null>(null)
const rawServiceFileInput = ref<HTMLInputElement | null>(null)
const activeAction = ref<ActionKey | null>(null)
const actionError = ref<string | null>(null)
const lastImport = ref<ImportSummary | null>(null)
const validationResult = ref<ValidationRunResult | null>(null)
const exportResult = ref<ReportExportResult | null>(null)
const issueFilter = ref<IssueFilter>('all')
const reviewImpactFilter = ref<ReviewImpactFilter>('fqms')
const overrideDrafts = ref<Record<string, OverrideDraft>>({})

const query = { ...scope }
const reviewAnomaliesQuery = computed(() => ({
  ...query,
  impact: reviewImpactFilter.value
}))

const {
  data: importStatus,
  pending: importStatusPending,
  error: importStatusError,
  refresh: refreshImportStatus
} = await useAsyncData('slice0-import-status', () => $fetch<ImportStatus>('/api/import/status', { query }))

const {
  data: importHistory,
  pending: importHistoryPending,
  refresh: refreshImportHistory
} = await useAsyncData('slice0-import-history', () => $fetch<ImportHistoryItem[]>('/api/import/history', { query }))

const {
  data: viewModel,
  pending: viewModelPending,
  error: viewModelError,
  refresh: refreshViewModel
} = await useAsyncData('slice0-report-view-model', () => $fetch<ReportViewModel>('/api/reports/view-model', { query }))

const {
  data: latestValidation,
  refresh: refreshLatestValidation
} = await useAsyncData('slice0-latest-validation', () => $fetch<ValidationRunResult | null>('/api/validation/latest', { query }))

const {
  data: exportStatus,
  refresh: refreshExportStatus
} = await useAsyncData('slice0-export-status', () => $fetch<ReportExportStatus>('/api/reports/export-status', { query }))

const {
  data: reviewAnomalies,
  pending: reviewAnomaliesPending,
  refresh: refreshReviewAnomalies
} = await useAsyncData(
  'slice0-review-anomalies',
  () => $fetch<ReviewAnomaliesResult>('/api/review-anomalies', { query: reviewAnomaliesQuery.value }),
  { watch: [reviewImpactFilter] }
)

const {
  data: reviewActionOptions
} = await useAsyncData('slice0-review-action-options', () => $fetch<ReviewActionOptionsResult>('/api/review-anomalies/action-options'))

const currentValidation = computed(() => validationResult.value ?? latestValidation.value)

watch(reviewAnomalies, (result) => {
  const nextDrafts = { ...overrideDrafts.value }

  for (const item of result?.items ?? []) {
    nextDrafts[item.lineKey] ??= {
      overrideSymptom: item.symptom.override ?? '',
      overrideAction: item.action.override ?? '',
      note: ''
    }
  }

  overrideDrafts.value = nextDrafts
}, { immediate: true })

const flowSteps = computed(() => [
  {
    label: 'Sales',
    ready: Boolean(importStatus.value?.imports.sales.hasCurrentMonthImport),
    detail: importStatus.value?.imports.sales.currentMonthImport?.sourceFilename ?? 'Belum ada import'
  },
  {
    label: 'Raw service',
    ready: Boolean(importStatus.value?.imports.raw_service.hasCurrentMonthImport),
    detail: importStatus.value?.imports.raw_service.currentMonthImport?.sourceFilename ?? 'Belum ada import'
  },
  {
    label: 'Aggregation',
    ready: Boolean(viewModel.value?.fqms && viewModel.value?.fcost),
    detail: viewModel.value ? `Generated ${formatDateTime(viewModel.value.generatedAt)}` : 'Belum ada summary'
  },
  {
    label: 'Validation',
    ready: Boolean(currentValidation.value?.exportReady),
    detail: currentValidation.value ? validationLabel(currentValidation.value.status) : 'Belum dijalankan'
  },
  {
    label: 'Export',
    ready: Boolean(exportResult.value?.exports.length || exportStatus.value?.exported),
    detail: getExportFlowDetail()
  }
])

const recentHistory = computed(() => (importHistory.value ?? []).slice(0, 6))
const filteredIssues = computed(() => {
  const issues = currentValidation.value?.issues ?? []

  if (issueFilter.value === 'blocking') {
    return issues.filter(issue => issue.severity === 'critical' || issue.severity === 'error')
  }

  if (issueFilter.value === 'non_blocking') {
    return issues.filter(issue => issue.severity === 'warning' || issue.severity === 'check')
  }

  return issues
})
const visibleIssues = computed(() => filteredIssues.value.slice(0, 8))
const blockingCount = computed(() => {
  const counts = currentValidation.value?.summary.issueCounts
  return (counts?.critical ?? 0) + (counts?.error ?? 0)
})
const anomalyCount = computed(() => {
  const counts = currentValidation.value?.summary.issueCounts
  const validationIssues = (counts?.critical ?? 0) + (counts?.error ?? 0) + (counts?.warning ?? 0) + (counts?.check ?? 0)
  const importWarnings = (importStatus.value?.imports.sales.currentMonthImport?.warningCount ?? 0)
    + (importStatus.value?.imports.raw_service.currentMonthImport?.warningCount ?? 0)

  return validationIssues + importWarnings
})
const exportJobs = computed(() => {
  if (exportResult.value?.exports.length) {
    return exportResult.value.exports.map(item => ({
      id: item.outputPath,
      exportType: item.exportType,
      status: 'completed',
      outputPath: item.outputPath,
      completedAt: null
    }))
  }

  return exportStatus.value?.jobs.slice(0, 4) ?? []
})
const stagingCompareEntries = computed(() => Object.entries(currentValidation.value?.summary.rawService.stagingCompare ?? {})
  .filter(([, count]) => count > 0))
const reviewSummaryEntries = computed(() => Object.entries(reviewAnomalies.value?.summary ?? {})
  .filter(([, count]) => count > 0))
const reviewActionOptionItems = computed(() => reviewActionOptions.value?.items ?? [])
const filteredReviewAnomalyItems = computed(() => reviewAnomalies.value?.items ?? [])
const reviewImpactCounts = computed<Record<ReviewImpactFilter, number>>(() => reviewAnomalies.value?.impactSummary ?? {
  fqms: 0,
  fcost: 0,
  all: 0
})
const visibleReviewItems = computed(() => filteredReviewAnomalyItems.value.slice(0, 8).map(item => ({
  ...item,
  draft: overrideDrafts.value[item.lineKey] ?? {
    overrideSymptom: '',
    overrideAction: '',
    note: ''
  }
})))

const importCards = computed(() => [
  {
    title: 'Sales CSV',
    icon: 'i-lucide-file-spreadsheet',
    type: 'sales' as const,
    status: importStatus.value?.imports.sales,
    input: salesFileInput
  },
  {
    title: 'Raw Service CSV',
    icon: 'i-lucide-file-search',
    type: 'raw_service' as const,
    status: importStatus.value?.imports.raw_service,
    input: rawServiceFileInput
  }
])

function chooseFile(type: ImportType) {
  if (type === 'sales') {
    salesFileInput.value?.click()
    return
  }

  rawServiceFileInput.value?.click()
}

async function uploadFile(type: ImportType, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  actionError.value = null
  activeAction.value = type

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('monthKey', scope.monthKey)
    formData.append('productCode', scope.productCode)
    formData.append('manufacturerCode', scope.manufacturerCode)

    lastImport.value = await $fetch<ImportSummary>(type === 'sales' ? '/api/import/sales' : '/api/import/raw-service', {
      method: 'POST',
      body: formData
    })

    await reprocess(false)
    validationResult.value = await validateScope()
    await refreshData()
    toast.add({
      title: 'Import selesai',
      description: `${file.name} tersimpan untuk ${type === 'sales' ? 'sales' : 'raw service'}.`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  }
  catch (error) {
    handleActionError(error)
  }
  finally {
    input.value = ''
    activeAction.value = null
  }
}

async function reprocess(showToast = true) {
  actionError.value = null
  activeAction.value = 'reprocess'

  try {
    await $fetch('/api/import/reprocess', {
      method: 'POST',
      body: scope
    })

    await refreshViewModel()

    if (showToast) {
      toast.add({
        title: 'Aggregation diperbarui',
        color: 'success',
        icon: 'i-lucide-refresh-cw'
      })
    }
  }
  catch (error) {
    handleActionError(error)
  }
  finally {
    activeAction.value = null
  }
}

async function runValidation() {
  actionError.value = null
  activeAction.value = 'validation'

  try {
    validationResult.value = await validateScope()

    toast.add({
      title: validationResult.value.exportReady ? 'Validation OK' : 'Validation perlu review',
      color: validationResult.value.exportReady ? 'success' : 'warning',
      icon: validationResult.value.exportReady ? 'i-lucide-check-circle' : 'i-lucide-triangle-alert'
    })
  }
  catch (error) {
    handleActionError(error)
  }
  finally {
    activeAction.value = null
  }
}

async function exportExcel() {
  actionError.value = null
  activeAction.value = 'export'

  try {
    exportResult.value = await $fetch<ReportExportResult>('/api/reports/export-excel', {
      method: 'POST',
      body: {
        ...scope,
        exportType: 'all'
      }
    })
    await refreshExportStatus()

    toast.add({
      title: 'Excel export selesai',
      description: `${exportResult.value.exports.length} workbook dibuat.`,
      color: 'success',
      icon: 'i-lucide-file-check'
    })
  }
  catch (error) {
    handleActionError(error)
  }
  finally {
    activeAction.value = null
  }
}

async function saveOverride(item: ReviewAnomalyItem) {
  actionError.value = null
  activeAction.value = 'override'

  try {
    const draft = overrideDrafts.value[item.lineKey] ?? {
      overrideSymptom: '',
      overrideAction: '',
      note: ''
    }

    await $fetch('/api/review-anomalies/raw-service-override', {
      method: 'POST',
      body: {
        ...scope,
        lineKey: item.lineKey,
        overrideSymptom: draft.overrideSymptom,
        overrideAction: draft.overrideAction,
        note: draft.note
      }
    })

    await $fetch('/api/import/reprocess', {
      method: 'POST',
      body: scope
    })

    validationResult.value = await validateScope()

    await Promise.all([
      refreshReviewAnomalies(),
      refreshImportStatus(),
      refreshViewModel(),
      refreshLatestValidation(),
      refreshExportStatus()
    ])
    toast.add({
      title: 'Override tersimpan',
      description: item.notification ?? item.lineKey,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  }
  catch (error) {
    handleActionError(error)
  }
  finally {
    activeAction.value = null
  }
}

async function refreshData() {
  actionError.value = null
  activeAction.value = 'refresh'

  try {
    await Promise.all([
      refreshImportStatus(),
      refreshImportHistory(),
      refreshViewModel(),
      refreshLatestValidation(),
      refreshExportStatus(),
      refreshReviewAnomalies()
    ])
  }
  catch (error) {
    handleActionError(error)
  }
  finally {
    activeAction.value = null
  }
}

function handleActionError(error: unknown) {
  actionError.value = getErrorMessage(error)
  toast.add({
    title: 'Action gagal',
    description: actionError.value,
    color: 'error',
    icon: 'i-lucide-circle-alert'
  })
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { statusMessage?: string, message?: string } }).data
    return data?.statusMessage ?? data?.message ?? 'Request gagal.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request gagal.'
}

function formatNumber(value: number | null | undefined, fractionDigits = 0) {
  if (typeof value !== 'number') {
    return '-'
  }

  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  }).format(value)
}

function formatRupiah(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '-'
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function statusColor(status: string | null | undefined) {
  if (status === 'ok' || status === 'completed') {
    return 'success'
  }

  if (status === 'blocked' || status === 'critical' || status === 'error' || status === 'failed') {
    return 'error'
  }

  return 'warning'
}

function validationLabel(status: ValidationRunResult['status']) {
  if (status === 'ok') {
    return 'Export ready'
  }

  if (status === 'blocked') {
    return 'Blocked'
  }

  return 'CHECK'
}

function getExportFlowDetail() {
  if (exportResult.value?.exports.length) {
    return `${exportResult.value.exports.length} file dibuat`
  }

  const latestCompleted = exportStatus.value?.jobs.find(job => job.status === 'completed')

  if (latestCompleted) {
    return `Exported ${formatDateTime(latestCompleted.completedAt ?? latestCompleted.createdAt)}`
  }

  return 'Belum export'
}

function issueCodeLabel(code: string) {
  return code.replace(/_/g, ' ')
}

async function validateScope() {
  const result = await $fetch<ValidationRunResult>('/api/validation/run', {
    method: 'POST',
    body: scope
  })
  await refreshLatestValidation()

  return result
}

function reviewActionOptionLabel(option: ReviewActionOption) {
  return `${option.category} / ${option.defect}`
}

function sourceFieldValue(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return formatNumber(value)
  }

  return value && value.trim().length > 0 ? value : '-'
}

function reviewSourceFields(item: ReviewAnomalyItem) {
  return [
    { label: 'CSV row', value: item.source.rowNumber },
    { label: 'Notification', value: item.source.notification },
    { label: 'Line key', value: item.source.lineKey },
    { label: 'Keydate', value: item.source.keydate },
    { label: 'Factory', value: item.source.factoryCode },
    { label: 'Model', value: item.source.modelCode },
    { label: 'Model name', value: item.source.modelName },
    { label: 'Job sheet', value: item.source.jobSheetSection },
    { label: 'Symptom code', value: item.source.symptomCode },
    { label: 'Source symptom', value: item.source.symptomName },
    { label: 'Source action', value: item.source.action },
    { label: 'Part', value: [item.source.partCode, item.source.partName].filter(Boolean).join(' / ') || null },
    { label: 'Serial', value: item.source.serialNumber },
    { label: 'Branch', value: item.source.branch },
    { label: 'Warranty', value: item.source.warranty },
    { label: 'Total cost', value: item.source.totalCost }
  ]
}
</script>

<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <UBadge color="primary" variant="subtle">{{ scope.monthKey }}</UBadge>
          <UBadge color="neutral" variant="subtle">{{ scope.productCode }}</UBadge>
          <UBadge color="neutral" variant="subtle">{{ scope.manufacturerCode }}</UBadge>
          <UBadge color="neutral" variant="outline">Slice 0</UBadge>
        </div>
        <div>
          <h2 class="text-2xl font-semibold tracking-normal">April 2026 LCD LOCAL</h2>
          <p class="mt-1 text-sm text-muted">Accuracy slice untuk FQMS dan F-COST.</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          label="Refresh"
          color="neutral"
          variant="subtle"
          :loading="activeAction === 'refresh'"
          @click="refreshData"
        />
        <UButton
          icon="i-lucide-calculator"
          label="Reprocess"
          color="neutral"
          variant="subtle"
          :loading="activeAction === 'reprocess'"
          @click="reprocess()"
        />
        <UButton
          icon="i-lucide-shield-check"
          label="Validation"
          color="primary"
          variant="solid"
          :loading="activeAction === 'validation'"
          @click="runValidation"
        />
      </div>
    </section>

    <UAlert
      v-if="actionError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Action gagal"
      :description="actionError"
    />

    <UAlert
      v-if="importStatusError || viewModelError"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Data belum lengkap"
      description="Beberapa panel belum punya data untuk scope ini."
    />

    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div
        v-for="step in flowSteps"
        :key="step.label"
        class="rounded-lg border border-default bg-default p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium">{{ step.label }}</p>
          <UBadge :color="step.ready ? 'success' : 'warning'" variant="subtle">
            {{ step.ready ? 'Ready' : 'CHECK' }}
          </UBadge>
        </div>
        <p class="mt-2 truncate text-xs text-muted">{{ step.detail }}</p>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <UCard
        v-for="card in importCards"
        :key="card.type"
      >
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <UIcon :name="card.icon" class="size-5 text-primary" />
              <h3 class="font-semibold">{{ card.title }}</h3>
            </div>
            <UBadge :color="card.status?.hasCurrentMonthImport ? 'success' : 'warning'" variant="subtle">
              {{ card.status?.hasCurrentMonthImport ? 'Imported' : 'Missing' }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-muted">Last month</dt>
              <dd class="font-medium">{{ card.status?.lastImportedMonth ?? '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted">Rows</dt>
              <dd class="font-medium">{{ formatNumber(card.status?.currentMonthImport?.acceptedCount) }}</dd>
            </div>
            <div>
              <dt class="text-muted">Warnings</dt>
              <dd class="font-medium">{{ formatNumber(card.status?.currentMonthImport?.warningCount) }}</dd>
            </div>
            <div>
              <dt class="text-muted">Re-import</dt>
              <dd class="font-medium">
                {{ card.status?.currentMonthImport?.replacedImportId ? `Replaced #${card.status.currentMonthImport.replacedImportId}` : card.status?.currentMonthImport?.mode ?? 'replace' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Anomalies</dt>
              <dd class="font-medium">{{ formatNumber(anomalyCount) }}</dd>
            </div>
            <div>
              <dt class="text-muted">Exported</dt>
              <dd class="font-medium">{{ exportStatus?.exported ? 'Yes' : 'No' }}</dd>
            </div>
          </dl>

          <div class="rounded-md border border-muted bg-muted p-3">
            <p class="truncate text-sm font-medium">
              {{ card.status?.currentMonthImport?.sourceFilename ?? 'No current file' }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ formatDateTime(card.status?.currentMonthImport?.importedAt) }}
            </p>
          </div>

          <input
            :ref="el => {
              if (card.type === 'sales') salesFileInput = el as HTMLInputElement | null
              if (card.type === 'raw_service') rawServiceFileInput = el as HTMLInputElement | null
            }"
            class="hidden"
            type="file"
            accept=".csv,text/csv"
            @change="uploadFile(card.type, $event)"
          >

          <UButton
            icon="i-lucide-upload"
            :label="card.status?.hasCurrentMonthImport ? 'Replace CSV' : 'Upload CSV'"
            color="neutral"
            variant="outline"
            block
            :loading="activeAction === card.type"
            @click="chooseFile(card.type)"
          />
        </div>
      </UCard>
    </section>

    <section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold">Report Preview</h3>
            <UBadge color="neutral" variant="subtle">
              {{ viewModel?.scope.monthLabel ?? 'April 2026' }}
            </UBadge>
          </div>
        </template>

        <div
          v-if="viewModelPending"
          class="space-y-3"
        >
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-24 w-full" />
        </div>

        <div
          v-else
          class="grid gap-4 lg:grid-cols-2"
        >
          <div class="rounded-lg border border-default p-4">
            <div class="flex items-center justify-between gap-3">
              <h4 class="font-semibold">FQMS</h4>
              <UBadge :color="statusColor(viewModel?.fqms?.status)" variant="subtle">
                {{ viewModel?.fqms?.status ?? 'missing' }}
              </UBadge>
            </div>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Sales quantity</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fqms?.salesQuantity) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Claim quantity</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fqms?.claimQuantity) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Defect</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fqms?.defectCount) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Non defect</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fqms?.nonDefectCount) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Unclassified</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fqms?.unclassifiedClaimRows) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">PPM</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fqms?.ppm) }}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-lg border border-default p-4">
            <div class="flex items-center justify-between gap-3">
              <h4 class="font-semibold">F-COST</h4>
              <UBadge :color="statusColor(viewModel?.fcost?.status)" variant="subtle">
                {{ viewModel?.fcost?.status ?? 'missing' }}
              </UBadge>
            </div>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Service rows</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fcost?.serviceRows) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Cost rows</dt>
                <dd class="font-medium">{{ formatNumber(viewModel?.fcost?.costRows) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Parts</dt>
                <dd class="font-medium">{{ formatRupiah(viewModel?.fcost?.partsCostRupiah) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Labor</dt>
                <dd class="font-medium">{{ formatRupiah(viewModel?.fcost?.laborCostRupiah) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Transportation</dt>
                <dd class="font-medium">{{ formatRupiah(viewModel?.fcost?.transportationCostRupiah) }}</dd>
              </div>
              <div class="flex justify-between gap-3 border-t border-muted pt-3">
                <dt class="text-muted">Total</dt>
                <dd class="font-semibold">{{ formatRupiah(viewModel?.fcost?.totalCostRupiah) }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </UCard>

      <div class="space-y-4">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-semibold">Validation Summary</h3>
              <UBadge :color="statusColor(currentValidation?.status)" variant="subtle">
                {{ currentValidation ? validationLabel(currentValidation.status) : 'Not run' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-md border border-default p-3">
                <p class="text-muted">Blocking</p>
                <p class="mt-1 text-2xl font-semibold">{{ blockingCount }}</p>
              </div>
              <div class="rounded-md border border-default p-3">
                <p class="text-muted">Manual overrides</p>
                <p class="mt-1 text-2xl font-semibold">
                  {{ formatNumber(currentValidation?.summary.rawService.manualOverrideCount ?? importStatus?.rawService.manualOverrideCount) }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton
                label="All"
                size="xs"
                :color="issueFilter === 'all' ? 'primary' : 'neutral'"
                :variant="issueFilter === 'all' ? 'solid' : 'subtle'"
                @click="issueFilter = 'all'"
              />
              <UButton
                label="Blocking"
                size="xs"
                :color="issueFilter === 'blocking' ? 'primary' : 'neutral'"
                :variant="issueFilter === 'blocking' ? 'solid' : 'subtle'"
                @click="issueFilter = 'blocking'"
              />
              <UButton
                label="Non-blocking"
                size="xs"
                :color="issueFilter === 'non_blocking' ? 'primary' : 'neutral'"
                :variant="issueFilter === 'non_blocking' ? 'solid' : 'subtle'"
                @click="issueFilter = 'non_blocking'"
              />
            </div>

            <div
              v-if="stagingCompareEntries.length"
              class="grid grid-cols-2 gap-2 text-sm"
            >
              <div
                v-for="[code, count] in stagingCompareEntries"
                :key="code"
                class="rounded-md border border-muted p-3"
              >
                <p class="truncate text-xs text-muted">{{ code }}</p>
                <p class="mt-1 font-semibold">{{ formatNumber(count) }}</p>
              </div>
            </div>

            <div
              v-if="visibleIssues.length"
              class="space-y-2"
            >
              <div
                v-for="issue in visibleIssues"
                :key="issue.id"
                class="rounded-md border border-muted p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium">{{ issue.code }}</p>
                  <UBadge :color="statusColor(issue.severity)" variant="subtle">{{ issue.severity }}</UBadge>
                </div>
                <p class="mt-1 text-sm text-muted">{{ issue.reason }}</p>
              </div>
            </div>

            <p
              v-else
              class="text-sm text-muted"
            >
              Tidak ada issue dari validation run terakhir.
            </p>

            <UButton
              icon="i-lucide-file-output"
              label="Export Excel"
              color="primary"
              block
              :loading="activeAction === 'export'"
              @click="exportExcel"
            />
          </div>
        </UCard>

        <UCard v-if="exportJobs.length">
          <template #header>
            <h3 class="font-semibold">Export History</h3>
          </template>

          <div class="space-y-2">
            <div
              v-for="item in exportJobs"
              :key="item.id"
              class="rounded-md border border-muted p-3"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-medium">{{ item.exportType }}</p>
                <UBadge :color="statusColor(item.status)" variant="subtle">{{ item.status }}</UBadge>
              </div>
              <p class="mt-1 break-all text-xs text-muted">{{ item.outputPath }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <UCard>
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="font-semibold">Review Anomalies</h3>
            <p class="mt-1 text-sm text-muted">Line-level raw service review untuk missing mapping, outlier, dan override action.</p>
          </div>
          <UBadge :color="visibleReviewItems.length ? 'warning' : 'success'" variant="subtle">
            {{ formatNumber(reviewAnomalies?.totalItemCount ?? 0) }} / {{ formatNumber(reviewAnomalies?.allItemCount ?? 0) }} rows
          </UBadge>
        </div>
      </template>

      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="`FQMS-impact (${formatNumber(reviewImpactCounts.fqms)})`"
            size="xs"
            :color="reviewImpactFilter === 'fqms' ? 'primary' : 'neutral'"
            :variant="reviewImpactFilter === 'fqms' ? 'solid' : 'subtle'"
            @click="reviewImpactFilter = 'fqms'"
          />
          <UButton
            :label="`F-COST-impact (${formatNumber(reviewImpactCounts.fcost)})`"
            size="xs"
            :color="reviewImpactFilter === 'fcost' ? 'primary' : 'neutral'"
            :variant="reviewImpactFilter === 'fcost' ? 'solid' : 'subtle'"
            @click="reviewImpactFilter = 'fcost'"
          />
          <UButton
            :label="`All (${formatNumber(reviewImpactCounts.all)})`"
            size="xs"
            :color="reviewImpactFilter === 'all' ? 'primary' : 'neutral'"
            :variant="reviewImpactFilter === 'all' ? 'solid' : 'subtle'"
            @click="reviewImpactFilter = 'all'"
          />
        </div>

        <div
          v-if="reviewSummaryEntries.length"
          class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div
            v-for="[code, count] in reviewSummaryEntries"
            :key="code"
            class="rounded-md border border-muted p-3"
          >
            <p class="truncate text-xs text-muted">{{ issueCodeLabel(code) }}</p>
            <p class="mt-1 text-lg font-semibold">{{ formatNumber(count) }}</p>
          </div>
        </div>

        <datalist id="review-action-options">
          <option
            v-for="option in reviewActionOptionItems"
            :key="option.action"
            :value="option.action"
            :label="reviewActionOptionLabel(option)"
          />
        </datalist>

        <div
          v-if="reviewAnomaliesPending"
          class="space-y-3"
        >
          <USkeleton
            v-for="index in 3"
            :key="index"
            class="h-28 w-full"
          />
        </div>

        <div
          v-else-if="visibleReviewItems.length"
          class="space-y-3"
        >
          <div
            v-for="item in visibleReviewItems"
            :key="item.lineKey"
            class="rounded-lg border border-default p-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge color="neutral" variant="subtle">Row {{ item.rowNumber }}</UBadge>
                  <UBadge
                    v-for="code in item.issueCodes"
                    :key="code"
                    color="warning"
                    variant="subtle"
                  >
                    {{ issueCodeLabel(code) }}
                  </UBadge>
                </div>
                <div>
                  <p class="break-words text-sm font-medium">{{ item.notification ?? item.lineKey }}</p>
                  <p class="mt-1 break-words text-xs text-muted">{{ item.lineKey }}</p>
                </div>
              </div>

              <dl class="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[460px]">
                <div>
                  <dt class="text-muted">Effective action</dt>
                  <dd class="font-medium">{{ item.action.effective ?? '-' }}</dd>
                </div>
                <div>
                  <dt class="text-muted">Category</dt>
                  <dd class="font-medium">{{ item.defectCategory.effective ?? '-' }}</dd>
                </div>
                <div>
                  <dt class="text-muted">Defect</dt>
                  <dd class="font-medium">{{ item.defect.effective ?? '-' }}</dd>
                </div>
              </dl>
            </div>

            <dl class="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div
                v-for="field in reviewSourceFields(item)"
                :key="field.label"
                class="min-w-0"
              >
                <dt class="text-xs text-muted">{{ field.label }}</dt>
                <dd class="mt-1 break-words font-medium">{{ sourceFieldValue(field.value) }}</dd>
              </div>
            </dl>

            <div class="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <UInput
                v-model="item.draft.overrideSymptom"
                placeholder="Override symptom"
                icon="i-lucide-message-square"
              />
              <UInput
                v-model="item.draft.overrideAction"
                placeholder="Override action"
                icon="i-lucide-wrench"
                list="review-action-options"
              />
              <UInput
                v-model="item.draft.note"
                placeholder="Note"
                icon="i-lucide-sticky-note"
              />
              <UButton
                icon="i-lucide-save"
                label="Save"
                color="primary"
                :loading="activeAction === 'override'"
                @click="saveOverride(item)"
              />
            </div>
          </div>
        </div>

        <p
          v-else
          class="text-sm text-muted"
        >
          Tidak ada anomaly raw service untuk scope ini.
        </p>
      </div>
    </UCard>

    <section class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <UCard>
        <template #header>
          <h3 class="font-semibold">Latest Action</h3>
        </template>

        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Import ID</dt>
            <dd class="font-medium">{{ lastImport?.importId ?? '-' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Accepted</dt>
            <dd class="font-medium">{{ formatNumber(lastImport?.acceptedCount) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Rejected</dt>
            <dd class="font-medium">{{ formatNumber(lastImport?.rejectedCount) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Replaced import</dt>
            <dd class="font-medium">{{ lastImport?.replacedImportId ?? '-' }}</dd>
          </div>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold">Import History</h3>
            <UBadge color="neutral" variant="subtle">{{ recentHistory.length }}</UBadge>
          </div>
        </template>

        <div
          v-if="importStatusPending || importHistoryPending"
          class="space-y-3"
        >
          <USkeleton
            v-for="index in 3"
            :key="index"
            class="h-12 w-full"
          />
        </div>

        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full min-w-[620px] text-left text-sm">
            <thead class="border-b border-muted text-xs text-muted">
              <tr>
                <th class="py-2 pr-4 font-medium">Type</th>
                <th class="py-2 pr-4 font-medium">File</th>
                <th class="py-2 pr-4 font-medium">Accepted</th>
                <th class="py-2 pr-4 font-medium">Warnings</th>
                <th class="py-2 pr-4 font-medium">Imported</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-muted">
              <tr
                v-for="item in recentHistory"
                :key="item.id"
              >
                <td class="py-3 pr-4">
                  <UBadge color="neutral" variant="subtle">{{ item.importType }}</UBadge>
                </td>
                <td class="max-w-[260px] truncate py-3 pr-4">{{ item.sourceFilename }}</td>
                <td class="py-3 pr-4">{{ formatNumber(item.acceptedCount) }}</td>
                <td class="py-3 pr-4">{{ formatNumber(item.warningCount) }}</td>
                <td class="py-3 pr-4 text-muted">{{ formatDateTime(item.importedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>
  </div>
</template>
