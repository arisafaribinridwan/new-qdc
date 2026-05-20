import type { fcostSummaries, fqmsSummaries } from '../../db/schema'

type FqmsSummary = typeof fqmsSummaries.$inferSelect
type FcostSummary = typeof fcostSummaries.$inferSelect

export type AggregationScopeInput = {
  monthKey?: string
  productCode?: string
  manufacturerCode?: string
}

export type AggregationStatus = 'ok' | 'check'

export type FqmsAggregationDetails = {
  monthKey: string
  salesRows: number
  masterModelSeriesRows: number
  claimRows: number
  ignoredServiceRows: number
  unclassifiedClaimRows: number
  ppm: number | null
  denominatorStatus: 'ok' | 'missing_or_zero'
  defectStatusCounts: Record<string, number>
  manualOverrideRows: number
  missingEffectiveActionMappings: number
}

export type FcostAggregationDetails = {
  monthKey: string
  serviceRows: number
  costRows: number
  itemCostTotalRupiah: number
  rawTotalCostRupiah: number
  totalCostDifferenceRupiah: number
  crossCheckStatus: 'ok' | 'check'
}

export type AggregationResult = {
  reportScopeId: number
  monthKey: string
  productCode: string
  manufacturerCode: string
  fqms: FqmsSummary
  fcost: FcostSummary
  details: {
    fqms: FqmsAggregationDetails
    fcost: FcostAggregationDetails
  }
}

