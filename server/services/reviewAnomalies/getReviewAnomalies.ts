import { getDb } from '../../db/client'
import {
  createFactoryMappingsRepository,
  createMasterActionsRepository,
  createRawServiceLineOverridesRepository,
  createRawServiceRowsRepository,
  createScopesRepository
} from '../../repositories'
import { normalizeCode } from '../imports/normalizers'
import { resolveImportScope } from '../imports/validators'
import { ReviewAnomaliesNotFoundError } from './errors'
import type { ReviewAnomaliesResult, ReviewAnomaliesScopeInput, ReviewAnomalyCode, ReviewAnomalyItem } from './types'

type RawServiceRow = ReturnType<ReturnType<typeof createRawServiceRowsRepository>['findByReportScopeId']>[number]
type RawServiceLineOverride = ReturnType<ReturnType<typeof createRawServiceLineOverridesRepository>['listByReportScopeId']>[number]
type MasterAction = ReturnType<ReturnType<typeof createMasterActionsRepository>['listAll']>[number]

export function getReviewAnomalies(input: ReviewAnomaliesScopeInput = {}): ReviewAnomaliesResult {
  const scopeInput = resolveImportScope(input)
  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ReviewAnomaliesNotFoundError('Selected report scope was not found.', scopeInput)
  }

  const activeMappings = createFactoryMappingsRepository(database).listActiveByScope(
    scopeResult.product.id,
    scopeResult.manufacturer.id,
    scopeInput.monthKey
  )
  const activeFactoryCodes = new Set(activeMappings.map(mapping => mapping.factoryCode))
  const overrides = createRawServiceLineOverridesRepository(database).listByReportScopeId(scopeResult.scope.id)
  const overridesByLineKey = new Map(overrides.map(override => [override.lineKey, override]))
  const masterActions = createMasterActionsRepository(database).listAll()
  const actionClassificationByAction = new Map(
    masterActions.map(action => [normalizeCode(action.action), action])
  )
  const rows = createRawServiceRowsRepository(database)
    .findByReportScopeId(scopeResult.scope.id)
    .filter(row => row.keydate === scopeInput.monthKey || Boolean(overridesByLineKey.has(getReviewLineKey(row))))

  const allItems = rows
    .map(row => toReviewAnomalyItem(row, overridesByLineKey.get(getReviewLineKey(row)), actionClassificationByAction, scopeInput.monthKey, activeFactoryCodes))
    .filter(item => item.issueCodes.length > 0)

  return {
    reportScopeId: scopeResult.scope.id,
    monthKey: scopeInput.monthKey,
    productCode: scopeInput.productCode,
    manufacturerCode: scopeInput.manufacturerCode,
    totalItemCount: allItems.length,
    summary: summarizeItems(allItems),
    items: allItems.slice(0, 100)
  }
}

export function toReviewAnomalyItem(
  row: RawServiceRow,
  override: RawServiceLineOverride | undefined,
  actionClassificationByAction: Map<string, MasterAction>,
  monthKey: string,
  activeFactoryCodes: Set<string>
): ReviewAnomalyItem {
  const source = getRawServiceSource(row)
  const effectiveAction = normalizeNullableCode(override?.overrideAction) ?? source.action
  const effectiveSymptom = normalizeNullableText(override?.overrideSymptom) ?? source.symptomName
  const effectiveClassification = effectiveAction ? actionClassificationByAction.get(normalizeCode(effectiveAction)) : undefined
  const effectiveDefectCategory = effectiveClassification?.category ?? null
  const effectiveDefect = effectiveClassification?.defect ?? null
  const issueCodes: ReviewAnomalyCode[] = []

  if (!source.modelCode) {
    issueCodes.push('MISSING_MODEL')
  }

  if (source.keydate !== monthKey) {
    issueCodes.push('KEYDATE_OUTLIER')
  }

  if (!source.factoryCode || !activeFactoryCodes.has(source.factoryCode)) {
    issueCodes.push('FACTORY_MAPPING_MISMATCH')
  }

  if (!effectiveAction || !effectiveClassification || isUnclassifiedDefectCategory(effectiveDefectCategory)) {
    issueCodes.push('ACTION_UNCLASSIFIED')
  }

  if (override) {
    issueCodes.push('HAS_MANUAL_OVERRIDE')
  }

  return {
    rowId: row.id,
    rowNumber: row.rowNumber,
    notification: source.notification,
    lineKey: source.lineKey,
    source: {
      rowNumber: source.rowNumber,
      notification: source.notification,
      lineKey: source.lineKey,
      keydate: source.keydate,
      factoryCode: source.factoryCode,
      modelCode: source.modelCode,
      modelName: source.modelName,
      jobSheetSection: source.jobSheetSection,
      symptomCode: source.symptomCode,
      symptomName: source.symptomName,
      action: source.action,
      partCode: source.partCode,
      partName: source.partName,
      serialNumber: source.serialNumber,
      branch: source.branch,
      warranty: source.warranty,
      totalCost: source.totalCost
    },
    keydate: source.keydate,
    factoryCode: source.factoryCode,
    modelCode: source.modelCode,
    modelName: source.modelName,
    symptom: {
      source: source.symptomName,
      override: override?.overrideSymptom ?? null,
      effective: effectiveSymptom
    },
    action: {
      source: source.action,
      override: override?.overrideAction ?? null,
      effective: effectiveAction
    },
    defectCategory: {
      source: source.defectCategory,
      effective: effectiveDefectCategory
    },
    defect: {
      source: source.defect,
      effective: effectiveDefect
    },
    issueCodes
  }
}

function summarizeItems(items: ReviewAnomalyItem[]) {
  return items.reduce<Record<ReviewAnomalyCode, number>>((summary, item) => {
    for (const code of item.issueCodes) {
      summary[code] += 1
    }

    return summary
  }, {
    MISSING_MODEL: 0,
    KEYDATE_OUTLIER: 0,
    FACTORY_MAPPING_MISMATCH: 0,
    ACTION_UNCLASSIFIED: 0,
    HAS_MANUAL_OVERRIDE: 0
  })
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeNullableCode(value: string | null | undefined) {
  const normalized = normalizeCode(value ?? undefined)
  return normalized.length > 0 ? normalized : null
}

function isUnclassifiedDefectCategory(value: string | null | undefined) {
  const normalized = normalizeCode(value ?? undefined)
  return !normalized || normalized === 'N/A'
}

export function getReviewLineKey(row: RawServiceRow) {
  const sourceNotification = getRawJsonField(row.rawJson, 'notification')
  const sourceJobSheetSection = getRawJsonField(row.rawJson, 'job_sheet_section')
  const sourcePartCode = getRawJsonField(row.rawJson, 'part_used')

  if (row.lineKey) {
    return row.lineKey
  }

  if (sourceNotification) {
    return [
      normalizeCode(sourceNotification),
      sourceJobSheetSection ? normalizeCode(sourceJobSheetSection) : 'NO_SECTION',
      sourcePartCode ? normalizeCode(sourcePartCode) : 'NO_PART',
      `ROW_${row.rowNumber}`
    ].join('|')
  }

  return `ROW_${row.rowNumber}`
}

export function getReviewNotification(row: RawServiceRow) {
  return row.notification ?? getRawJsonField(row.rawJson, 'notification')
}

function getRawServiceSource(row: RawServiceRow) {
  return {
    rowNumber: row.rowNumber,
    notification: getReviewNotification(row),
    lineKey: getReviewLineKey(row),
    keydate: row.keydate,
    factoryCode: row.factoryCode ?? getRawJsonField(row.rawJson, 'factory'),
    modelCode: row.modelCode ?? getRawJsonField(row.rawJson, 'model_series'),
    modelName: row.modelName ?? getRawJsonField(row.rawJson, 'model_name'),
    jobSheetSection: row.jobSheetSection ?? parseRawJsonInteger(row.rawJson, 'job_sheet_section'),
    symptomCode: row.symptomCode ?? getRawJsonField(row.rawJson, 'symptom_code'),
    symptomName: row.symptomName ?? getRawJsonField(row.rawJson, 'symptom'),
    action: row.action ?? getRawJsonField(row.rawJson, 'action'),
    defectCategory: row.sourceDefectCategory ?? getRawJsonField(row.rawJson, 'defect_category'),
    defect: row.sourceDefect ?? getRawJsonField(row.rawJson, 'defect'),
    partCode: getRawJsonField(row.rawJson, 'part_used'),
    partName: getRawJsonField(row.rawJson, 'part_name'),
    serialNumber: getRawJsonField(row.rawJson, 'serial_number'),
    branch: getRawJsonField(row.rawJson, 'branch'),
    warranty: getRawJsonField(row.rawJson, 'warranty'),
    totalCost: row.totalCost
  }
}

function getRawJsonField(rawJson: string, field: string) {
  try {
    const record = JSON.parse(rawJson) as Record<string, unknown>
    const value = record[field]

    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }
  catch {
    return null
  }
}

function parseRawJsonInteger(rawJson: string, field: string) {
  const value = Number.parseInt(getRawJsonField(rawJson, field) ?? '', 10)

  return Number.isFinite(value) ? value : null
}
