import type { FqmsAccumulatedReportViewModel } from '../services/fqmsAccumulated'
import { normalizeFqmsModelCode } from '../services/fqmsModelSeries'
import { listEffectiveRawServiceRowsByScopeId } from '../services/rawService/effectiveRows'
import type { EffectiveRawServiceRow } from '../services/rawService/effectiveRows'
import type { RepositoryDb } from '../repositories/types'

export type FqmsWorstDefectBucketKey = 'older' | 'monthMinus2' | 'monthMinus1' | 'reportMonth'

export type FqmsWorstDefectBucket = {
  key: FqmsWorstDefectBucketKey
  label: string
  monthKey: string | null
  available: boolean
}

export type FqmsWorstDefectRowViewModel = {
  reportModelCode: string
  defect: string
  buckets: Record<FqmsWorstDefectBucketKey, number | null>
  total: number
  totalModelDefectQty: number
  denominator: number
  defectOccupancy: number | null
  defectPpm: number | null
}

export type FqmsWorstDefectsViewModel = {
  source: 'monthly_raw_service'
  status: 'ok' | 'check'
  buckets: FqmsWorstDefectBucket[]
  rows: FqmsWorstDefectRowViewModel[]
  missingHistoryBuckets: string[]
  computedAt: string
}

type AccumulatedModelRow = FqmsAccumulatedReportViewModel['rows'][number]

type GroupedWorstDefect = {
  reportModelCode: string
  defect: string
  buckets: Record<FqmsWorstDefectBucketKey, number>
  total: number
}

export function getFqmsWorstDefectsViewModel(input: {
  reportScopeId: number
  monthKey: string
  accumulated: FqmsAccumulatedReportViewModel | null
  db?: RepositoryDb
}): FqmsWorstDefectsViewModel | null {
  if (!input.accumulated) {
    return null
  }

  const effectiveRows = listEffectiveRawServiceRowsByScopeId(input.reportScopeId, input.db)
  return buildFqmsWorstDefectsViewModel({
    monthKey: input.monthKey,
    accumulatedRows: input.accumulated.rows,
    effectiveRows
  })
}

export function buildFqmsWorstDefectsViewModel(input: {
  monthKey: string
  accumulatedRows: AccumulatedModelRow[]
  effectiveRows: EffectiveRawServiceRow[]
}): FqmsWorstDefectsViewModel {
  const buckets = createBuckets(input.monthKey, input.effectiveRows)
  const activeModels = createActiveModels(input.accumulatedRows)
  const grouped = new Map<string, GroupedWorstDefect>()
  const totalByModel = new Map<string, number>()

  for (const row of input.effectiveRows) {
    if (!isFqmsWorstDefectRow(row)) {
      continue
    }

    const normalizedModelCode = normalizeFqmsModelCode(row.modelCode)
    const reportModelCode = normalizedModelCode ? activeModels.aliases.get(normalizedModelCode) : null

    if (!reportModelCode) {
      continue
    }

    const bucketKey = getBucketKey(row.keydate, buckets)

    if (!bucketKey) {
      continue
    }

    const defect = normalizeDefectLabel(row.effectiveDefect)
    const groupKey = `${reportModelCode}::${defect}`
    const group = grouped.get(groupKey) ?? createGroupedWorstDefect(reportModelCode, defect)

    group.buckets[bucketKey] += 1
    group.total += 1
    grouped.set(groupKey, group)
    totalByModel.set(reportModelCode, (totalByModel.get(reportModelCode) ?? 0) + 1)
  }

  const rows = Array.from(grouped.values())
    .sort((left, right) => left.reportModelCode.localeCompare(right.reportModelCode)
      || right.total - left.total
      || left.defect.localeCompare(right.defect))
    .map((group) => {
      const denominator = activeModels.denominatorByReportModel.get(group.reportModelCode) ?? 0
      const totalModelDefectQty = totalByModel.get(group.reportModelCode) ?? 0

      return {
        reportModelCode: group.reportModelCode,
        defect: group.defect,
        buckets: {
          older: bucketValue(group.buckets.older, buckets, 'older'),
          monthMinus2: bucketValue(group.buckets.monthMinus2, buckets, 'monthMinus2'),
          monthMinus1: bucketValue(group.buckets.monthMinus1, buckets, 'monthMinus1'),
          reportMonth: bucketValue(group.buckets.reportMonth, buckets, 'reportMonth')
        },
        total: group.total,
        totalModelDefectQty,
        denominator,
        defectOccupancy: totalModelDefectQty > 0 ? roundRatio(group.total / totalModelDefectQty) : null,
        defectPpm: denominator > 0 ? roundPpm(group.total / denominator * 1_000_000) : null
      }
    })

  const missingHistoryBuckets = buckets
    .filter(bucket => bucket.key !== 'reportMonth' && !bucket.available)
    .map(bucket => bucket.label)

  return {
    source: 'monthly_raw_service',
    status: missingHistoryBuckets.length === 0 ? 'ok' : 'check',
    buckets,
    rows,
    missingHistoryBuckets,
    computedAt: new Date().toISOString()
  }
}

function createActiveModels(rows: AccumulatedModelRow[]) {
  const aliases = new Map<string, string>()
  const denominatorByReportModel = new Map<string, number>()

  for (const row of rows) {
    const normalizedReportModelCode = normalizeFqmsModelCode(row.reportModelCode)

    if (!normalizedReportModelCode) {
      continue
    }

    aliases.set(normalizedReportModelCode, row.reportModelCode)
    denominatorByReportModel.set(row.reportModelCode, row.exposure)

    for (const sourceModelCode of row.sourceModelCodes) {
      const normalizedSourceModelCode = normalizeFqmsModelCode(sourceModelCode)

      if (normalizedSourceModelCode) {
        aliases.set(normalizedSourceModelCode, row.reportModelCode)
      }
    }
  }

  return { aliases, denominatorByReportModel }
}

function isFqmsWorstDefectRow(row: EffectiveRawServiceRow) {
  return row.jobSheetSection === 1
    && row.masterAction !== null
    && row.effectiveDefectCategory === 'DEFECT'
    && normalizeDefectLabel(row.effectiveDefect) !== 'N/A'
}

function createGroupedWorstDefect(reportModelCode: string, defect: string): GroupedWorstDefect {
  return {
    reportModelCode,
    defect,
    buckets: {
      older: 0,
      monthMinus2: 0,
      monthMinus1: 0,
      reportMonth: 0
    },
    total: 0
  }
}

function createBuckets(monthKey: string, rows: EffectiveRawServiceRow[]): FqmsWorstDefectBucket[] {
  const reportMonth = normalizeMonthKey(monthKey)
  const monthMinus1 = addMonths(reportMonth, -1)
  const monthMinus2 = addMonths(reportMonth, -2)
  const olderBoundary = addMonths(reportMonth, -3)
  const availableMonthKeys = new Set(rows.map(row => normalizeMonthKey(row.keydate)))
  const hasOlderRows = rows.some(row => normalizeMonthKey(row.keydate) <= olderBoundary)

  return [
    {
      key: 'older',
      label: `~${formatBucketMonthLabel(olderBoundary)}`,
      monthKey: olderBoundary,
      available: hasOlderRows
    },
    {
      key: 'monthMinus2',
      label: formatBucketMonthLabel(monthMinus2),
      monthKey: monthMinus2,
      available: availableMonthKeys.has(monthMinus2)
    },
    {
      key: 'monthMinus1',
      label: formatBucketMonthLabel(monthMinus1),
      monthKey: monthMinus1,
      available: availableMonthKeys.has(monthMinus1)
    },
    {
      key: 'reportMonth',
      label: formatBucketMonthLabel(reportMonth),
      monthKey: reportMonth,
      available: availableMonthKeys.has(reportMonth)
    }
  ]
}

function getBucketKey(monthKey: string, buckets: FqmsWorstDefectBucket[]): FqmsWorstDefectBucketKey | null {
  const normalizedMonthKey = normalizeMonthKey(monthKey)
  const olderBoundary = buckets.find(bucket => bucket.key === 'older')?.monthKey
  const monthMinus2 = buckets.find(bucket => bucket.key === 'monthMinus2')?.monthKey
  const monthMinus1 = buckets.find(bucket => bucket.key === 'monthMinus1')?.monthKey
  const reportMonth = buckets.find(bucket => bucket.key === 'reportMonth')?.monthKey

  if (reportMonth && normalizedMonthKey === reportMonth) {
    return 'reportMonth'
  }

  if (monthMinus1 && normalizedMonthKey === monthMinus1) {
    return 'monthMinus1'
  }

  if (monthMinus2 && normalizedMonthKey === monthMinus2) {
    return 'monthMinus2'
  }

  return olderBoundary && normalizedMonthKey <= olderBoundary ? 'older' : null
}

function bucketValue(value: number, buckets: FqmsWorstDefectBucket[], key: FqmsWorstDefectBucketKey) {
  const bucket = buckets.find(bucket => bucket.key === key)
  return bucket?.available ? value : null
}

function normalizeMonthKey(value: string) {
  const text = value.trim()

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text.replace('-', '')
  }

  return text
}

function addMonths(monthKey: string, delta: number) {
  const year = Number(monthKey.slice(0, 4))
  const monthIndex = Number(monthKey.slice(4, 6)) - 1 + delta
  const date = new Date(Date.UTC(year, monthIndex, 1, 12))

  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatBucketMonthLabel(monthKey: string) {
  const date = new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(4, 6)) - 1, 1, 12))
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const year = String(date.getUTCFullYear()).slice(2)

  return `${month}'${year}`
}

function normalizeDefectLabel(value: string | null) {
  const text = (value ?? '').trim().toUpperCase()
  return text.length > 0 ? text : 'N/A'
}

function roundRatio(value: number) {
  return Number(value.toFixed(6))
}

function roundPpm(value: number) {
  return Number(value.toFixed(6))
}
