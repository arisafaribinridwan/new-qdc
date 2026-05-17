import { ImportValidationError } from './errors'
import type { CsvRecord, RawServiceRowInsert, SalesRowInsert } from './types'

export function normalizeCode(value: string | undefined) {
  return (value ?? '').trim().toUpperCase()
}

export function normalizeText(value: string | undefined) {
  const normalized = (value ?? '').trim()
  return normalized.length > 0 ? normalized : null
}

export function stringifyRawRow(record: CsvRecord) {
  return JSON.stringify(record)
}

export function normalizeSalesRow(record: CsvRecord, rowNumber: number, importId: number, reportScopeId: number, salesMonth: string): SalesRowInsert {
  const quantity = parseRequiredInteger(record['Sales (Qty)'], 'Sales (Qty)', rowNumber)

  return {
    importId,
    reportScopeId,
    rowNumber,
    salesMonth,
    factoryCode: normalizeText(record.Factory),
    modelCode: null,
    modelName: normalizeText(record.Model),
    quantity,
    rawJson: stringifyRawRow(record)
  }
}

export function normalizeRawServiceRow(record: CsvRecord, rowNumber: number, importId: number, reportScopeId: number): RawServiceRowInsert {
  const keydate = normalizeText(record.keydate)

  if (!keydate) {
    throw new ImportValidationError('Raw service row is missing keydate.', { rowNumber })
  }

  return {
    importId,
    reportScopeId,
    rowNumber,
    keydate,
    factoryCode: normalizeText(record.factory),
    modelCode: normalizeText(record.model_series),
    modelName: normalizeText(record.model_name),
    jobSheetSection: parseOptionalInteger(record.job_sheet_section, 'job_sheet_section', rowNumber),
    symptomCode: normalizeText(record.symptom_code),
    symptomName: normalizeText(record.symptom),
    partsCost: parseOptionalInteger(record.parts_cost, 'parts_cost', rowNumber) ?? 0,
    laborCost: parseOptionalInteger(record.labor_cost, 'labor_cost', rowNumber) ?? 0,
    transportationCost: parseOptionalInteger(record.transportation_cost, 'transportation_cost', rowNumber) ?? 0,
    totalCost: parseOptionalInteger(record.total_cost, 'total_cost', rowNumber) ?? 0,
    rawJson: stringifyRawRow(record)
  }
}

function parseRequiredInteger(value: string | undefined, field: string, rowNumber: number) {
  const parsed = parseOptionalInteger(value, field, rowNumber)

  if (parsed === null) {
    throw new ImportValidationError(`CSV row ${rowNumber} is missing required numeric field ${field}.`, { rowNumber, field })
  }

  return parsed
}

function parseOptionalInteger(value: string | undefined, field: string, rowNumber: number) {
  const normalized = (value ?? '').trim()

  if (normalized.length === 0) {
    return null
  }

  const numeric = Number.parseInt(normalized.replace(/[,.\s]/g, ''), 10)

  if (Number.isNaN(numeric)) {
    throw new ImportValidationError(`CSV row ${rowNumber} has invalid numeric field ${field}.`, { rowNumber, field, value })
  }

  return numeric
}
