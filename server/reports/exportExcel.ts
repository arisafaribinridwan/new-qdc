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
  worksheet.getCell('R4').value = new Date(viewModel.scope.calendarYear, viewModel.scope.calendarMonth - 1, 1)

  const summary = createSummaryWorksheet(workbook, 'QRCC Summary', [
    ['Report Month', viewModel.scope.monthLabel],
    ['Product', viewModel.scope.productCode],
    ['Manufacturer', viewModel.scope.manufacturerCode],
    ['FQMS Status', viewModel.fqms?.status ?? 'missing'],
    ['Sales Quantity', viewModel.fqms?.salesQuantity ?? null],
    ['Claim Quantity', viewModel.fqms?.claimQuantity ?? null],
    ['Defect Count', viewModel.fqms?.defectCount ?? null],
    ['Non Defect Count', viewModel.fqms?.nonDefectCount ?? null],
    ['Unclassified Claim Rows', viewModel.fqms?.unclassifiedClaimRows ?? null],
    ['PPM', viewModel.fqms?.ppm ?? null],
    ['Computed At', viewModel.fqms?.computedAt ?? null]
  ])

  summary.getColumn(2).numFmt = '#,##0'
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
