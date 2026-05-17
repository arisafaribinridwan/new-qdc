import type { dataImports, rawSalesRows, rawServiceRows } from '../../db/schema'

type DataImport = typeof dataImports.$inferSelect

type RawSalesRowInsertModel = typeof rawSalesRows.$inferInsert
type RawServiceRowInsertModel = typeof rawServiceRows.$inferInsert

export type ImportScopeInput = {
  monthKey?: string
  productCode?: string
  manufacturerCode?: string
}

export type ImportCsvInput = ImportScopeInput & {
  filename: string
  content: Buffer
}

export type CsvRecord = Record<string, string | undefined>

export type ParsedCsv = {
  headers: string[]
  records: CsvRecord[]
  headerRowNumber: number
}

export type ImportWarning = {
  code: string
  reason: string
  rows?: number[]
  count?: number
}

export type ImportSummary = {
  importId: number
  reportScopeId: number
  importType: DataImport['importType']
  sourceFilename: string
  status: DataImport['status']
  rowCount: number
  acceptedCount: number
  rejectedCount: number
  warningCount: number
  replacedImportId: number | null
  warnings: ImportWarning[]
}

export type SalesRowInsert = RawSalesRowInsertModel
export type RawServiceRowInsert = RawServiceRowInsertModel

export type ImportHistoryFilters = ImportScopeInput

export type ImportHistoryItem = {
  id: number
  reportScopeId: number
  monthKey: string
  productCode: string
  manufacturerCode: string
  importType: DataImport['importType']
  sourceFilename: string
  mode: DataImport['mode']
  status: DataImport['status']
  rowCount: number
  acceptedCount: number
  rejectedCount: number
  warningCount: number
  headerJson: string | null
  missingHeadersJson: string | null
  warningJson: string | null
  replacedImportId: number | null
  importedAt: string
}
