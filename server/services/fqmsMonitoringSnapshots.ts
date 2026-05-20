import type { fqmsMonitoringMonthlySnapshots } from '../db/schema'
import {
  createFqmsModelSeriesRepository,
  createFqmsMonitoringMonthlySnapshotsRepository
} from '../repositories'
import type { RepositoryDb } from '../repositories/types'
import { normalizeFqmsModelCode } from './fqmsModelSeries'

type FqmsMonitoringMonthlySnapshotRow = typeof fqmsMonitoringMonthlySnapshots.$inferSelect

export type FqmsQualityTrendMonthViewModel = {
  monthKey: string
  label: string
  targetPpm: number | null
  resultPpm: number | null
  totalExposure: number | null
  totalAccumulatedDefectQty: number
  denominatorStatus: 'ok' | 'missing_or_zero'
}

export type FqmsAcceptanceRatioPeriodViewModel = {
  key: string
  label: string
  monthKey: string
  totalModelCount: number
  okModelCount: number | null
  ngModelCount: number | null
  checkModelCount: number
  acceptanceRatio: number | null
}

export type FqmsMonitoringSnapshotsViewModel = {
  source: 'monitoring_summary_snapshots'
  status: 'ok' | 'check'
  snapshotCount: number
  targetMonthlyPpm: number | null
  targetSource: 'template_baseline' | 'missing_target_table'
  targetStatus: 'ok' | 'check'
  missingAccumulatedSalesCount: number
  missingAverageDefectPpmCount: number
  qualityTrend: {
    months: FqmsQualityTrendMonthViewModel[]
  }
  acceptanceRatio: {
    fiscalHalf: FqmsAcceptanceRatioPeriodViewModel
    months: FqmsAcceptanceRatioPeriodViewModel[]
  }
  computedAt: string
}

type ActiveReportModels = {
  reportModels: Map<string, string>
  aliases: Map<string, string>
}

type GroupedSnapshot = {
  reportModelCode: string
  sourceModelCodes: Set<string>
  accumulatedSales: number | null
  passingMonth: number | null
  accumulatedDefectQty: number
  averageDefectPpm: number | null
}

const baselineTargetMonthlyPpm = 383

export function getFqmsMonitoringSnapshotsViewModel(input: {
  reportScopeId: number
  productId: number
  manufacturerId: number
  monthKey: string
  db?: RepositoryDb
}): FqmsMonitoringSnapshotsViewModel | null {
  const snapshots = createFqmsMonitoringMonthlySnapshotsRepository(input.db)
    .listByReportScopeIdThroughMonth(input.reportScopeId, input.monthKey)

  if (snapshots.length === 0) {
    return null
  }

  const activeModelSeries = createFqmsModelSeriesRepository(input.db)
    .listActiveByScope(input.productId, input.manufacturerId, input.monthKey)
  const activeModels = createActiveReportModels(activeModelSeries)

  return buildFqmsMonitoringSnapshotsViewModel({
    monthKey: input.monthKey,
    snapshots,
    activeModels,
    targetMonthlyPpm: baselineTargetMonthlyPpm,
    targetSource: 'template_baseline',
    targetStatus: 'check'
  })
}

export function buildFqmsMonitoringSnapshotsViewModel(input: {
  monthKey: string
  snapshots: FqmsMonitoringMonthlySnapshotRow[]
  activeModels: ActiveReportModels
  targetMonthlyPpm: number | null
  targetSource: FqmsMonitoringSnapshotsViewModel['targetSource']
  targetStatus: FqmsMonitoringSnapshotsViewModel['targetStatus']
}): FqmsMonitoringSnapshotsViewModel {
  const monthKeys = lastMonthKeys(input.monthKey, 6)
  const previousHalf = previousFiscalHalf(input.monthKey)
  const snapshotsByMonth = groupSnapshotsByMonth(input.snapshots, input.activeModels)
  const targetMonthlyPpm = input.targetMonthlyPpm
  const missingAccumulatedSalesCount = input.snapshots.filter(row => row.accumulatedSales == null).length
  const missingAverageDefectPpmCount = input.snapshots.filter(row => row.averageDefectPpm == null).length
  const qualityTrendMonths = monthKeys.map(monthKey => createQualityTrendMonth(monthKey, snapshotsByMonth.get(monthKey) ?? [], targetMonthlyPpm))
  const acceptanceMonths = monthKeys.map(monthKey => createAcceptanceRatioPeriod({
    key: monthKey,
    label: formatMonthLabel(monthKey),
    monthKey,
    rows: snapshotsByMonth.get(monthKey) ?? [],
    targetMonthlyPpm
  }))
  const fiscalHalfAcceptance = createAcceptanceRatioPeriod({
    key: previousHalf.key,
    label: previousHalf.label,
    monthKey: previousHalf.endMonthKey,
    rows: snapshotsByMonth.get(previousHalf.endMonthKey) ?? [],
    targetMonthlyPpm
  })
  const status = input.targetStatus === 'ok' && missingAccumulatedSalesCount === 0 && missingAverageDefectPpmCount === 0
    ? 'ok'
    : 'check'

  return {
    source: 'monitoring_summary_snapshots',
    status,
    snapshotCount: input.snapshots.length,
    targetMonthlyPpm,
    targetSource: input.targetSource,
    targetStatus: input.targetStatus,
    missingAccumulatedSalesCount,
    missingAverageDefectPpmCount,
    qualityTrend: {
      months: qualityTrendMonths
    },
    acceptanceRatio: {
      fiscalHalf: fiscalHalfAcceptance,
      months: acceptanceMonths
    },
    computedAt: latestUpdatedAt(input.snapshots)
  }
}

function createActiveReportModels(rows: Array<{ modelCode: string, reportModelCode: string }>): ActiveReportModels {
  const reportModels = new Map<string, string>()
  const aliases = new Map<string, string>()

  for (const row of rows) {
    const normalizedReportModelCode = normalizeFqmsModelCode(row.reportModelCode)

    if (!normalizedReportModelCode) {
      continue
    }

    reportModels.set(normalizedReportModelCode, row.reportModelCode)
    aliases.set(normalizedReportModelCode, normalizedReportModelCode)

    const normalizedSourceModelCode = normalizeFqmsModelCode(row.modelCode)

    if (normalizedSourceModelCode) {
      aliases.set(normalizedSourceModelCode, normalizedReportModelCode)
    }
  }

  return { reportModels, aliases }
}

function groupSnapshotsByMonth(rows: FqmsMonitoringMonthlySnapshotRow[], activeModels: ActiveReportModels) {
  const groupedByMonth = new Map<string, GroupedSnapshot[]>()
  const grouped = new Map<string, GroupedSnapshot>()

  for (const row of rows) {
    const activeReportModelCode = resolveActiveReportModelCode(row, activeModels)

    if (!activeReportModelCode) {
      continue
    }

    const groupKey = `${row.monthKey}::${activeReportModelCode}`
    const group = grouped.get(groupKey) ?? createGroupedSnapshot(activeModels.reportModels.get(activeReportModelCode) ?? row.reportModelCode)

    group.sourceModelCodes.add(row.sourceModelCode)
    group.accumulatedSales = sumNullable(group.accumulatedSales, row.accumulatedSales)
    group.passingMonth = sumNullable(group.passingMonth, row.passingMonth)
    group.accumulatedDefectQty += row.accumulatedDefectQty
    group.averageDefectPpm = averageNullable(group.averageDefectPpm, row.averageDefectPpm)
    grouped.set(groupKey, group)
  }

  for (const [key, group] of grouped.entries()) {
    const monthKey = key.slice(0, 6)
    const groups = groupedByMonth.get(monthKey) ?? []
    groups.push(group)
    groupedByMonth.set(monthKey, groups)
  }

  return groupedByMonth
}

function resolveActiveReportModelCode(row: FqmsMonitoringMonthlySnapshotRow, activeModels: ActiveReportModels) {
  const normalizedReportModelCode = normalizeFqmsModelCode(row.reportModelCode)

  if (normalizedReportModelCode && activeModels.reportModels.has(normalizedReportModelCode)) {
    return normalizedReportModelCode
  }

  const normalizedSourceModelCode = normalizeFqmsModelCode(row.sourceModelCode)
  return normalizedSourceModelCode ? activeModels.aliases.get(normalizedSourceModelCode) ?? null : null
}

function createGroupedSnapshot(reportModelCode: string): GroupedSnapshot {
  return {
    reportModelCode,
    sourceModelCodes: new Set(),
    accumulatedSales: null,
    passingMonth: null,
    accumulatedDefectQty: 0,
    averageDefectPpm: null
  }
}

function createQualityTrendMonth(monthKey: string, rows: GroupedSnapshot[], targetPpm: number | null): FqmsQualityTrendMonthViewModel {
  let totalExposure = 0
  let missingDenominator = rows.length === 0
  let totalAccumulatedDefectQty = 0

  for (const row of rows) {
    totalAccumulatedDefectQty += row.accumulatedDefectQty

    if (row.accumulatedSales == null || row.passingMonth == null || row.accumulatedSales <= 0 || row.passingMonth <= 0) {
      missingDenominator = true
      continue
    }

    totalExposure += row.accumulatedSales * row.passingMonth
  }

  const denominatorStatus = !missingDenominator && totalExposure > 0 ? 'ok' : 'missing_or_zero'

  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    targetPpm,
    resultPpm: denominatorStatus === 'ok' ? calculatePpm(totalAccumulatedDefectQty, totalExposure) : null,
    totalExposure: denominatorStatus === 'ok' ? totalExposure : null,
    totalAccumulatedDefectQty,
    denominatorStatus
  }
}

function createAcceptanceRatioPeriod(input: {
  key: string
  label: string
  monthKey: string
  rows: GroupedSnapshot[]
  targetMonthlyPpm: number | null
}): FqmsAcceptanceRatioPeriodViewModel {
  let okModelCount = 0
  let ngModelCount = 0
  let checkModelCount = 0

  for (const row of input.rows) {
    const ppm = resolveModelPpm(row)

    if (ppm == null || input.targetMonthlyPpm == null) {
      checkModelCount += 1
    }
    else if (ppm < input.targetMonthlyPpm) {
      okModelCount += 1
    }
    else {
      ngModelCount += 1
    }
  }

  const totalModelCount = input.rows.length
  const hasCompleteQualityLevels = totalModelCount > 0 && checkModelCount === 0

  return {
    key: input.key,
    label: input.label,
    monthKey: input.monthKey,
    totalModelCount,
    okModelCount: hasCompleteQualityLevels ? okModelCount : null,
    ngModelCount: hasCompleteQualityLevels ? ngModelCount : null,
    checkModelCount,
    acceptanceRatio: hasCompleteQualityLevels ? roundRatio(okModelCount / totalModelCount) : null
  }
}

function resolveModelPpm(row: GroupedSnapshot) {
  if (row.averageDefectPpm != null) {
    return row.averageDefectPpm
  }

  if (row.accumulatedSales == null || row.passingMonth == null) {
    return null
  }

  const exposure = row.accumulatedSales * row.passingMonth
  return exposure > 0 ? calculatePpm(row.accumulatedDefectQty, exposure) : null
}

function sumNullable(left: number | null, right: number | null) {
  if (right == null) {
    return null
  }

  return left == null ? right : left + right
}

function averageNullable(left: number | null, right: number | null) {
  if (left == null) {
    return right
  }

  if (right == null) {
    return left
  }

  return (left + right) / 2
}

function lastMonthKeys(monthKey: string, count: number) {
  return Array.from({ length: count }, (_, index) => addMonths(monthKey, index - count + 1))
}

function addMonths(monthKey: string, delta: number) {
  const year = Number(monthKey.slice(0, 4))
  const monthIndex = Number(monthKey.slice(4, 6)) - 1 + delta
  const date = new Date(Date.UTC(year, monthIndex, 1, 12))
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function previousFiscalHalf(monthKey: string) {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(4, 6))
  const currentFiscalYear = month >= 4 ? year : year - 1
  const currentHalf = month >= 4 && month <= 9 ? 'FH' : 'LH'

  if (currentHalf === 'LH') {
    return {
      key: `${currentFiscalYear}FH`,
      label: `${currentFiscalYear}FH`,
      endMonthKey: `${currentFiscalYear}09`
    }
  }

  return {
    key: `${currentFiscalYear - 1}LH`,
    label: `${currentFiscalYear - 1}LH`,
    endMonthKey: `${currentFiscalYear}03`
  }
}

function formatMonthLabel(monthKey: string) {
  const date = new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(4, 6)) - 1, 1, 12))
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const year = String(date.getUTCFullYear()).slice(2)

  return `${month}-${year}`
}

function calculatePpm(quantity: number, exposure: number) {
  return exposure > 0 ? Number((quantity / exposure * 1_000_000).toFixed(6)) : null
}

function roundRatio(value: number) {
  return Number(value.toFixed(6))
}

function latestUpdatedAt(rows: FqmsMonitoringMonthlySnapshotRow[]) {
  return rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, rows[0]?.updatedAt ?? new Date().toISOString())
}
