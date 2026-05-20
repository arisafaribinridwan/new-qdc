import { getDb } from '../db/client'
import {
  createFcostSummariesRepository,
  createFqmsSummariesRepository,
  createImportsRepository,
  createScopesRepository
} from '../repositories'
import { getFqmsAccumulatedReportViewModel } from '../services/fqmsAccumulated'
import { importTypes } from '../services/imports/constants'
import { resolveImportScope } from '../services/imports/validators'
import { ReportNotFoundError } from './errors'
import type { ReportScopeInput, ReportViewModel } from './types'

type FqmsDetails = {
  unclassifiedClaimRows?: number
  ppm?: number | null
  denominatorStatus?: 'ok' | 'missing_or_zero'
}

type FcostDetails = {
  serviceRows?: number
  costRows?: number
  rawTotalCostRupiah?: number
  totalCostDifferenceRupiah?: number
  crossCheckStatus?: 'ok' | 'check'
}

export function getReportViewModel(input: ReportScopeInput = {}): ReportViewModel {
  const scopeInput = resolveImportScope(input)
  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ReportNotFoundError('Selected report scope was not found.', scopeInput)
  }

  const importsRepository = createImportsRepository(database)
  const fqms = createFqmsSummariesRepository(database).findByReportScopeId(scopeResult.scope.id)
  const fcost = createFcostSummariesRepository(database).findByReportScopeId(scopeResult.scope.id)
  const salesImport = importsRepository.findLatestByScopeAndType(scopeResult.scope.id, importTypes.sales)
  const rawServiceImport = importsRepository.findLatestByScopeAndType(scopeResult.scope.id, importTypes.rawService)
  const fqmsDetails = parseJsonObject<FqmsDetails>(fqms?.summaryJson)
  const fcostDetails = parseJsonObject<FcostDetails>(fcost?.summaryJson)
  const monthlyFqms = fqms
    ? {
        status: fqms.status,
        salesQuantity: fqms.salesQuantity,
        claimQuantity: fqms.claimQuantity,
        defectCount: fqms.defectCount,
        nonDefectCount: fqms.nonDefectCount,
        unclassifiedClaimRows: Number(fqmsDetails.unclassifiedClaimRows ?? Math.max(fqms.claimQuantity - fqms.defectCount - fqms.nonDefectCount, 0)),
        ppm: typeof fqmsDetails.ppm === 'number' ? fqmsDetails.ppm : null,
        denominatorStatus: fqmsDetails.denominatorStatus ?? (fqms.salesQuantity > 0 ? 'ok' : 'missing_or_zero'),
        computedAt: fqms.computedAt
      }
    : null
  const accumulatedFqms = getFqmsAccumulatedReportViewModel({
    reportScopeId: scopeResult.scope.id,
    productId: scopeResult.product.id,
    manufacturerId: scopeResult.manufacturer.id,
    monthKey: scopeInput.monthKey,
    db: database
  })
  const reportFqms = accumulatedFqms
    ? {
        source: 'accumulated' as const,
        status: accumulatedFqms.status,
        salesQuantity: accumulatedFqms.totals.accumulatedSales,
        claimQuantity: accumulatedFqms.totals.totalClaimQty,
        defectCount: accumulatedFqms.totals.defectQty,
        nonDefectCount: accumulatedFqms.totals.nonDefectQty,
        unclassifiedClaimRows: 0,
        ppm: accumulatedFqms.totals.totalPpm == null ? null : Math.ceil(accumulatedFqms.totals.totalPpm),
        denominatorStatus: accumulatedFqms.totals.denominatorStatus,
        computedAt: accumulatedFqms.computedAt,
        accumulated: accumulatedFqms,
        monthly: monthlyFqms
      }
    : monthlyFqms
      ? {
          source: 'monthly_summary' as const,
          ...monthlyFqms,
          accumulated: null,
          monthly: monthlyFqms
        }
      : null

  return {
    reportScopeId: scopeResult.scope.id,
    generatedAt: new Date().toISOString(),
    scope: {
      monthKey: scopeResult.reportMonth.monthKey,
      monthLabel: scopeResult.reportMonth.label,
      calendarYear: scopeResult.reportMonth.calendarYear,
      calendarMonth: scopeResult.reportMonth.calendarMonth,
      fiscalYear: scopeResult.reportMonth.fiscalYear,
      fiscalHalf: scopeResult.reportMonth.fiscalHalf,
      productCode: scopeResult.product.code,
      productName: scopeResult.product.name,
      manufacturerCode: scopeResult.manufacturer.code,
      manufacturerName: scopeResult.manufacturer.name
    },
    imports: {
      salesImportId: salesImport?.id ?? null,
      rawServiceImportId: rawServiceImport?.id ?? null
    },
    fqms: reportFqms,
    fcost: fcost
      ? {
          status: fcost.status,
          serviceRows: Number(fcostDetails.serviceRows ?? 0),
          costRows: Number(fcostDetails.costRows ?? fcost.rowCount),
          partsCostRupiah: fcost.partsCostRupiah,
          laborCostRupiah: fcost.laborCostRupiah,
          transportationCostRupiah: fcost.transportationCostRupiah,
          totalCostRupiah: fcost.totalCostRupiah,
          rawTotalCostRupiah: Number(fcostDetails.rawTotalCostRupiah ?? fcost.totalCostRupiah),
          totalCostDifferenceRupiah: Number(fcostDetails.totalCostDifferenceRupiah ?? 0),
          crossCheckStatus: fcostDetails.crossCheckStatus ?? 'check',
          computedAt: fcost.computedAt
        }
      : null
  }
}

function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined): T {
  if (!value) {
    return {} as T
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : {} as T
  }
  catch {
    return {} as T
  }
}
