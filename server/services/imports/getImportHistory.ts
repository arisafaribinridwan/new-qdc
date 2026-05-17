import { createImportsRepository } from '../../repositories'
import { resolveImportScope } from './validators'
import type { ImportHistoryFilters, ImportHistoryItem } from './types'

export function getImportHistory(filters: ImportHistoryFilters = {}): ImportHistoryItem[] {
  const hasExplicitFilters = Boolean(filters.monthKey || filters.productCode || filters.manufacturerCode)
  const resolvedFilters = hasExplicitFilters ? resolveImportScope(filters) : null

  return createImportsRepository()
    .listWithScope()
    .filter((item) => {
      if (!resolvedFilters) {
        return true
      }

      return item.reportMonth.monthKey === resolvedFilters.monthKey
        && item.product.code === resolvedFilters.productCode
        && item.manufacturer.code === resolvedFilters.manufacturerCode
    })
    .map(item => ({
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
    }))
}
