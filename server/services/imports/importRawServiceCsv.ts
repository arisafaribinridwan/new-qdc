import { getDb } from '../../db/client'
import type { rawServiceLineOverrides, rawServiceRows } from '../../db/schema'
import {
  createFactoryMappingsRepository,
  createImportsRepository,
  createMasterActionsRepository,
  createRawServiceLineOverridesRepository,
  createRawServiceRowsRepository,
  createScopesRepository
} from '../../repositories'
import { importTypes, rawServiceRequiredHeaders } from './constants'
import { parseCsv } from './csv'
import { ImportNotFoundError, ImportValidationError } from './errors'
import { normalizeRawServiceRow } from './normalizers'
import type { ImportCsvInput, ImportSummary, ImportWarning, RawServiceRowInsert } from './types'
import { filterRecordsByFactoryMapping, indexRecords, resolveImportScope, validateRawServiceKeydates, validateRequiredHeaders } from './validators'

type ExistingRawServiceRow = typeof rawServiceRows.$inferSelect
type RawServiceLineOverride = typeof rawServiceLineOverrides.$inferSelect

const rawServiceStagingStatusCodes = {
  newNotification: 'NEW_NOTIFICATION',
  duplicateUnchanged: 'DUPLICATE_UNCHANGED',
  sourceChanged: 'SOURCE_CHANGED',
  lineCountChanged: 'LINE_COUNT_CHANGED',
  hasManualOverride: 'HAS_MANUAL_OVERRIDE',
  overrideConflict: 'OVERRIDE_CONFLICT'
} as const

export async function importRawServiceCsv(input: ImportCsvInput): Promise<ImportSummary> {
  const scopeInput = resolveImportScope(input)
  const parsedCsv = await parseCsv(input.content, rawServiceRequiredHeaders)

  validateRequiredHeaders(parsedCsv.headers, rawServiceRequiredHeaders)

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
    'factory',
    activeFactoryMappings.map(mapping => mapping.factoryCode)
  )
  const warnings = [
    ...filtered.warnings,
    ...validateRawServiceKeydates(filtered.accepted, scopeInput.monthKey)
  ]

  return database.transaction((tx) => {
    const importsRepository = createImportsRepository(tx)
    const masterActionsRepository = createMasterActionsRepository(tx)
    const overridesRepository = createRawServiceLineOverridesRepository(tx)
    const rawServiceRowsRepository = createRawServiceRowsRepository(tx)
    const previousImport = importsRepository.findLatestByScopeAndType(scopeResult.scope.id, importTypes.rawService)
    const createdImport = importsRepository.create({
      reportScopeId: scopeResult.scope.id,
      importType: importTypes.rawService,
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

    const lineCountsByNotification = new Map<string, number>()
    const actionClassifications = new Map(
      masterActionsRepository
        .listActive()
        .map(action => [action.action, { category: action.category, defect: action.defect }])
    )
    const normalizedRows = filtered.accepted.map((item) => {
      const notification = item.record.notification?.trim().toUpperCase() || `ROW_${item.rowNumber}`
      const lineNumberWithinNotification = (lineCountsByNotification.get(notification) ?? 0) + 1
      lineCountsByNotification.set(notification, lineNumberWithinNotification)

      return normalizeRawServiceRow(
        item.record,
        item.rowNumber,
        createdImport.id,
        scopeResult.scope.id,
        lineNumberWithinNotification,
        actionClassifications
      )
    })
    const previousRows = previousImport ? rawServiceRowsRepository.findByImportId(previousImport.id) : []
    const manualOverrides = overridesRepository.listByReportScopeId(scopeResult.scope.id)
    const stagingWarnings = buildRawServiceStagingWarnings(normalizedRows, previousRows, manualOverrides)
    const importWarnings = [...warnings, ...stagingWarnings]

    if (previousImport) {
      rawServiceRowsRepository.deleteByImportId(previousImport.id)
    }

    rawServiceRowsRepository.insertMany(normalizedRows)

    const completedImport = importsRepository.update(createdImport.id, {
      status: 'completed',
      rowCount: parsedCsv.records.length,
      acceptedCount: filtered.accepted.length,
      rejectedCount: filtered.rejected.length,
      warningCount: importWarnings.length,
      warningJson: JSON.stringify(importWarnings)
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
      warnings: importWarnings
    }
  })
}

function buildRawServiceStagingWarnings(
  newRows: RawServiceRowInsert[],
  previousRows: ExistingRawServiceRow[],
  manualOverrides: RawServiceLineOverride[]
): ImportWarning[] {
  if (previousRows.length === 0) {
    return manualOverrides.length > 0
      ? [createStatusWarning(rawServiceStagingStatusCodes.hasManualOverride, 'Manual overrides exist for this scope.', manualOverrides.length)]
      : []
  }

  const previousByLineKey = mapRowsByLineKey(previousRows)
  const previousNotificationCounts = countRowsByNotification(previousRows)
  const newNotificationCounts = countRowsByNotification(newRows)
  const manualOverridesByLineKey = new Map(manualOverrides.map(override => [override.lineKey, override]))
  const changedRows: RawServiceRowInsert[] = []
  const unchangedRows: RawServiceRowInsert[] = []
  const newNotificationRows: RawServiceRowInsert[] = []
  const overrideConflictRows: RawServiceRowInsert[] = []

  for (const row of newRows) {
    if (row.notification && !previousNotificationCounts.has(row.notification)) {
      newNotificationRows.push(row)
    }

    if (!row.lineKey) {
      continue
    }

    const previousRow = previousByLineKey.get(row.lineKey)

    if (!previousRow) {
      if (row.notification && previousNotificationCounts.has(row.notification)) {
        changedRows.push(row)
      }

      continue
    }

    if (previousRow.rowHash === row.rowHash) {
      unchangedRows.push(row)
      continue
    }

    changedRows.push(row)

    if (manualOverridesByLineKey.has(row.lineKey) && sourceOverrideFieldsChanged(row, previousRow)) {
      overrideConflictRows.push(row)
    }
  }

  const lineCountChanged = [...new Set([...previousNotificationCounts.keys(), ...newNotificationCounts.keys()])]
    .filter(notification => previousNotificationCounts.has(notification) && previousNotificationCounts.get(notification) !== (newNotificationCounts.get(notification) ?? 0))
    .map(notification => ({
      notification,
      previousCount: previousNotificationCounts.get(notification) ?? 0,
      currentCount: newNotificationCounts.get(notification) ?? 0
    }))
  const warnings: ImportWarning[] = []

  if (newNotificationRows.length > 0) {
    warnings.push(createStatusWarning(
      rawServiceStagingStatusCodes.newNotification,
      'Raw service re-import contains notifications that were not present in the previous import.',
      newNotificationRows.length,
      sampleRawServiceRows(newNotificationRows)
    ))
  }

  if (unchangedRows.length > 0) {
    warnings.push(createStatusWarning(
      rawServiceStagingStatusCodes.duplicateUnchanged,
      'Raw service re-import contains unchanged notification lines from the previous import.',
      unchangedRows.length
    ))
  }

  if (changedRows.length > 0) {
    warnings.push(createStatusWarning(
      rawServiceStagingStatusCodes.sourceChanged,
      'Raw service re-import contains notification lines whose source row changed.',
      changedRows.length,
      sampleRawServiceRows(changedRows)
    ))
  }

  if (lineCountChanged.length > 0) {
    warnings.push(createStatusWarning(
      rawServiceStagingStatusCodes.lineCountChanged,
      'Raw service re-import changed the line count for existing notifications.',
      lineCountChanged.length,
      { notifications: lineCountChanged.slice(0, 10) }
    ))
  }

  if (manualOverrides.length > 0) {
    warnings.push(createStatusWarning(
      rawServiceStagingStatusCodes.hasManualOverride,
      'Manual overrides exist for this scope.',
      manualOverrides.length,
      { overrides: sampleOverrides(manualOverrides) }
    ))
  }

  if (overrideConflictRows.length > 0) {
    warnings.push(createStatusWarning(
      rawServiceStagingStatusCodes.overrideConflict,
      'Raw service re-import changed source symptom or action on lines that have manual overrides.',
      overrideConflictRows.length,
      sampleRawServiceRows(overrideConflictRows)
    ))
  }

  return warnings
}

function createStatusWarning(code: string, reason: string, count: number, relatedData?: unknown): ImportWarning {
  return { code, reason, count, relatedData }
}

function mapRowsByLineKey(rows: ExistingRawServiceRow[]) {
  const byLineKey = new Map<string, ExistingRawServiceRow>()

  for (const row of rows) {
    if (row.lineKey) {
      byLineKey.set(row.lineKey, row)
    }
  }

  return byLineKey
}

function countRowsByNotification(rows: Array<Pick<ExistingRawServiceRow, 'notification'> | Pick<RawServiceRowInsert, 'notification'>>) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (row.notification) {
      counts.set(row.notification, (counts.get(row.notification) ?? 0) + 1)
    }
  }

  return counts
}

function sourceOverrideFieldsChanged(newRow: RawServiceRowInsert, previousRow: ExistingRawServiceRow) {
  return newRow.action !== previousRow.action || newRow.symptomName !== previousRow.symptomName
}

function sampleRawServiceRows(rows: RawServiceRowInsert[]) {
  return {
    rows: rows.slice(0, 10).map(row => ({
      rowNumber: row.rowNumber,
      notification: row.notification,
      lineKey: row.lineKey
    }))
  }
}

function sampleOverrides(overrides: RawServiceLineOverride[]) {
  return overrides.slice(0, 10).map(override => ({
    id: override.id,
    notification: override.notification,
    lineKey: override.lineKey
  }))
}
