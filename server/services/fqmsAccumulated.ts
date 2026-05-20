import type { fqmsAccumulatedModelRows, fqmsModelSeries } from '../db/schema'
import {
  createFqmsAccumulatedModelRowsRepository,
  createFqmsModelSeriesRepository
} from '../repositories'
import type { RepositoryDb } from '../repositories/types'
import { normalizeFqmsModelCode } from './fqmsModelSeries'

type FqmsAccumulatedModelRow = typeof fqmsAccumulatedModelRows.$inferSelect
type FqmsModelSeriesRow = typeof fqmsModelSeries.$inferSelect

export type FqmsAccumulatedModelViewModel = {
  reportModelCode: string
  sourceModelCodes: string[]
  monitoringFiles: string[]
  launchingMonth: string | null
  launchingPeriod: number | null
  accumulatedSales: number
  defectQty: number
  nonDefectQty: number
  totalClaimQty: number
  exposure: number
  defectPpm: number | null
  nonDefectPpm: number | null
  totalPpm: number | null
  denominatorStatus: 'ok' | 'missing_or_zero'
}

export type FqmsAccumulatedTotalsViewModel = {
  accumulatedSales: number
  defectQty: number
  nonDefectQty: number
  totalClaimQty: number
  exposure: number
  defectPpm: number | null
  nonDefectPpm: number | null
  totalPpm: number | null
  denominatorStatus: 'ok' | 'missing_or_zero'
}

export type FqmsAccumulatedReportViewModel = {
  status: 'ok' | 'check'
  source: 'historical_accumulated'
  activeModelSeriesRows: number
  activeReportModelCount: number
  accumulatedModelCount: number
  missingModelCodes: string[]
  ignoredRows: Array<{
    sourceModelCode: string
    reportModelCode: string
  }>
  rows: FqmsAccumulatedModelViewModel[]
  totals: FqmsAccumulatedTotalsViewModel
  computedAt: string
}

export function getFqmsAccumulatedReportViewModel(input: {
  reportScopeId: number
  productId: number
  manufacturerId: number
  monthKey: string
  db?: RepositoryDb
}): FqmsAccumulatedReportViewModel | null {
  const accumulatedRows = createFqmsAccumulatedModelRowsRepository(input.db)
    .listByReportScopeId(input.reportScopeId)

  if (accumulatedRows.length === 0) {
    return null
  }

  const activeModelSeries = createFqmsModelSeriesRepository(input.db)
    .listActiveByScope(input.productId, input.manufacturerId, input.monthKey)

  return buildFqmsAccumulatedReportViewModel(accumulatedRows, activeModelSeries)
}

export function buildFqmsAccumulatedReportViewModel(
  accumulatedRows: FqmsAccumulatedModelRow[],
  activeModelSeries: FqmsModelSeriesRow[]
): FqmsAccumulatedReportViewModel {
  const activeModels = createActiveReportModels(activeModelSeries)
  const groupedRows = new Map<string, GroupedAccumulatedModel>()
  const ignoredRows: FqmsAccumulatedReportViewModel['ignoredRows'] = []

  for (const row of accumulatedRows) {
    const activeReportModelCode = resolveActiveReportModelCode(row, activeModels)

    if (!activeReportModelCode) {
      ignoredRows.push({
        sourceModelCode: row.sourceModelCode,
        reportModelCode: row.reportModelCode
      })
      continue
    }

    const activeModel = activeModels.reportModels.get(activeReportModelCode)
    const group = groupedRows.get(activeReportModelCode) ?? createGroupedAccumulatedModel(activeModel?.reportModelCode ?? row.reportModelCode)

    group.sourceModelCodes.add(row.sourceModelCode)

    if (row.monitoringFile) {
      group.monitoringFiles.add(row.monitoringFile)
    }

    group.launchingMonths.add(row.launchingMonth)
    group.launchingPeriods.add(row.launchingPeriod)
    group.accumulatedSales += row.accumulatedSales
    group.defectQty += row.defectQty
    group.nonDefectQty += row.nonDefectQty
    group.totalClaimQty += row.totalClaimQty
    group.exposure += row.accumulatedSales * row.launchingPeriod
    groupedRows.set(activeReportModelCode, group)
  }

  const rows = Array.from(groupedRows.values()).map(toModelViewModel)
  const totals = createTotals(rows)
  const missingModelCodes = Array.from(activeModels.reportModels.values())
    .filter(model => !groupedRows.has(model.normalizedCode))
    .map(model => model.reportModelCode)
  const status = totals.denominatorStatus === 'ok' && missingModelCodes.length === 0 && ignoredRows.length === 0
    ? 'ok'
    : 'check'

  return {
    status,
    source: 'historical_accumulated',
    activeModelSeriesRows: activeModelSeries.length,
    activeReportModelCount: activeModels.reportModels.size,
    accumulatedModelCount: rows.length,
    missingModelCodes,
    ignoredRows,
    rows,
    totals,
    computedAt: latestUpdatedAt(accumulatedRows)
  }
}

type ActiveReportModels = {
  reportModels: Map<string, {
    normalizedCode: string
    reportModelCode: string
  }>
  aliases: Map<string, string>
}

type GroupedAccumulatedModel = {
  reportModelCode: string
  sourceModelCodes: Set<string>
  monitoringFiles: Set<string>
  launchingMonths: Set<string>
  launchingPeriods: Set<number>
  accumulatedSales: number
  defectQty: number
  nonDefectQty: number
  totalClaimQty: number
  exposure: number
}

function createActiveReportModels(activeModelSeries: FqmsModelSeriesRow[]): ActiveReportModels {
  const reportModels = new Map<string, { normalizedCode: string, reportModelCode: string }>()
  const aliases = new Map<string, string>()

  for (const row of activeModelSeries) {
    const normalizedReportModelCode = normalizeFqmsModelCode(row.reportModelCode)

    if (!normalizedReportModelCode) {
      continue
    }

    if (!reportModels.has(normalizedReportModelCode)) {
      reportModels.set(normalizedReportModelCode, {
        normalizedCode: normalizedReportModelCode,
        reportModelCode: row.reportModelCode
      })
    }

    aliases.set(normalizedReportModelCode, normalizedReportModelCode)

    const normalizedSourceModelCode = normalizeFqmsModelCode(row.modelCode)

    if (normalizedSourceModelCode) {
      aliases.set(normalizedSourceModelCode, normalizedReportModelCode)
    }
  }

  return { reportModels, aliases }
}

function resolveActiveReportModelCode(row: FqmsAccumulatedModelRow, activeModels: ActiveReportModels) {
  const normalizedReportModelCode = normalizeFqmsModelCode(row.reportModelCode)

  if (normalizedReportModelCode && activeModels.reportModels.has(normalizedReportModelCode)) {
    return normalizedReportModelCode
  }

  const normalizedSourceModelCode = normalizeFqmsModelCode(row.sourceModelCode)

  return normalizedSourceModelCode ? activeModels.aliases.get(normalizedSourceModelCode) ?? null : null
}

function createGroupedAccumulatedModel(reportModelCode: string): GroupedAccumulatedModel {
  return {
    reportModelCode,
    sourceModelCodes: new Set(),
    monitoringFiles: new Set(),
    launchingMonths: new Set(),
    launchingPeriods: new Set(),
    accumulatedSales: 0,
    defectQty: 0,
    nonDefectQty: 0,
    totalClaimQty: 0,
    exposure: 0
  }
}

function toModelViewModel(group: GroupedAccumulatedModel): FqmsAccumulatedModelViewModel {
  const launchingMonths = Array.from(group.launchingMonths)
  const launchingPeriods = Array.from(group.launchingPeriods)
  const denominatorStatus = group.exposure > 0 ? 'ok' : 'missing_or_zero'

  return {
    reportModelCode: group.reportModelCode,
    sourceModelCodes: Array.from(group.sourceModelCodes).sort(),
    monitoringFiles: Array.from(group.monitoringFiles).sort(),
    launchingMonth: launchingMonths.length === 1 ? launchingMonths[0] ?? null : null,
    launchingPeriod: launchingPeriods.length === 1 ? launchingPeriods[0] ?? null : null,
    accumulatedSales: group.accumulatedSales,
    defectQty: group.defectQty,
    nonDefectQty: group.nonDefectQty,
    totalClaimQty: group.totalClaimQty,
    exposure: group.exposure,
    defectPpm: calculatePpm(group.defectQty, group.exposure),
    nonDefectPpm: calculatePpm(group.nonDefectQty, group.exposure),
    totalPpm: calculatePpm(group.totalClaimQty, group.exposure),
    denominatorStatus
  }
}

function createTotals(rows: FqmsAccumulatedModelViewModel[]): FqmsAccumulatedTotalsViewModel {
  const totals = rows.reduce((result, row) => ({
    accumulatedSales: result.accumulatedSales + row.accumulatedSales,
    defectQty: result.defectQty + row.defectQty,
    nonDefectQty: result.nonDefectQty + row.nonDefectQty,
    totalClaimQty: result.totalClaimQty + row.totalClaimQty,
    exposure: result.exposure + row.exposure
  }), {
    accumulatedSales: 0,
    defectQty: 0,
    nonDefectQty: 0,
    totalClaimQty: 0,
    exposure: 0
  })
  const denominatorStatus = totals.exposure > 0 ? 'ok' : 'missing_or_zero'

  return {
    ...totals,
    defectPpm: calculatePpm(totals.defectQty, totals.exposure),
    nonDefectPpm: calculatePpm(totals.nonDefectQty, totals.exposure),
    totalPpm: calculatePpm(totals.totalClaimQty, totals.exposure),
    denominatorStatus
  }
}

function calculatePpm(quantity: number, exposure: number) {
  return exposure > 0 ? Number(((quantity / exposure) * 1_000_000).toFixed(6)) : null
}

function latestUpdatedAt(rows: FqmsAccumulatedModelRow[]) {
  return rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, rows[0]?.updatedAt ?? new Date().toISOString())
}
