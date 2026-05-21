import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import ExcelJS from 'exceljs'

import { getDb } from '../db/client'
import { createExportJobsRepository } from '../repositories'
import { runScopeValidation } from '../services/validation'
import { ReportExportBlockedError, ReportInvalidRequestError } from './errors'
import type { ReportExportResult, ReportExportType, ReportScopeInput, ReportViewModel } from './types'
import { getReportViewModel } from './viewModel'

const templatePaths: Record<ReportExportType, string> = {
  fqms_excel: 'templates/excel/FQMS - LCD LOCAL.xlsx',
  fcost_excel: 'templates/excel/FCOST - LCD LOCAL.xlsx'
}

export async function exportReportExcel(input: ReportScopeInput & { exportType?: string } = {}): Promise<ReportExportResult> {
  const exportTypes = resolveExportTypes(input.exportType)
  const validation = runScopeValidation(input)
  const database = getDb()
  const exportJobsRepository = createExportJobsRepository(database)

  if (!validation.exportReady) {
    for (const exportType of exportTypes) {
      exportJobsRepository.create({
        reportScopeId: validation.reportScopeId,
        exportType,
        status: 'blocked',
        outputPath: null,
        validationRunId: validation.run.id,
        completedAt: new Date().toISOString()
      })
    }

    throw new ReportExportBlockedError('Excel export is blocked by critical or error validation issues.', {
      validationRunId: validation.run.id,
      status: validation.status,
      issues: validation.issues.map(issue => ({
        code: issue.code,
        severity: issue.severity,
        reason: issue.reason,
        relatedPage: issue.relatedPage
      }))
    })
  }

  const viewModel = getReportViewModel(input)
  const outputDirectory = resolve(
    process.cwd(),
    'storage/exports',
    viewModel.scope.monthKey,
    viewModel.scope.productCode,
    viewModel.scope.manufacturerCode
  )
  await mkdir(outputDirectory, { recursive: true })

  const exports: ReportExportResult['exports'] = []

  for (const exportType of exportTypes) {
    const exportJob = exportJobsRepository.create({
      reportScopeId: viewModel.reportScopeId,
      exportType,
      status: 'pending',
      outputPath: null,
      validationRunId: validation.run.id
    })

    try {
      const outputPath = await writeWorkbookExport(viewModel, exportType, outputDirectory)
      const completedJob = exportJobsRepository.update(exportJob.id, {
        status: 'completed',
        outputPath,
        completedAt: new Date().toISOString()
      })

      exports.push({
        exportJobId: completedJob.id,
        exportType,
        outputPath
      })
    }
    catch (error) {
      exportJobsRepository.update(exportJob.id, {
        status: 'failed',
        completedAt: new Date().toISOString()
      })

      throw error
    }
  }

  return {
    reportScopeId: viewModel.reportScopeId,
    validation: {
      runId: validation.run.id,
      status: validation.status,
      exportReady: validation.exportReady
    },
    exports
  }
}

function resolveExportTypes(exportType: string = 'all'): ReportExportType[] {
  if (exportType === 'all') {
    return ['fqms_excel', 'fcost_excel']
  }

  if (!isReportExportType(exportType)) {
    throw new ReportInvalidRequestError('exportType must be fqms_excel, fcost_excel, or all.', { exportType })
  }

  return [exportType]
}

function isReportExportType(exportType: string): exportType is ReportExportType {
  return exportType === 'fqms_excel' || exportType === 'fcost_excel'
}

async function writeWorkbookExport(viewModel: ReportViewModel, exportType: ReportExportType, outputDirectory: string) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(resolve(process.cwd(), templatePaths[exportType]))

  if (exportType === 'fqms_excel') {
    fillFqmsTemplate(workbook, viewModel)
  }
  else {
    fillFcostTemplate(workbook, viewModel)
  }

  const outputPath = resolve(outputDirectory, `${viewModel.scope.monthKey}_${viewModel.scope.productCode}_${viewModel.scope.manufacturerCode}_${exportType}.xlsx`)
  await workbook.xlsx.writeFile(outputPath)

  return outputPath
}

function fillFqmsTemplate(workbook: ExcelJS.Workbook, viewModel: ReportViewModel) {
  const worksheet = getRequiredWorksheet(workbook, 'FQMS')
  worksheet.getCell('D3').value = `: ${viewModel.scope.productCode}`
  worksheet.getCell('D4').value = `: ${viewModel.scope.manufacturerCode}`
  worksheet.getCell('R4').value = createExcelMonthDate(viewModel.scope.calendarYear, viewModel.scope.calendarMonth)
  fillFqmsQualityTrendSection(worksheet, viewModel)
  fillFqmsAcceptanceRatioSection(worksheet, viewModel)
  fillFqmsDetailModelSection(worksheet, viewModel)
  fillFqmsWorstDefectSection(worksheet, viewModel)

  const summary = createSummaryWorksheet(workbook, 'QRCC Summary', [
    ['Report Month', viewModel.scope.monthLabel],
    ['Product', viewModel.scope.productCode],
    ['Manufacturer', viewModel.scope.manufacturerCode],
    ['FQMS Source', viewModel.fqms?.source ?? 'missing'],
    ['FQMS Status', viewModel.fqms?.status ?? 'missing'],
    ['Sales Quantity', viewModel.fqms?.salesQuantity ?? null],
    ['Claim Quantity', viewModel.fqms?.claimQuantity ?? null],
    ['Defect Count', viewModel.fqms?.defectCount ?? null],
    ['Non Defect Count', viewModel.fqms?.nonDefectCount ?? null],
    ['Unclassified Claim Rows', viewModel.fqms?.unclassifiedClaimRows ?? null],
    ['PPM', viewModel.fqms?.ppm ?? null],
    ['Accumulated Exposure', viewModel.fqms?.accumulated?.totals.exposure ?? null],
    ['Accumulated Defect PPM', viewModel.fqms?.accumulated?.totals.defectPpm ?? null],
    ['Accumulated Non Defect PPM', viewModel.fqms?.accumulated?.totals.nonDefectPpm ?? null],
    ['Accumulated Total PPM', viewModel.fqms?.accumulated?.totals.totalPpm ?? null],
    ['Accumulated Active Models', viewModel.fqms?.accumulated?.activeReportModelCount ?? null],
    ['Worst Defect Source', viewModel.fqms?.worstDefects?.source ?? 'missing'],
    ['Worst Defect Status', viewModel.fqms?.worstDefects?.status ?? 'missing'],
    ['Worst Defect Missing History Buckets', viewModel.fqms?.worstDefects?.missingHistoryBuckets.join(', ') ?? null],
    ['Monitoring Snapshot Source', viewModel.fqms?.monitoringSnapshots?.source ?? 'missing'],
    ['Monitoring Snapshot Status', viewModel.fqms?.monitoringSnapshots?.status ?? 'missing'],
    ['Monitoring Snapshot Rows', viewModel.fqms?.monitoringSnapshots?.snapshotCount ?? null],
    ['Monitoring Snapshot Missing Acc Sales', viewModel.fqms?.monitoringSnapshots?.missingAccumulatedSalesCount ?? null],
    ['Monitoring Snapshot Missing Avg PPM', viewModel.fqms?.monitoringSnapshots?.missingAverageDefectPpmCount ?? null],
    ['Monitoring Target Source', viewModel.fqms?.monitoringSnapshots?.targetSource ?? 'missing'],
    ['Computed At', viewModel.fqms?.computedAt ?? null]
  ])

  summary.getColumn(2).numFmt = '#,##0'
  summary.getCell(14, 2).numFmt = '#,##0.000000'
  summary.getCell(15, 2).numFmt = '#,##0.000000'
  summary.getCell(16, 2).numFmt = '#,##0.000000'
}

function fillFqmsQualityTrendSection(worksheet: ExcelJS.Worksheet, viewModel: ReportViewModel) {
  const months = viewModel.fqms?.monitoringSnapshots?.qualityTrend.months ?? []
  const sourceColumns = ['DZ', 'EA', 'EB', 'EC', 'ED', 'EE'] as const

  for (const [index, column] of sourceColumns.entries()) {
    const month = months[index]

    worksheet.getColumn(column).hidden = true
    worksheet.getCell(`${column}3`).value = month ? monthKeyToDate(month.monthKey) : null
    worksheet.getCell(`${column}4`).value = roundedNumber(month?.targetPpm ?? null)
    worksheet.getCell(`${column}5`).value = roundedNumber(month?.resultPpm ?? null)
    worksheet.getCell(`${column}3`).numFmt = 'mmm-yy'
    worksheet.getCell(`${column}4`).numFmt = '#,##0'
    worksheet.getCell(`${column}5`).numFmt = '#,##0'
  }
}

function fillFqmsAcceptanceRatioSection(worksheet: ExcelJS.Worksheet, viewModel: ReportViewModel) {
  const acceptance = viewModel.fqms?.monitoringSnapshots?.acceptanceRatio
  const periods = [acceptance?.fiscalHalf ?? null, ...(acceptance?.months ?? [])]
  const columns = ['M', 'N', 'O', 'P', 'Q', 'R', 'S']

  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    const period = periods[index]

    worksheet.getCell(`${column}7`).value = period ? (index === 0 ? period.label : monthKeyToDate(period.monthKey)) : null
    worksheet.getCell(`${column}8`).value = period?.totalModelCount ?? null
    worksheet.getCell(`${column}9`).value = period?.okModelCount ?? null
    worksheet.getCell(`${column}10`).value = period?.ngModelCount ?? null
    worksheet.getCell(`${column}11`).value = period?.acceptanceRatio ?? null
    worksheet.getCell(`${column}7`).numFmt = index === 0 ? '@' : 'mmm-yy'
    worksheet.getCell(`${column}8`).numFmt = '#,##0'
    worksheet.getCell(`${column}9`).numFmt = '#,##0'
    worksheet.getCell(`${column}10`).numFmt = '#,##0'
    worksheet.getCell(`${column}11`).numFmt = '0.0%'
  }
}

function fillFqmsDetailModelSection(worksheet: ExcelJS.Worksheet, viewModel: ReportViewModel) {
  const accumulated = viewModel.fqms?.accumulated

  if (!accumulated) {
    return
  }

  const modelStartRow = 23
  const modelEndRow = 36
  const totalRow = 37
  const targetMonthlyPpm = readNumberCellValue(worksheet.getCell('L23').value)

  const sortedRows = [...accumulated.rows].sort(compareFqmsAccumulatedRows)

  for (let rowNumber = modelStartRow; rowNumber <= modelEndRow; rowNumber += 1) {
    const model = sortedRows[rowNumber - modelStartRow]
    clearFqmsDetailModelRow(worksheet, rowNumber)

    if (!model) {
      continue
    }

    const defectPpm = model.defectPpm ?? null
    worksheet.getCell(`B${rowNumber}`).value = rowNumber - modelStartRow + 1
    worksheet.getCell(`C${rowNumber}`).value = model.reportModelCode
    worksheet.getCell(`D${rowNumber}`).value = model.launchingMonth ? monthKeyToDate(model.launchingMonth) : null
    worksheet.getCell(`E${rowNumber}`).value = roundedNumber(model.launchingPeriod)
    worksheet.getCell(`F${rowNumber}`).value = roundedNumber(model.accumulatedSales)
    worksheet.getCell(`G${rowNumber}`).value = roundedNumber(model.defectQty)
    worksheet.getCell(`H${rowNumber}`).value = roundedNumber(model.nonDefectQty)
    worksheet.getCell(`I${rowNumber}`).value = roundedNumber(model.totalClaimQty)
    worksheet.getCell(`J${rowNumber}`).value = roundedNumber(defectPpm)
    worksheet.getCell(`K${rowNumber}`).value = roundedNumber(model.nonDefectPpm)
    worksheet.getCell(`L${rowNumber}`).value = roundedNumber(targetMonthlyPpm)
    worksheet.getCell(`M${rowNumber}`).value = getDefectQualityLevel(defectPpm, targetMonthlyPpm)
    worksheet.getCell(`N${rowNumber}`).value = roundedNumber(model.exposure)
    applyFqmsDetailNumberFormats(worksheet, rowNumber)
  }

  clearFqmsDetailModelRow(worksheet, totalRow)
  worksheet.getCell(`C${totalRow}`).value = 'TOTAL'
  worksheet.getCell(`F${totalRow}`).value = roundedNumber(accumulated.totals.accumulatedSales)
  worksheet.getCell(`G${totalRow}`).value = roundedNumber(accumulated.totals.defectQty)
  worksheet.getCell(`H${totalRow}`).value = roundedNumber(accumulated.totals.nonDefectQty)
  worksheet.getCell(`I${totalRow}`).value = roundedNumber(accumulated.totals.totalClaimQty)
  worksheet.getCell(`J${totalRow}`).value = roundedNumber(accumulated.totals.defectPpm)
  worksheet.getCell(`K${totalRow}`).value = roundedNumber(accumulated.totals.nonDefectPpm)
  worksheet.getCell(`N${totalRow}`).value = roundedNumber(accumulated.totals.exposure)
  applyFqmsDetailNumberFormats(worksheet, totalRow)
  styleFqmsDetailTotalLabel(worksheet)
}

function clearFqmsDetailModelRow(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  for (const column of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']) {
    worksheet.getCell(`${column}${rowNumber}`).value = null
  }
}

function applyFqmsDetailNumberFormats(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  worksheet.getCell(`D${rowNumber}`).numFmt = 'mmm-yy'

  for (const column of ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'N']) {
    worksheet.getCell(`${column}${rowNumber}`).numFmt = '#,##0'
  }
}

function styleFqmsDetailTotalLabel(worksheet: ExcelJS.Worksheet) {
  if (!worksheet.model.merges.includes('C37:E37')) {
    worksheet.mergeCells('C37:E37')
  }

  const cell = worksheet.getCell('C37')
  cell.value = 'TOTAL'
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF31869B' }
  }
  cell.font = {
    name: 'Calibri',
    size: 9,
    color: { argb: 'FFFFFFFF' }
  }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

function fillFqmsWorstDefectSection(worksheet: ExcelJS.Worksheet, viewModel: ReportViewModel) {
  const accumulated = viewModel.fqms?.accumulated
  const worstDefects = viewModel.fqms?.worstDefects

  if (!accumulated) {
    return
  }

  const modelRows = [...accumulated.rows].sort(compareFqmsAccumulatedRows)
  const rowsByModel = new Map<string, NonNullable<NonNullable<ReportViewModel['fqms']>['worstDefects']>['rows']>()

  for (const row of worstDefects?.rows ?? []) {
    const rows = rowsByModel.get(row.reportModelCode) ?? []
    rows.push(row)
    rowsByModel.set(row.reportModelCode, rows)
  }

  const bucketCells = [
    { cell: 'F40', key: 'older' as const },
    { cell: 'G40', key: 'monthMinus2' as const },
    { cell: 'H40', key: 'monthMinus1' as const },
    { cell: 'I40', key: 'reportMonth' as const }
  ]

  for (const bucketCell of bucketCells) {
    const bucket = worstDefects?.buckets.find(item => item.key === bucketCell.key)
    worksheet.getCell(bucketCell.cell).value = bucket?.label ?? null
  }

  const sectionStartRow = 41
  const rowsPerModel = 3

  for (let modelIndex = 0; modelIndex < 14; modelIndex += 1) {
    const model = modelRows[modelIndex]
    const rowStart = sectionStartRow + modelIndex * rowsPerModel
    const modelWorstDefects = model ? (rowsByModel.get(model.reportModelCode) ?? []).slice(0, rowsPerModel) : []

    clearFqmsWorstDefectModelRows(worksheet, rowStart, rowsPerModel)

    if (!model) {
      continue
    }

    worksheet.getCell(`B${rowStart}`).value = model.reportModelCode
    worksheet.getCell(`B${rowStart}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

    for (let offset = 0; offset < rowsPerModel; offset += 1) {
      const rowNumber = rowStart + offset
      const defect = modelWorstDefects[offset]

      if (!defect) {
        continue
      }

      worksheet.getCell(`D${rowNumber}`).value = formatDefectLabel(defect.defect)
      worksheet.getCell(`F${rowNumber}`).value = defect.buckets.older
      worksheet.getCell(`G${rowNumber}`).value = defect.buckets.monthMinus2
      worksheet.getCell(`H${rowNumber}`).value = defect.buckets.monthMinus1
      worksheet.getCell(`I${rowNumber}`).value = defect.buckets.reportMonth
      worksheet.getCell(`J${rowNumber}`).value = roundedNumber(defect.total)
      worksheet.getCell(`K${rowNumber}`).value = defect.defectOccupancy
      worksheet.getCell(`L${rowNumber}`).value = roundedNumber(defect.defectPpm)
      applyFqmsWorstDefectNumberFormats(worksheet, rowNumber)
    }
  }
}

function clearFqmsWorstDefectModelRows(worksheet: ExcelJS.Worksheet, rowStart: number, rowsPerModel: number) {
  worksheet.getCell(`B${rowStart}`).value = null

  for (let offset = 0; offset < rowsPerModel; offset += 1) {
    const rowNumber = rowStart + offset

    for (const column of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
      worksheet.getCell(`${column}${rowNumber}`).value = null
    }

    applyFqmsWorstDefectNumberFormats(worksheet, rowNumber)
  }
}

function applyFqmsWorstDefectNumberFormats(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  for (const column of ['F', 'G', 'H', 'I', 'J', 'L']) {
    worksheet.getCell(`${column}${rowNumber}`).numFmt = '#,##0'
  }

  worksheet.getCell(`K${rowNumber}`).numFmt = '0.0%'
}

function formatDefectLabel(defect: string) {
  return defect
    .split('_')
    .map(part => part.slice(0, 1) + part.slice(1).toLowerCase())
    .join(' ')
}

function readNumberCellValue(value: ExcelJS.CellValue) {
  if (typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result
  }

  return null
}

function getDefectQualityLevel(defectPpm: number | null, targetMonthlyPpm: number | null) {
  if (defectPpm == null || targetMonthlyPpm == null) {
    return 'CHECK'
  }

  return defectPpm < targetMonthlyPpm ? 'OK' : 'NG'
}

function roundedNumber(value: number | null) {
  return value == null ? null : Math.ceil(value)
}

type FqmsAccumulatedModelRow = NonNullable<NonNullable<ReportViewModel['fqms']>['accumulated']>['rows'][number]

function compareFqmsAccumulatedRows(left: FqmsAccumulatedModelRow, right: FqmsAccumulatedModelRow) {
  return monthSortValue(left.launchingMonth) - monthSortValue(right.launchingMonth)
    || left.reportModelCode.localeCompare(right.reportModelCode)
}

function monthSortValue(monthKey: string | null) {
  return monthKey ? Number(monthKey.replace('-', '')) : Number.MAX_SAFE_INTEGER
}

function monthKeyToDate(monthKey: string) {
  const [yearText, monthText] = monthKey.includes('-')
    ? monthKey.split('-')
    : [monthKey.slice(0, 4), monthKey.slice(4, 6)]
  return createExcelMonthDate(Number(yearText), Number(monthText ?? 1))
}

function createExcelMonthDate(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 12))
}

function fillFcostTemplate(workbook: ExcelJS.Workbook, viewModel: ReportViewModel) {
  const worksheet = getRequiredWorksheet(workbook, 'F-Cost')
  worksheet.getCell('C3').value = `: ${viewModel.scope.productCode}`
  worksheet.getCell('C4').value = `: ${viewModel.scope.manufacturerCode}`

  createSummaryWorksheet(workbook, 'QRCC Summary', [
    ['Report Month', viewModel.scope.monthLabel],
    ['Product', viewModel.scope.productCode],
    ['Manufacturer', viewModel.scope.manufacturerCode],
    ['F-COST Status', viewModel.fcost?.status ?? 'missing'],
    ['Service Rows', viewModel.fcost?.serviceRows ?? null],
    ['Cost Rows', viewModel.fcost?.costRows ?? null],
    ['Parts Cost Rupiah', viewModel.fcost?.partsCostRupiah ?? null],
    ['Labor Cost Rupiah', viewModel.fcost?.laborCostRupiah ?? null],
    ['Transportation Cost Rupiah', viewModel.fcost?.transportationCostRupiah ?? null],
    ['Total Cost Rupiah', viewModel.fcost?.totalCostRupiah ?? null],
    ['Total Sales Amount Rupiah', viewModel.fcost?.totalSalesAmountRupiah ?? null],
    ['Cost vs Sales Ratio', viewModel.fcost?.costVsSalesRatio ?? null],
    ['Raw Total Cost Rupiah', viewModel.fcost?.rawTotalCostRupiah ?? null],
    ['Total Cost Difference Rupiah', viewModel.fcost?.totalCostDifferenceRupiah ?? null],
    ['Cross Check Status', viewModel.fcost?.crossCheckStatus ?? null],
    ['Computed At', viewModel.fcost?.computedAt ?? null]
  ])
}

function createSummaryWorksheet(workbook: ExcelJS.Workbook, name: string, rows: Array<[string, string | number | null]>) {
  const existing = workbook.getWorksheet(name)

  if (existing) {
    workbook.removeWorksheet(existing.id)
  }

  const worksheet = workbook.addWorksheet(name)
  worksheet.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 28 }
  ]
  worksheet.addRows(rows.map(([metric, value]) => ({ metric, value })))
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }
  }
  worksheet.getColumn(2).numFmt = '#,##0'

  return worksheet
}

function getRequiredWorksheet(workbook: ExcelJS.Workbook, name: string) {
  const worksheet = workbook.getWorksheet(name)

  if (!worksheet) {
    throw new Error(`Template worksheet "${name}" was not found.`)
  }

  return worksheet
}
