import type { rawServiceLineOverrides } from '../../db/schema'
import type { ImportScopeInput } from '../imports/types'

export type ReviewAnomaliesScopeInput = ImportScopeInput

export type ReviewAnomalyCode =
  | 'MISSING_MODEL'
  | 'KEYDATE_OUTLIER'
  | 'FACTORY_MAPPING_MISMATCH'
  | 'ACTION_UNCLASSIFIED'
  | 'HAS_MANUAL_OVERRIDE'

export type ReviewAnomalyItem = {
  rowId: number
  rowNumber: number
  notification: string | null
  lineKey: string
  source: {
    rowNumber: number
    notification: string | null
    lineKey: string
    keydate: string
    factoryCode: string | null
    modelCode: string | null
    modelName: string | null
    jobSheetSection: number | null
    symptomCode: string | null
    symptomName: string | null
    action: string | null
    partCode: string | null
    partName: string | null
    serialNumber: string | null
    branch: string | null
    warranty: string | null
    totalCost: number
  }
  keydate: string
  factoryCode: string | null
  modelCode: string | null
  modelName: string | null
  symptom: {
    source: string | null
    override: string | null
    effective: string | null
  }
  action: {
    source: string | null
    override: string | null
    effective: string | null
  }
  defectCategory: {
    source: string | null
    effective: string | null
  }
  defect: {
    source: string | null
    effective: string | null
  }
  issueCodes: ReviewAnomalyCode[]
}

export type ReviewAnomaliesResult = {
  reportScopeId: number
  monthKey: string
  productCode: string
  manufacturerCode: string
  totalItemCount: number
  summary: Record<ReviewAnomalyCode, number>
  items: ReviewAnomalyItem[]
}

export type RawServiceOverrideInput = ReviewAnomaliesScopeInput & {
  lineKey?: string
  overrideSymptom?: string | null
  overrideAction?: string | null
  note?: string | null
}

export type RawServiceOverrideResult = {
  override: typeof rawServiceLineOverrides.$inferSelect
  item: ReviewAnomalyItem
}
