import type { exportJobs } from '../db/schema'
import type { FqmsAccumulatedReportViewModel } from '../services/fqmsAccumulated'
import type { ValidationRunResult } from '../services/validation'

export type ReportScopeInput = {
  monthKey?: string
  productCode?: string
  manufacturerCode?: string
}

export type ReportViewModel = {
  reportScopeId: number
  generatedAt: string
  scope: {
    monthKey: string
    monthLabel: string
    calendarYear: number
    calendarMonth: number
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
    source: 'accumulated' | 'monthly_summary'
    status: 'ok' | 'check'
    salesQuantity: number
    claimQuantity: number
    defectCount: number
    nonDefectCount: number
    unclassifiedClaimRows: number
    ppm: number | null
    denominatorStatus: 'ok' | 'missing_or_zero'
    computedAt: string
    accumulated: FqmsAccumulatedReportViewModel | null
    monthly: {
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

export type ReportExportType = typeof exportJobs.$inferSelect.exportType
export type ReportExportRequestType = ReportExportType | 'all'

export type ReportExportResult = {
  reportScopeId: number
  validation: {
    runId: number
    status: ValidationRunResult['status']
    exportReady: boolean
  }
  exports: Array<{
    exportJobId: number
    exportType: ReportExportType
    outputPath: string
  }>
}

export type ReportExportStatus = {
  reportScopeId: number
  exported: boolean
  latestByType: Record<ReportExportType, typeof exportJobs.$inferSelect | null>
  jobs: Array<typeof exportJobs.$inferSelect>
}
