import type { fqmsModelSeries } from '../db/schema'
import { createFqmsModelSeriesRepository } from '../repositories'
import type { RepositoryDb } from '../repositories/types'

type FqmsModelSeriesRow = typeof fqmsModelSeries.$inferSelect

export function listActiveFqmsModelSeries(
  db: RepositoryDb,
  productId: number,
  manufacturerId: number,
  monthKey: string
) {
  return createFqmsModelSeriesRepository(db).listActiveByScope(productId, manufacturerId, monthKey)
}

export function createActiveFqmsModelCodes(rows: FqmsModelSeriesRow[]) {
  const modelCodes = new Set<string>()

  for (const row of rows) {
    addModelCode(modelCodes, row.modelCode)
    addModelCode(modelCodes, row.reportModelCode)
  }

  return modelCodes
}

export function matchesActiveFqmsModel(modelCode: string | null, activeFqmsModelCodes: Set<string>) {
  const normalized = normalizeFqmsModelCode(modelCode)
  return !normalized || activeFqmsModelCodes.size === 0 || activeFqmsModelCodes.has(normalized)
}

export function normalizeFqmsModelCode(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normalized.length > 0 ? normalized : null
}

function addModelCode(modelCodes: Set<string>, value: string | null) {
  const normalized = normalizeFqmsModelCode(value)

  if (normalized) {
    modelCodes.add(normalized)
  }
}
