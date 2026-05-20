import type { masterActions, rawServiceLineOverrides, rawServiceRows } from '../../db/schema'
import {
  createMasterActionsRepository,
  createRawServiceLineOverridesRepository,
  createRawServiceRowsRepository
} from '../../repositories'
import type { RepositoryDb } from '../../repositories/types'

type RawServiceRow = typeof rawServiceRows.$inferSelect
type RawServiceLineOverride = typeof rawServiceLineOverrides.$inferSelect
type MasterAction = typeof masterActions.$inferSelect

export type EffectiveRawServiceRow = RawServiceRow & {
  override: RawServiceLineOverride | null
  effectiveSymptom: string | null
  effectiveAction: string | null
  effectiveDefectCategory: string | null
  effectiveDefect: string | null
  hasManualOverride: boolean
  masterAction: MasterAction | null
}

export function listEffectiveRawServiceRowsByScopeId(reportScopeId: number, db?: RepositoryDb): EffectiveRawServiceRow[] {
  const rowsRepository = createRawServiceRowsRepository(db)
  const overridesRepository = createRawServiceLineOverridesRepository(db)
  const masterActionsRepository = createMasterActionsRepository(db)

  return buildEffectiveRawServiceRows(
    rowsRepository.findByReportScopeId(reportScopeId),
    overridesRepository.listByReportScopeId(reportScopeId),
    masterActionsRepository.listAll()
  )
}

export function buildEffectiveRawServiceRows(
  rows: RawServiceRow[],
  overrides: RawServiceLineOverride[],
  actionMappings: MasterAction[]
): EffectiveRawServiceRow[] {
  const overridesByLineKey = new Map(overrides.map(override => [override.lineKey, override]))
  const actionsByAction = new Map(actionMappings.map(action => [normalizeActionKey(action.action), action]))

  return rows.map((row) => {
    const override = row.lineKey ? overridesByLineKey.get(row.lineKey) ?? null : null
    const rawValues = parseRawServiceJson(row.rawJson)
    const effectiveSymptom = override?.overrideSymptom ?? firstText(row.symptomName, rawValues.symptom)
    const effectiveAction = override?.overrideAction ?? firstText(row.action, rawValues.action)
    const masterAction = effectiveAction ? actionsByAction.get(normalizeActionKey(effectiveAction)) ?? null : null

    return {
      ...row,
      override,
      effectiveSymptom,
      effectiveAction,
      effectiveDefectCategory: masterAction?.category ?? null,
      effectiveDefect: masterAction?.defect ?? null,
      hasManualOverride: Boolean(override),
      masterAction
    }
  })
}

export function buildEffectiveRawServiceRow(
  row: RawServiceRow,
  override: RawServiceLineOverride | null,
  actionMappings: MasterAction[]
): EffectiveRawServiceRow {
  const actionByAction = new Map(actionMappings.map(action => [normalizeActionKey(action.action), action]))
  const rawValues = parseRawServiceJson(row.rawJson)
  const effectiveSymptom = override?.overrideSymptom ?? firstText(row.symptomName, rawValues.symptom)
  const effectiveAction = override?.overrideAction ?? firstText(row.action, rawValues.action)
  const masterAction = effectiveAction ? actionByAction.get(normalizeActionKey(effectiveAction)) ?? null : null

  return {
    ...row,
    override,
    effectiveSymptom,
    effectiveAction,
    effectiveDefectCategory: masterAction?.category ?? null,
    effectiveDefect: masterAction?.defect ?? null,
    hasManualOverride: Boolean(override),
    masterAction
  }
}

function normalizeActionKey(action: string) {
  return action.trim().toUpperCase()
}

function parseRawServiceJson(rawJson: string): { symptom: string | null, action: string | null } {
  try {
    const parsed: unknown = JSON.parse(rawJson)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { symptom: null, action: null }
    }

    return {
      symptom: textValue((parsed as Record<string, unknown>).symptom),
      action: textValue((parsed as Record<string, unknown>).action)
    }
  }
  catch {
    return { symptom: null, action: null }
  }
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = textValue(value)

    if (text) {
      return text
    }
  }

  return null
}

function textValue(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}
