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
    const effectiveSymptom = override?.overrideSymptom ?? row.symptomName
    const effectiveAction = override?.overrideAction ?? row.action
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
  const effectiveSymptom = override?.overrideSymptom ?? row.symptomName
  const effectiveAction = override?.overrideAction ?? row.action
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
