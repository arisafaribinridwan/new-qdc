import { getDb } from '../../db/client'
import {
  createFcostSummariesRepository,
  createFqmsSummariesRepository,
  createImportsRepository,
  createRawSalesRowsRepository,
  createScopesRepository
} from '../../repositories'
import { importTypes } from '../imports/constants'
import { resolveImportScope } from '../imports/validators'
import { listEffectiveRawServiceRowsByScopeId } from '../rawService'
import { AggregationNotFoundError } from './errors'
import type {
  AggregationResult,
  AggregationScopeInput,
  FcostAggregationDetails,
  FqmsAggregationDetails
} from './types'
import type { EffectiveRawServiceRow } from '../rawService'

const claimJobSheetSection = 1

export function reprocessScopeAggregation(input: AggregationScopeInput = {}): AggregationResult {
  const scopeInput = resolveImportScope(input)
  const database = getDb()

  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new AggregationNotFoundError('Selected report scope was not found.', scopeInput)
  }

  return database.transaction((tx) => {
    const importsRepository = createImportsRepository(tx)
    const rawSalesRowsRepository = createRawSalesRowsRepository(tx)
    const fqmsSummariesRepository = createFqmsSummariesRepository(tx)
    const fcostSummariesRepository = createFcostSummariesRepository(tx)

    const salesImport = importsRepository.findLatestByScopeAndType(scopeResult.scope.id, importTypes.sales)
    const serviceImport = importsRepository.findLatestByScopeAndType(scopeResult.scope.id, importTypes.rawService)
    const salesRows = rawSalesRowsRepository
      .findByReportScopeId(scopeResult.scope.id)
      .filter(row => row.salesMonth === scopeInput.monthKey)
    const serviceRows = listEffectiveRawServiceRowsByScopeId(scopeResult.scope.id, tx)
      .filter(row => row.keydate === scopeInput.monthKey)

    const salesQuantity = sumBy(salesRows, row => row.quantity)
    const claimRows = serviceRows.filter(row => row.jobSheetSection === claimJobSheetSection)
    const defectStatusCounts = countDefectStatuses(claimRows)
    const defectCount = defectStatusCounts.DEFECT ?? 0
    const nonDefectCount = defectStatusCounts.NON_DEFECT ?? 0
    const unclassifiedClaimRows = claimRows.length - defectCount - nonDefectCount
    const ppm = salesQuantity > 0 ? (claimRows.length / salesQuantity) * 1_000_000 : null

    const fqmsDetails: FqmsAggregationDetails = {
      monthKey: scopeInput.monthKey,
      salesRows: salesRows.length,
      claimRows: claimRows.length,
      ignoredServiceRows: serviceRows.length - claimRows.length,
      unclassifiedClaimRows,
      ppm,
      denominatorStatus: salesQuantity > 0 ? 'ok' : 'missing_or_zero',
      defectStatusCounts,
      manualOverrideRows: serviceRows.filter(row => row.hasManualOverride).length,
      missingEffectiveActionMappings: serviceRows.filter(row => row.effectiveAction && !row.masterAction).length
    }

    const fqmsStatus = salesImport && serviceImport && salesQuantity > 0 ? 'ok' : 'check'
    const fqms = fqmsSummariesRepository.upsertForScope({
      reportScopeId: scopeResult.scope.id,
      salesImportId: salesImport?.id ?? null,
      serviceImportId: serviceImport?.id ?? null,
      salesQuantity,
      claimQuantity: claimRows.length,
      defectCount,
      nonDefectCount,
      status: fqmsStatus,
      summaryJson: JSON.stringify(fqmsDetails)
    })

    const costRows = serviceRows.filter(hasCostValue)
    const partsCostRupiah = sumBy(serviceRows, row => row.partsCost)
    const laborCostRupiah = sumBy(serviceRows, row => row.laborCost)
    const transportationCostRupiah = sumBy(serviceRows, row => row.transportationCost)
    const totalCostRupiah = partsCostRupiah + laborCostRupiah + transportationCostRupiah
    const rawTotalCostRupiah = sumBy(serviceRows, row => row.totalCost)
    const totalCostDifferenceRupiah = rawTotalCostRupiah - totalCostRupiah

    const fcostDetails: FcostAggregationDetails = {
      monthKey: scopeInput.monthKey,
      serviceRows: serviceRows.length,
      costRows: costRows.length,
      itemCostTotalRupiah: totalCostRupiah,
      rawTotalCostRupiah,
      totalCostDifferenceRupiah,
      crossCheckStatus: totalCostDifferenceRupiah === 0 ? 'ok' : 'check'
    }

    const fcostStatus = serviceImport && totalCostDifferenceRupiah === 0 ? 'ok' : 'check'
    const fcost = fcostSummariesRepository.upsertForScope({
      reportScopeId: scopeResult.scope.id,
      serviceImportId: serviceImport?.id ?? null,
      rowCount: costRows.length,
      partsCostRupiah,
      laborCostRupiah,
      transportationCostRupiah,
      totalCostRupiah,
      status: fcostStatus,
      summaryJson: JSON.stringify(fcostDetails)
    })

    return {
      reportScopeId: scopeResult.scope.id,
      monthKey: scopeInput.monthKey,
      productCode: scopeInput.productCode,
      manufacturerCode: scopeInput.manufacturerCode,
      fqms,
      fcost,
      details: {
        fqms: fqmsDetails,
        fcost: fcostDetails
      }
    }
  })
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0)
}

function hasCostValue(row: EffectiveRawServiceRow) {
  return row.partsCost !== 0
    || row.laborCost !== 0
    || row.transportationCost !== 0
    || row.totalCost !== 0
}

function countDefectStatuses(rows: EffectiveRawServiceRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const status = normalizeDefectStatus(row.effectiveDefectCategory)

    if (!status) {
      return counts
    }

    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {})
}

function normalizeDefectStatus(value: string | null) {
  const normalized = (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')

  if (!normalized || normalized === 'N/A') {
    return null
  }

  return normalized
}

