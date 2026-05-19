import { createHash } from 'node:crypto'

import { ImportValidationError } from './errors'
import type { CsvRecord, RawServiceRowInsert, SalesRowInsert } from './types'

export type ActionClassification = {
  category: string
  defect: string
}

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

export function normalizeSalesRow(record: CsvRecord, rowNumber: number, importId: number, reportScopeId: number): SalesRowInsert {
  const quantity = parseRequiredInteger(record['Sales (Qty)'], 'Sales (Qty)', rowNumber)
  const sourceModel = parseRequiredText(record.Model, 'Model', rowNumber)
  const reportModel = parseRequiredText(record['Report Model'], 'Report Model', rowNumber)
  const salesMonth = normalizeSalesMonth(record['Sales Month'], rowNumber)

  return {
    importId,
    reportScopeId,
    rowNumber,
    salesMonth,
    factoryCode: normalizeText(record.Factory),
    modelCode: sourceModel,
    modelName: reportModel,
    quantity,
    rawJson: stringifyRawRow(record)
  }
}

export function normalizeRawServiceRow(
  record: CsvRecord,
  rowNumber: number,
  importId: number,
  reportScopeId: number,
  lineNumberWithinNotification: number,
  actionClassifications = new Map<string, ActionClassification>()
): RawServiceRowInsert {
  const keydate = normalizeText(record.keydate)
  const notification = normalizeText(record.notification)
  const jobSheetSection = parseOptionalInteger(record.job_sheet_section, 'job_sheet_section', rowNumber)
  const partCode = normalizeText(record.part_used)
  const action = normalizeCode(record.action)
  const actionClassification = actionClassifications.get(action)
  const lineKey = notification
    ? createRawServiceLineKey(notification, jobSheetSection, partCode, lineNumberWithinNotification)
    : null

  if (!keydate) {
    throw new ImportValidationError('Raw service row is missing keydate.', { rowNumber })
  }

  return {
    importId,
    reportScopeId,
    rowNumber,
    notification,
    lineKey,
    rowHash: hashCsvRecord(record),
    keydate,
    factoryCode: normalizeText(record.factory),
    modelCode: normalizeText(record.model_series),
    modelName: normalizeText(record.model_name),
    jobSheetSection,
    symptomCode: normalizeText(record.symptom_code),
    symptomName: normalizeText(record.symptom),
    action,
    sourceDefectCategory: actionClassification?.category ?? normalizeCode(record.defect_category),
    sourceDefect: actionClassification?.defect ?? normalizeCode(record.defect),
    partsCost: parseOptionalInteger(record.parts_cost, 'parts_cost', rowNumber) ?? 0,
    laborCost: parseOptionalInteger(record.labor_cost, 'labor_cost', rowNumber) ?? 0,
    transportationCost: parseOptionalInteger(record.transportation_cost, 'transportation_cost', rowNumber) ?? 0,
    totalCost: parseOptionalInteger(record.total_cost, 'total_cost', rowNumber) ?? 0,
    rawJson: stringifyRawRow(record)
  }
}

export function normalizeSalesMonth(value: string | undefined, rowNumber: number) {
  const normalized = (value ?? '').trim()

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized.replace('-', '')
  }

  if (/^\d{6}$/.test(normalized)) {
    return normalized
  }

  throw new ImportValidationError('Sales Month must use YYYY-MM format.', {
    rowNumber,
    field: 'Sales Month',
    value
  })
}

export function createRawServiceLineKey(notification: string, jobSheetSection: number | null, partCode: string | null, lineNumberWithinNotification: number) {
  return [
    normalizeCode(notification),
    jobSheetSection?.toString() ?? 'NO_SECTION',
    normalizeCode(partCode ?? 'NO_PART'),
    lineNumberWithinNotification.toString().padStart(4, '0')
  ].join('|')
}

function hashCsvRecord(record: CsvRecord) {
  const canonical = Object
    .keys(record)
    .sort()
    .map(key => [key, record[key] ?? ''])

  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex')
}

function parseRequiredInteger(value: string | undefined, field: string, rowNumber: number) {
  const parsed = parseOptionalInteger(value, field, rowNumber)

  if (parsed === null) {
    throw new ImportValidationError(`CSV row ${rowNumber} is missing required numeric field ${field}.`, { rowNumber, field })
  }

  return parsed
}

function parseRequiredText(value: string | undefined, field: string, rowNumber: number) {
  const normalized = normalizeText(value)

  if (normalized === null) {
    throw new ImportValidationError(`CSV row ${rowNumber} is missing required field ${field}.`, { rowNumber, field })
  }

  return normalized
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
