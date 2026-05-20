import { getDb } from '../../db/client'
import {
  createMasterActionsRepository,
  createRawServiceLineOverridesRepository,
  createRawServiceRowsRepository,
  createScopesRepository
} from '../../repositories'
import { resolveImportScope } from '../imports/validators'
import { RawServiceReviewNotFoundError, RawServiceReviewValidationError } from './errors'
import { buildEffectiveRawServiceRow } from './effectiveRows'
import type { EffectiveRawServiceRow } from './effectiveRows'

export type ReviewRawServiceLineInput = {
  monthKey?: string
  productCode?: string
  manufacturerCode?: string
  lineKey?: string
  overrideSymptom?: string | null
  overrideAction?: string | null
  note?: string | null
}

export type ReviewRawServiceLineResult = {
  reportScopeId: number
  row: EffectiveRawServiceRow
  overrideSaved: boolean
}

export function reviewRawServiceLine(input: ReviewRawServiceLineInput): ReviewRawServiceLineResult {
  const scopeInput = resolveImportScope(input)
  const lineKey = input.lineKey?.trim()

  if (!lineKey) {
    throw new RawServiceReviewValidationError('lineKey is required.')
  }

  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new RawServiceReviewNotFoundError('Selected report scope was not found.', scopeInput)
  }

  return database.transaction((tx) => {
    const rowsRepository = createRawServiceRowsRepository(tx)
    const overridesRepository = createRawServiceLineOverridesRepository(tx)
    const masterActionsRepository = createMasterActionsRepository(tx)
    const row = rowsRepository.findByScopeAndLineKey(scopeResult.scope.id, lineKey)

    if (!row) {
      throw new RawServiceReviewNotFoundError('Raw service line was not found for the selected scope.', {
        ...scopeInput,
        lineKey
      })
    }

    const existingOverride = overridesRepository.findByScopeAndLineKey(scopeResult.scope.id, lineKey)
    const nextOverrideSymptom = resolveNextValue(input.overrideSymptom, existingOverride?.overrideSymptom ?? null)
    const nextOverrideAction = resolveNextValue(input.overrideAction, existingOverride?.overrideAction ?? null)
    const nextNote = resolveNextValue(input.note, existingOverride?.note ?? null)
    const masterActions = masterActionsRepository.listAll()
    const overrideMasterAction = nextOverrideAction
      ? masterActions.find(action => normalizeActionKey(action.action) === normalizeActionKey(nextOverrideAction)) ?? null
      : null

    if (nextOverrideAction && !overrideMasterAction) {
      throw new RawServiceReviewValidationError('overrideAction must exist in master_actions.', {
        overrideAction: nextOverrideAction
      })
    }

    const canonicalOverrideAction = overrideMasterAction?.action ?? null
    const shouldSaveOverride = Boolean(nextOverrideSymptom || nextOverrideAction || nextNote)
    const savedOverride = shouldSaveOverride
      ? overridesRepository.upsertForLine({
          reportScopeId: scopeResult.scope.id,
          notification: row.notification ?? '',
          lineKey,
          overrideSymptom: nextOverrideSymptom,
          overrideAction: canonicalOverrideAction,
          note: nextNote
        })
      : null

    if (!shouldSaveOverride && existingOverride) {
      overridesRepository.deleteByScopeAndLineKey(scopeResult.scope.id, lineKey)
    }

    return {
      reportScopeId: scopeResult.scope.id,
      row: buildEffectiveRawServiceRow(row, savedOverride, masterActions),
      overrideSaved: shouldSaveOverride
    }
  })
}

function resolveNextValue(value: string | null | undefined, existingValue: string | null) {
  if (value === undefined) {
    return existingValue
  }

  const normalized = value?.trim() || null
  return normalized
}

function normalizeActionKey(action: string) {
  return action.trim().toUpperCase()
}
