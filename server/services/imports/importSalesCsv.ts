import { getDb } from '../../db/client'
import { createFactoryMappingsRepository, createImportsRepository, createRawSalesRowsRepository, createScopesRepository } from '../../repositories'
import { importTypes, salesRequiredHeaders } from './constants'
import { parseCsv } from './csv'
import { ImportNotFoundError, ImportValidationError } from './errors'
import { normalizeSalesRow } from './normalizers'
import type { ImportCsvInput, ImportSummary } from './types'
import { filterRecordsByFactoryMapping, indexRecords, resolveImportScope, validateRequiredHeaders, validateSalesMonths } from './validators'

export async function importSalesCsv(input: ImportCsvInput): Promise<ImportSummary> {
  const scopeInput = resolveImportScope(input)
  const parsedCsv = await parseCsv(input.content, salesRequiredHeaders)

  validateRequiredHeaders(parsedCsv.headers, salesRequiredHeaders)

  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ImportNotFoundError('Selected report scope was not found.', scopeInput)
  }

  const activeFactoryMappings = createFactoryMappingsRepository(database).listActiveByScope(
    scopeResult.product.id,
    scopeResult.manufacturer.id,
    scopeInput.monthKey
  )

  if (activeFactoryMappings.length === 0) {
    throw new ImportValidationError('Selected report scope has no active factory mappings.', scopeInput)
  }

  const filtered = filterRecordsByFactoryMapping(
    indexRecords(parsedCsv.records, parsedCsv.headerRowNumber + 1),
    'Factory',
    activeFactoryMappings.map(mapping => mapping.factoryCode)
  )
  const warnings = filtered.warnings
  validateSalesMonths(filtered.accepted, scopeInput.monthKey)

  return database.transaction((tx) => {
    const importsRepository = createImportsRepository(tx)
    const rawSalesRowsRepository = createRawSalesRowsRepository(tx)
    const previousImport = importsRepository.findLatestByScopeAndType(scopeResult.scope.id, importTypes.sales)
    const createdImport = importsRepository.create({
      reportScopeId: scopeResult.scope.id,
      importType: importTypes.sales,
      sourceFilename: input.filename,
      mode: 'replace',
      status: 'pending',
      rowCount: parsedCsv.records.length,
      acceptedCount: 0,
      rejectedCount: 0,
      warningCount: 0,
      headerJson: JSON.stringify(parsedCsv.headers),
      missingHeadersJson: JSON.stringify([]),
      warningJson: JSON.stringify([]),
      replacedImportId: previousImport?.id ?? null
    })

    if (previousImport) {
      rawSalesRowsRepository.deleteByImportId(previousImport.id)
    }

    rawSalesRowsRepository.insertMany(filtered.accepted.map(item => normalizeSalesRow(
      item.record,
      item.rowNumber,
      createdImport.id,
      scopeResult.scope.id
    )))

    const completedImport = importsRepository.update(createdImport.id, {
      status: 'completed',
      rowCount: parsedCsv.records.length,
      acceptedCount: filtered.accepted.length,
      rejectedCount: filtered.rejected.length,
      warningCount: warnings.length,
      warningJson: JSON.stringify(warnings)
    })

    return {
      importId: completedImport.id,
      reportScopeId: scopeResult.scope.id,
      importType: completedImport.importType,
      sourceFilename: completedImport.sourceFilename,
      status: completedImport.status,
      rowCount: completedImport.rowCount,
      acceptedCount: completedImport.acceptedCount,
      rejectedCount: completedImport.rejectedCount,
      warningCount: completedImport.warningCount,
      replacedImportId: completedImport.replacedImportId,
      warnings
    }
  })
}
