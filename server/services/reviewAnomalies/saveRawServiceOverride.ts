import { z } from 'zod'

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
import { ReviewAnomaliesError, ReviewAnomaliesNotFoundError } from './errors'
import { toReviewAnomalyItem } from './getReviewAnomalies'
import type { RawServiceOverrideInput, RawServiceOverrideResult } from './types'

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
    .find(item => item.lineKey === parsed.data.lineKey)

  if (!row || !row.lineKey || !row.notification) {
    throw new ReviewAnomaliesNotFoundError('Raw service line was not found for the selected scope.', {
      ...scopeInput,
      lineKey: parsed.data.lineKey
    })
  }

  const override = createRawServiceLineOverridesRepository(database).upsert({
    reportScopeId: scopeResult.scope.id,
    notification: row.notification,
    lineKey: row.lineKey,
    overrideSymptom: normalizeNullableText(parsed.data.overrideSymptom),
    overrideAction: normalizeNullableCode(parsed.data.overrideAction),
    note: normalizeNullableText(parsed.data.note)
  })
  const activeMappings = createFactoryMappingsRepository(database).listActiveByScope(
    scopeResult.product.id,
    scopeResult.manufacturer.id,
    scopeInput.monthKey
  )
  const activeFactoryCodes = new Set(activeMappings.map(mapping => mapping.factoryCode))
  const actionClassificationByAction = new Map(
    createMasterActionsRepository(database)
      .listActive()
      .map(action => [normalizeCode(action.action), action])
  )

  return {
    override,
    item: toReviewAnomalyItem(row, override, actionClassificationByAction, scopeInput.monthKey, activeFactoryCodes)
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
