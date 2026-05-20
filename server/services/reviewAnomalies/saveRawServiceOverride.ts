import { z } from 'zod'

import { getDb } from '../../db/client'
import {
  createFactoryMappingsRepository,
  createMasterActionsRepository,
  createRawSalesRowsRepository,
  createRawServiceLineOverridesRepository,
  createRawServiceRowsRepository,
  createScopesRepository
} from '../../repositories'
import { normalizeCode } from '../imports/normalizers'
import { resolveImportScope } from '../imports/validators'
import { ReviewAnomaliesError, ReviewAnomaliesNotFoundError } from './errors'
import { getReviewLineKey, getReviewNotification, toReviewAnomalyItem } from './getReviewAnomalies'
import type { RawServiceOverrideInput, RawServiceOverrideResult } from './types'

type RawServiceLineOverride = NonNullable<RawServiceOverrideResult['override']>

const overrideInputSchema = z.object({
  lineKey: z.string().trim().min(1),
  overrideSymptom: z.string().trim().nullable().optional(),
  overrideAction: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional()
})

export function saveRawServiceOverride(input: RawServiceOverrideInput = {}): RawServiceOverrideResult {
  const scopeInput = resolveImportScope(input)
  const parsed = overrideInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new ReviewAnomaliesError('Raw service override payload is invalid.', parsed.error.flatten())
  }

  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ReviewAnomaliesNotFoundError('Selected report scope was not found.', scopeInput)
  }

  const row = createRawServiceRowsRepository(database)
    .findByReportScopeId(scopeResult.scope.id)
    .find(item => getReviewLineKey(item) === parsed.data.lineKey)
  const notification = row ? getReviewNotification(row) : null

  if (!row || !notification) {
    throw new ReviewAnomaliesNotFoundError('Raw service line was not found for the selected scope.', {
      ...scopeInput,
      lineKey: parsed.data.lineKey
    })
  }

  const masterActions = createMasterActionsRepository(database).listAll()
  const actionClassificationByAction = new Map(
    masterActions.map(action => [normalizeCode(action.action), action])
  )
  const normalizedOverrideAction = normalizeNullableCode(parsed.data.overrideAction)
  const normalizedOverrideSymptom = normalizeNullableText(parsed.data.overrideSymptom)
  const normalizedNote = normalizeNullableText(parsed.data.note)
  const overrideMasterAction = normalizedOverrideAction
    ? actionClassificationByAction.get(normalizedOverrideAction) ?? null
    : null

  if (normalizedOverrideAction && !overrideMasterAction) {
    throw new ReviewAnomaliesError('overrideAction must exist in master_actions.', {
      overrideAction: normalizedOverrideAction
    })
  }

  const lineKey = getReviewLineKey(row)
  const overridesRepository = createRawServiceLineOverridesRepository(database)
  const shouldSaveOverride = Boolean(normalizedOverrideSymptom || normalizedOverrideAction || normalizedNote)
  let override: RawServiceLineOverride | undefined

  if (shouldSaveOverride) {
    override = overridesRepository.upsert({
      reportScopeId: scopeResult.scope.id,
      notification,
      lineKey,
      overrideSymptom: normalizedOverrideSymptom,
      overrideAction: overrideMasterAction?.action ?? null,
      note: normalizedNote
    })
  }
  else {
    overridesRepository.deleteByScopeAndLineKey(scopeResult.scope.id, lineKey)
  }
  const activeMappings = createFactoryMappingsRepository(database).listActiveByScope(
    scopeResult.product.id,
    scopeResult.manufacturer.id,
    scopeInput.monthKey
  )
  const activeFactoryCodes = new Set(activeMappings.map(mapping => mapping.factoryCode))
  const activeFqmsModelCodes = new Set(
    createRawSalesRowsRepository(database)
      .findByReportScopeId(scopeResult.scope.id)
      .filter(salesRow => salesRow.salesMonth === scopeInput.monthKey)
      .map(salesRow => normalizeNullableCode(salesRow.modelCode))
      .filter((modelCode): modelCode is string => Boolean(modelCode))
  )

  return {
    override: override ?? null,
    item: toReviewAnomalyItem(row, override, actionClassificationByAction, scopeInput.monthKey, activeFactoryCodes, activeFqmsModelCodes)
  }
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeNullableCode(value: string | null | undefined) {
  const normalized = normalizeCode(value ?? undefined)
  return normalized.length > 0 ? normalized : null
}
