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
type MasterAction = ReturnType<ReturnType<typeof createMasterActionsRepository>['listActive']>[number]

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
  const masterActions = createMasterActionsRepository(database).listActive()
  const actionClassificationByAction = new Map(
    masterActions.map(action => [normalizeCode(action.action), action])
  )
  const rows = createRawServiceRowsRepository(database)
    .findByReportScopeId(scopeResult.scope.id)
    .filter(row => row.keydate === scopeInput.monthKey || Boolean(row.lineKey && overridesByLineKey.has(row.lineKey)))

  const allItems = rows
    .map(row => toReviewAnomalyItem(row, overridesByLineKey.get(row.lineKey ?? ''), actionClassificationByAction, scopeInput.monthKey, activeFactoryCodes))
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
  const effectiveAction = normalizeNullableCode(override?.overrideAction) ?? row.action
  const effectiveSymptom = normalizeNullableText(override?.overrideSymptom) ?? row.symptomName
  const effectiveClassification = effectiveAction ? actionClassificationByAction.get(normalizeCode(effectiveAction)) : undefined
  const effectiveDefectCategory = effectiveClassification?.category ?? row.sourceDefectCategory
  const effectiveDefect = effectiveClassification?.defect ?? row.sourceDefect
  const issueCodes: ReviewAnomalyCode[] = []

  if (!row.modelCode) {
    issueCodes.push('MISSING_MODEL')
  }

  if (row.keydate !== monthKey) {
    issueCodes.push('KEYDATE_OUTLIER')
  }

  if (!row.factoryCode || !activeFactoryCodes.has(row.factoryCode)) {
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
    notification: row.notification,
    lineKey: row.lineKey ?? `ROW_${row.rowNumber}`,
    keydate: row.keydate,
    factoryCode: row.factoryCode,
    modelCode: row.modelCode,
    modelName: row.modelName,
    symptom: {
      source: row.symptomName,
      override: override?.overrideSymptom ?? null,
      effective: effectiveSymptom
    },
    action: {
      source: row.action,
      override: override?.overrideAction ?? null,
      effective: effectiveAction
    },
    defectCategory: {
      source: row.sourceDefectCategory,
      effective: effectiveDefectCategory
    },
    defect: {
      source: row.sourceDefect,
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
