import { getDb } from '../../db/client'
import {
  createFactoryMappingsRepository,
  createFcostSummariesRepository,
  createFqmsSummariesRepository,
  createImportsRepository,
  createRawSalesRowsRepository,
  createRawServiceLineOverridesRepository,
  createRawServiceRowsRepository,
  createScopesRepository,
  createValidationRunsRepository
} from '../../repositories'
import { importTypes } from '../imports/constants'
import { resolveImportScope } from '../imports/validators'
import { ValidationNotFoundError } from './errors'
import type {
  ValidationIssueInput,
  ValidationIssueSeverity,
  ValidationRunResult,
  ValidationRunStatus,
  ValidationScopeInput
} from './types'

type RawSalesRow = ReturnType<ReturnType<typeof createRawSalesRowsRepository>['findByReportScopeId']>[number]
type RawServiceRow = ReturnType<ReturnType<typeof createRawServiceRowsRepository>['findByReportScopeId']>[number]
type DataImport = ReturnType<ReturnType<typeof createImportsRepository>['findLatestByScopeAndType']>

const claimJobSheetSection = 1

export function runScopeValidation(input: ValidationScopeInput = {}): ValidationRunResult {
  const scopeInput = resolveImportScope(input)
  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ValidationNotFoundError('Selected report scope was not found.', scopeInput)
  }

  return database.transaction((tx) => {
    const importsRepository = createImportsRepository(tx)
    const salesRowsRepository = createRawSalesRowsRepository(tx)
    const serviceRowsRepository = createRawServiceRowsRepository(tx)
    const mappingsRepository = createFactoryMappingsRepository(tx)
    const overridesRepository = createRawServiceLineOverridesRepository(tx)
    const fqmsRepository = createFqmsSummariesRepository(tx)
    const fcostRepository = createFcostSummariesRepository(tx)
    const validationRepository = createValidationRunsRepository(tx)
    const reportScopeId = scopeResult.scope.id

    const salesImport = importsRepository.findLatestByScopeAndType(reportScopeId, importTypes.sales)
    const rawServiceImport = importsRepository.findLatestByScopeAndType(reportScopeId, importTypes.rawService)
    const salesRows = salesRowsRepository.findByReportScopeId(reportScopeId)
    const serviceRows = serviceRowsRepository.findByReportScopeId(reportScopeId)
    const currentSalesRows = salesRows.filter(row => row.salesMonth === scopeInput.monthKey)
    const currentServiceRows = serviceRows.filter(row => row.keydate === scopeInput.monthKey)
    const activeMappings = mappingsRepository.listActiveByScope(
      scopeResult.product.id,
      scopeResult.manufacturer.id,
      scopeInput.monthKey
    )
    const activeFactoryCodes = new Set(activeMappings.map(mapping => mapping.factoryCode))
    const manualOverrideCount = overridesRepository.countByReportScopeId(reportScopeId)
    const fqms = fqmsRepository.findByReportScopeId(reportScopeId)
    const fcost = fcostRepository.findByReportScopeId(reportScopeId)
    const issues: ValidationIssueInput[] = []

    issues.push(...validateImportPresence(salesImport, rawServiceImport))
    issues.push(...validateHeaderResult(salesImport, 'sales'))
    issues.push(...validateHeaderResult(rawServiceImport, 'raw_service'))
    issues.push(...validateReportMonthConsistency(salesRows, serviceRows, scopeInput.monthKey))
    issues.push(...validateMappingCompleteness(currentSalesRows, currentServiceRows, activeFactoryCodes))
    issues.push(...validateReimportSafety(salesImport, rawServiceImport, currentServiceRows, manualOverrideCount))
    issues.push(...validateDenominator(fqms))
    issues.push(...validateFqmsTotal(fqms, currentServiceRows))
    issues.push(...validateFcostTotal(fcost, currentServiceRows))

    const counts = countIssues(issues)
    const status = getRunStatus(counts)
    const exportReady = status !== 'blocked'
    const summary = {
      issueCounts: counts,
      exportReady,
      importStatus: {
        sales: salesImport?.status === 'completed',
        rawService: rawServiceImport?.status === 'completed'
      },
      rawService: {
        currentMonthRows: currentServiceRows.length,
        duplicateLineKeys: countDuplicateLineKeys(currentServiceRows),
        manualOverrideCount
      },
      aggregation: {
        salesQuantity: fqms?.salesQuantity ?? null,
        fqmsClaimQuantity: fqms?.claimQuantity ?? null,
        fcostTotalRupiah: fcost?.totalCostRupiah ?? null
      }
    }

    const run = validationRepository.createRun({
      reportScopeId,
      status,
      criticalCount: counts.critical,
      errorCount: counts.error,
      warningCount: counts.warning,
      summaryJson: JSON.stringify(summary)
    })
    const savedIssues = validationRepository.addIssues(issues.map(issue => ({
      validationRunId: run.id,
      code: issue.code,
      severity: issue.severity,
      reason: issue.reason,
      relatedPage: issue.relatedPage ?? null,
      relatedDataJson: issue.relatedData === undefined ? null : JSON.stringify(issue.relatedData)
    })))

    return {
      reportScopeId,
      monthKey: scopeInput.monthKey,
      productCode: scopeInput.productCode,
      manufacturerCode: scopeInput.manufacturerCode,
      status,
      exportReady,
      run,
      issues: savedIssues,
      summary
    }
  })
}

function validateImportPresence(salesImport: DataImport, rawServiceImport: DataImport): ValidationIssueInput[] {
  const issues: ValidationIssueInput[] = []

  if (salesImport?.status !== 'completed') {
    issues.push({
      code: 'SALES_IMPORT_MISSING',
      severity: 'critical',
      reason: 'Sales import for the selected scope is missing or not completed.',
      relatedPage: '/import'
    })
  }

  if (rawServiceImport?.status !== 'completed') {
    issues.push({
      code: 'RAW_SERVICE_IMPORT_MISSING',
      severity: 'critical',
      reason: 'Raw service import for the selected scope is missing or not completed.',
      relatedPage: '/import'
    })
  }

  return issues
}

function validateHeaderResult(dataImport: DataImport, importType: 'sales' | 'raw_service'): ValidationIssueInput[] {
  if (!dataImport) {
    return []
  }

  const missingHeaders = parseJsonArray(dataImport.missingHeadersJson)

  if (missingHeaders.length > 0) {
    return [{
      code: `${importType.toUpperCase()}_HEADERS_MISSING`,
      severity: 'critical',
      reason: `${importType} import is missing required CSV headers.`,
      relatedPage: '/import',
      relatedData: { importId: dataImport.id, missingHeaders }
    }]
  }

  if (!dataImport.headerJson) {
    return [{
      code: `${importType.toUpperCase()}_HEADERS_NOT_RECORDED`,
      severity: 'warning',
      reason: `${importType} import has no persisted header list for audit.`,
      relatedPage: '/import',
      relatedData: { importId: dataImport.id }
    }]
  }

  return []
}

function validateReportMonthConsistency(
  salesRows: RawSalesRow[],
  serviceRows: RawServiceRow[],
  monthKey: string
): ValidationIssueInput[] {
  const salesOutliers = salesRows.filter(row => row.salesMonth !== monthKey)
  const serviceOutliers = serviceRows.filter(row => row.keydate !== monthKey)
  const issues: ValidationIssueInput[] = []

  if (salesOutliers.length > 0) {
    issues.push({
      code: 'SALES_MONTH_OUTSIDE_REPORT_MONTH',
      severity: 'error',
      reason: 'Sales rows exist outside the selected report month.',
      relatedPage: '/review-anomalies',
      relatedData: sampleRows(salesOutliers)
    })
  }

  if (serviceOutliers.length > 0) {
    issues.push({
      code: 'RAW_SERVICE_KEYDATE_OUTSIDE_REPORT_MONTH',
      severity: 'check',
      reason: 'Some raw service rows have keydate outside the selected report month.',
      relatedPage: '/review-anomalies',
      relatedData: sampleRows(serviceOutliers)
    })
  }

  return issues
}

function validateMappingCompleteness(
  salesRows: RawSalesRow[],
  serviceRows: RawServiceRow[],
  activeFactoryCodes: Set<string>
): ValidationIssueInput[] {
  const issues: ValidationIssueInput[] = []
  const salesMissingModel = salesRows.filter(row => !row.modelCode)
  const serviceMissingModel = serviceRows.filter(row => !row.modelCode)
  const rowsOutsideMappings = [...salesRows, ...serviceRows]
    .filter(row => !row.factoryCode || !activeFactoryCodes.has(row.factoryCode))

  if (activeFactoryCodes.size === 0) {
    issues.push({
      code: 'FACTORY_MAPPING_MISSING',
      severity: 'critical',
      reason: 'No active factory mappings exist for the selected scope.',
      relatedPage: '/review-anomalies'
    })
  }

  if (rowsOutsideMappings.length > 0) {
    issues.push({
      code: 'FACTORY_MAPPING_INCOMPLETE',
      severity: 'warning',
      reason: 'Rows exist without an active factory mapping for the selected scope.',
      relatedPage: '/review-anomalies',
      relatedData: sampleRows(rowsOutsideMappings)
    })
  }

  if (salesMissingModel.length > 0 || serviceMissingModel.length > 0) {
    issues.push({
      code: 'MODEL_MAPPING_INCOMPLETE',
      severity: 'check',
      reason: 'Rows exist without a report model value.',
      relatedPage: '/review-anomalies',
      relatedData: {
        salesRows: sampleRows(salesMissingModel),
        rawServiceRows: sampleRows(serviceMissingModel)
      }
    })
  }

  return issues
}

function validateReimportSafety(
  salesImport: DataImport,
  rawServiceImport: DataImport,
  serviceRows: RawServiceRow[],
  manualOverrideCount: number
): ValidationIssueInput[] {
  const issues: ValidationIssueInput[] = []
  const duplicateLineKeys = countDuplicateLineKeys(serviceRows)

  for (const dataImport of [salesImport, rawServiceImport]) {
    if (dataImport?.replacedImportId) {
      issues.push({
        code: `${dataImport.importType.toUpperCase()}_REIMPORT_REPLACED_PREVIOUS_IMPORT`,
        severity: 'check',
        reason: 'Latest import replaced a previous import for the same scope.',
        relatedPage: '/import',
        relatedData: { importId: dataImport.id, replacedImportId: dataImport.replacedImportId }
      })
    }
  }

  if (duplicateLineKeys > 0) {
    issues.push({
      code: 'RAW_SERVICE_DUPLICATE_LINE_KEY',
      severity: 'warning',
      reason: 'Raw service rows contain duplicate notification line keys.',
      relatedPage: '/review-anomalies',
      relatedData: { duplicateLineKeys }
    })
  }

  if (manualOverrideCount > 0) {
    issues.push({
      code: 'RAW_SERVICE_HAS_MANUAL_OVERRIDE',
      severity: 'check',
      reason: 'Raw service line-level manual overrides exist and must be reviewed before re-import.',
      relatedPage: '/review-anomalies',
      relatedData: { manualOverrideCount }
    })
  }

  return issues
}

function validateDenominator(fqms: ReturnType<ReturnType<typeof createFqmsSummariesRepository>['findByReportScopeId']>): ValidationIssueInput[] {
  if (!fqms) {
    return [{
      code: 'FQMS_SUMMARY_MISSING',
      severity: 'critical',
      reason: 'FQMS summary has not been generated for the selected scope.',
      relatedPage: '/validation'
    }]
  }

  if (fqms.salesQuantity <= 0) {
    return [{
      code: 'FQMS_DENOMINATOR_MISSING_OR_ZERO',
      severity: 'critical',
      reason: 'FQMS sales denominator is missing or zero.',
      relatedPage: '/validation',
      relatedData: { salesQuantity: fqms.salesQuantity }
    }]
  }

  return []
}

function validateFqmsTotal(
  fqms: ReturnType<ReturnType<typeof createFqmsSummariesRepository>['findByReportScopeId']>,
  serviceRows: RawServiceRow[]
): ValidationIssueInput[] {
  if (!fqms) {
    return []
  }

  const issues: ValidationIssueInput[] = []
  const claimRows = serviceRows.filter(row => row.jobSheetSection === claimJobSheetSection)
  const details = parseJsonObject(fqms.summaryJson)
  const unclassified = Number(details.unclassifiedClaimRows ?? 0)
  const storedTotal = fqms.defectCount + fqms.nonDefectCount + unclassified

  if (fqms.claimQuantity !== claimRows.length) {
    issues.push({
      code: 'FQMS_CLAIM_TOTAL_MISMATCH',
      severity: 'error',
      reason: 'Stored FQMS claim quantity does not match current raw service claim rows.',
      relatedPage: '/validation',
      relatedData: { storedClaimQuantity: fqms.claimQuantity, rawClaimRows: claimRows.length }
    })
  }

  if (fqms.claimQuantity !== storedTotal) {
    issues.push({
      code: 'FQMS_DEFECT_TOTAL_MISMATCH',
      severity: 'error',
      reason: 'FQMS claim quantity does not equal defect + non-defect + unclassified count.',
      relatedPage: '/validation',
      relatedData: {
        claimQuantity: fqms.claimQuantity,
        defectCount: fqms.defectCount,
        nonDefectCount: fqms.nonDefectCount,
        unclassifiedClaimRows: unclassified
      }
    })
  }

  return issues
}

function validateFcostTotal(
  fcost: ReturnType<ReturnType<typeof createFcostSummariesRepository>['findByReportScopeId']>,
  serviceRows: RawServiceRow[]
): ValidationIssueInput[] {
  if (!fcost) {
    return [{
      code: 'FCOST_SUMMARY_MISSING',
      severity: 'critical',
      reason: 'F-COST summary has not been generated for the selected scope.',
      relatedPage: '/validation'
    }]
  }

  const itemCostTotal = serviceRows.reduce((total, row) => (
    total + row.partsCost + row.laborCost + row.transportationCost
  ), 0)

  if (fcost.totalCostRupiah !== itemCostTotal) {
    return [{
      code: 'FCOST_TOTAL_MISMATCH',
      severity: 'error',
      reason: 'Stored F-COST total does not match current raw service item costs.',
      relatedPage: '/validation',
      relatedData: { storedTotalRupiah: fcost.totalCostRupiah, itemCostTotalRupiah: itemCostTotal }
    }]
  }

  const details = parseJsonObject(fcost.summaryJson)
  const difference = Number(details.totalCostDifferenceRupiah ?? 0)

  if (difference !== 0) {
    return [{
      code: 'FCOST_RAW_TOTAL_CROSS_CHECK_FAILED',
      severity: 'error',
      reason: 'Raw total_cost does not match parts + labor + transportation cost.',
      relatedPage: '/validation',
      relatedData: { totalCostDifferenceRupiah: difference }
    }]
  }

  return []
}

function countIssues(issues: ValidationIssueInput[]): Record<ValidationIssueSeverity, number> {
  return issues.reduce<Record<ValidationIssueSeverity, number>>((counts, issue) => {
    counts[issue.severity] += 1
    return counts
  }, { critical: 0, error: 0, warning: 0, check: 0 })
}

function getRunStatus(counts: Record<ValidationIssueSeverity, number>): ValidationRunStatus {
  if (counts.critical > 0 || counts.error > 0) {
    return 'blocked'
  }

  if (counts.warning > 0 || counts.check > 0) {
    return 'check'
  }

  return 'ok'
}

function countDuplicateLineKeys(rows: RawServiceRow[]) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (row.lineKey) {
      counts.set(row.lineKey, (counts.get(row.lineKey) ?? 0) + 1)
    }
  }

  return [...counts.values()].filter(count => count > 1).length
}

function parseJsonArray(value: string | null) {
  if (!value) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

function sampleRows(rows: Array<{ id: number, rowNumber: number }>) {
  return {
    count: rows.length,
    rows: rows.slice(0, 10).map(row => ({ id: row.id, rowNumber: row.rowNumber }))
  }
}
