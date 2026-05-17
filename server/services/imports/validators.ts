import { defaultImportScope } from './constants'
import { ImportValidationError } from './errors'
import { normalizeCode } from './normalizers'
import type { CsvRecord, ImportScopeInput, ImportWarning } from './types'

export type ResolvedImportScope = {
  monthKey: string
  productCode: string
  manufacturerCode: string
}

export type IndexedCsvRecord = {
  rowNumber: number
  record: CsvRecord
}

export function resolveImportScope(input: ImportScopeInput): ResolvedImportScope {
  const scope = {
    monthKey: input.monthKey?.trim() || defaultImportScope.monthKey,
    productCode: input.productCode?.trim().toUpperCase() || defaultImportScope.productCode,
    manufacturerCode: input.manufacturerCode?.trim().toUpperCase() || defaultImportScope.manufacturerCode
  }

  validateMonthKey(scope.monthKey)

  return scope
}

export function validateMonthKey(monthKey: string) {
  if (!/^\d{6}$/.test(monthKey)) {
    throw new ImportValidationError('monthKey must use YYYYMM format.', { monthKey })
  }
}

export function validateRequiredHeaders(headers: string[], requiredHeaders: readonly string[]) {
  const headerSet = new Set(headers)
  const missingHeaders = requiredHeaders.filter(header => !headerSet.has(header))

  if (missingHeaders.length > 0) {
    throw new ImportValidationError('CSV file is missing required headers.', { missingHeaders })
  }
}

export function indexRecords(records: CsvRecord[], firstDataRowNumber = 2): IndexedCsvRecord[] {
  return records.map((record, index) => ({
    rowNumber: index + firstDataRowNumber,
    record
  }))
}

export function filterRecordsByFactoryMapping(records: IndexedCsvRecord[], factoryField: string, activeFactoryCodes: string[]) {
  const activeFactoryCodeSet = new Set(activeFactoryCodes.map(normalizeCode))
  const accepted: IndexedCsvRecord[] = []
  const rejected: IndexedCsvRecord[] = []

  for (const item of records) {
    const factoryCode = normalizeCode(item.record[factoryField])

    if (factoryCode && activeFactoryCodeSet.has(factoryCode)) {
      accepted.push(item)
    }
    else {
      rejected.push(item)
    }
  }

  if (accepted.length === 0) {
    throw new ImportValidationError('CSV file has no rows matching active factory mappings for the selected scope.', {
      activeFactoryCodes,
      rejectedCount: rejected.length
    })
  }

  return {
    accepted,
    rejected,
    warnings: createRejectedFactoryWarning(rejected)
  }
}

export function validateRawServiceKeydates(records: IndexedCsvRecord[], monthKey: string): ImportWarning[] {
  const mismatchedRows = records
    .filter(item => item.record.keydate?.trim() !== monthKey)
    .map(item => item.rowNumber)

  if (mismatchedRows.length === 0) {
    return []
  }

  const matchingCount = records.length - mismatchedRows.length

  if (mismatchedRows.length > matchingCount) {
    throw new ImportValidationError('Most raw service rows have keydate outside the selected report month.', {
      monthKey,
      mismatchedCount: mismatchedRows.length,
      matchingCount,
      sampleRows: mismatchedRows.slice(0, 10)
    })
  }

  return [{
    code: 'raw_service_keydate_outlier',
    reason: 'Some raw service rows have keydate outside the selected report month.',
    rows: mismatchedRows.slice(0, 10),
    count: mismatchedRows.length
  }]
}

function createRejectedFactoryWarning(rejected: IndexedCsvRecord[]): ImportWarning[] {
  if (rejected.length === 0) {
    return []
  }

  return [{
    code: 'factory_not_in_scope',
    reason: 'Rows outside active factory mappings were ignored for the selected scope.',
    rows: rejected.slice(0, 10).map(item => item.rowNumber),
    count: rejected.length
  }]
}
