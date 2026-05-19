import { getDb } from '../../db/client'
import { createImportsRepository, createRawServiceLineOverridesRepository, createScopesRepository } from '../../repositories'
import { importTypes } from './constants'
import type { ImportHistoryItem, ImportStatus, ImportStatusItem, ImportHistoryFilters } from './types'
import { resolveImportScope } from './validators'

export function getImportStatus(filters: ImportHistoryFilters = {}): ImportStatus {
  const resolvedFilters = resolveImportScope(filters)
  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    resolvedFilters.monthKey,
    resolvedFilters.productCode,
    resolvedFilters.manufacturerCode
  )

  const history = createImportsRepository(database)
    .listWithScope()
    .filter(item =>
      item.product.code === resolvedFilters.productCode
      && item.manufacturer.code === resolvedFilters.manufacturerCode
    )
    .map(toHistoryItem)

  const imports = {
    [importTypes.sales]: buildStatusItem(history, importTypes.sales, resolvedFilters.monthKey),
    [importTypes.rawService]: buildStatusItem(history, importTypes.rawService, resolvedFilters.monthKey)
  }

  const manualOverrideCount = scopeResult
    ? createRawServiceLineOverridesRepository(database).countByReportScopeId(scopeResult.scope.id)
    : 0

  return {
    monthKey: resolvedFilters.monthKey,
    productCode: resolvedFilters.productCode,
    manufacturerCode: resolvedFilters.manufacturerCode,
    reportScopeId: scopeResult?.scope.id ?? null,
    imports,
    rawService: {
      manualOverrideCount
    }
  }
}

function buildStatusItem(history: ImportHistoryItem[], importType: ImportHistoryItem['importType'], monthKey: string): ImportStatusItem {
  const sameTypeHistory = history
    .filter(item => item.importType === importType && item.status === 'completed')
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey) || right.importedAt.localeCompare(left.importedAt))
  const currentMonthImport = sameTypeHistory.find(item => item.monthKey === monthKey) ?? null
  const lastImport = sameTypeHistory[0] ?? null

  return {
    importType,
    hasCurrentMonthImport: currentMonthImport !== null,
    currentMonthImport,
    lastImportedMonth: lastImport?.monthKey ?? null,
    lastImport
  }
}

function toHistoryItem(item: ReturnType<ReturnType<typeof createImportsRepository>['listWithScope']>[number]): ImportHistoryItem {
  return {
    id: item.import.id,
    reportScopeId: item.import.reportScopeId,
    monthKey: item.reportMonth.monthKey,
    productCode: item.product.code,
    manufacturerCode: item.manufacturer.code,
    importType: item.import.importType,
    sourceFilename: item.import.sourceFilename,
    mode: item.import.mode,
    status: item.import.status,
    rowCount: item.import.rowCount,
    acceptedCount: item.import.acceptedCount,
    rejectedCount: item.import.rejectedCount,
    warningCount: item.import.warningCount,
    headerJson: item.import.headerJson,
    missingHeadersJson: item.import.missingHeadersJson,
    warningJson: item.import.warningJson,
    replacedImportId: item.import.replacedImportId,
    importedAt: item.import.importedAt
  }
}
