import type { validationIssues, validationRuns } from '../../db/schema'

export type ValidationScopeInput = {
  monthKey?: string
  productCode?: string
  manufacturerCode?: string
}

export type ValidationIssueSeverity = typeof validationIssues.$inferSelect.severity
export type ValidationRunStatus = typeof validationRuns.$inferSelect.status

export type ValidationIssueInput = {
  code: string
  severity: ValidationIssueSeverity
  reason: string
  relatedPage?: string
  relatedData?: unknown
}

export type ValidationRunResult = {
  reportScopeId: number
  monthKey: string
  productCode: string
  manufacturerCode: string
  status: ValidationRunStatus
  exportReady: boolean
  run: typeof validationRuns.$inferSelect
  issues: Array<typeof validationIssues.$inferSelect>
  summary: ValidationRunSummary
}

export type ValidationRunSummary = {
  issueCounts: Record<ValidationIssueSeverity, number>
  exportReady: boolean
  importStatus: {
    sales: boolean
    rawService: boolean
  }
  rawService: {
    currentMonthRows: number
    duplicateLineKeys: number
    manualOverrideCount: number
    stagingCompare: Record<RawServiceStagingStatusCode, number>
  }
  aggregation: {
    salesQuantity: number | null
    fqmsClaimQuantity: number | null
    fcostTotalRupiah: number | null
  }
}

export type RawServiceStagingStatusCode =
  | 'NEW_NOTIFICATION'
  | 'DUPLICATE_UNCHANGED'
  | 'SOURCE_CHANGED'
  | 'LINE_COUNT_CHANGED'
  | 'HAS_MANUAL_OVERRIDE'
  | 'OVERRIDE_CONFLICT'
