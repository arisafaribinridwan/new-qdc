import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'

const reportMonth = '2026-04'
const monitoringDir = process.argv[2] || 'D:/ARISAFARI/Works/FQMS - Sharp Confidential/02_LCD SEID/RAW DATA/Monitoring/01_active'
const salesPath = process.argv[3] || 'C:/Users/GAY0700622/Documents/sales akumulasi into april 2026.csv'
const outputPath = process.argv[4] || 'storage/proofs/fqms-accumulated-lcd-local-2026-04.csv'

function normalizeModel(value) {
  return String(value ?? '').replace(/-/g, '').trim().toUpperCase()
}

function cellValue(cell) {
  const value = cell.value

  if (value && typeof value === 'object' && 'result' in value) {
    return value.result
  }

  return value
}

function monthKey(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
  }

  return String(value ?? '')
}

function numberValue(value) {
  return Number(value) || 0
}

function csvEscape(value) {
  const text = String(value ?? '')

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function parseAccumulatedSales(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim()
  const lines = text.split(/\r?\n/)
  const sales = new Map()

  for (const line of lines.slice(1)) {
    const [model, rawSales] = line.split(';')

    if (!model || !rawSales) {
      continue
    }

    sales.set(normalizeModel(model), Number(rawSales.replace(/\./g, '')))
  }

  return sales
}

function findReportMonthColumn(worksheet) {
  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    const value = cellValue(worksheet.getCell(6, column))

    if (value instanceof Date && monthKey(value) === reportMonth) {
      return column
    }
  }

  return 0
}

function findFirstMonthColumn(worksheet, endColumn) {
  for (let column = 1; column <= endColumn; column += 1) {
    if (cellValue(worksheet.getCell(6, column)) instanceof Date) {
      return column
    }
  }

  return 0
}

const sales = parseAccumulatedSales(salesPath)
const files = fs.readdirSync(monitoringDir)
  .filter(file => file.toLowerCase().endsWith('.xlsx'))
  .sort()

const rows = []
const totals = {
  accumulatedSales: 0,
  defectQty: 0,
  nonDefectQty: 0,
  totalClaimQty: 0,
  exposure: 0,
}

for (const file of files) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(monitoringDir, file))

  const worksheet = workbook.getWorksheet('summary')

  if (!worksheet) {
    throw new Error(`Missing summary sheet in ${file}`)
  }

  const sourceModel = String(cellValue(worksheet.getCell('E4')) ?? '').trim()
  const modelKey = normalizeModel(sourceModel)
  const accumulatedSales = sales.get(modelKey)

  if (accumulatedSales == null) {
    throw new Error(`Missing accumulated sales for ${sourceModel}`)
  }

  const reportColumn = findReportMonthColumn(worksheet)

  if (!reportColumn) {
    throw new Error(`Missing ${reportMonth} column in ${file}`)
  }

  const firstMonthColumn = findFirstMonthColumn(worksheet, reportColumn)

  if (!firstMonthColumn) {
    throw new Error(`Missing first month column in ${file}`)
  }

  const launchingMonth = monthKey(cellValue(worksheet.getCell('O4')))
  const launchingPeriod = numberValue(cellValue(worksheet.getCell(7, reportColumn)))
  const defectQty = numberValue(cellValue(worksheet.getCell(12, reportColumn)))
  let nonDefectQty = 0

  for (let column = firstMonthColumn; column <= reportColumn; column += 1) {
    nonDefectQty += numberValue(cellValue(worksheet.getCell(10, column)))
  }

  const totalClaimQty = defectQty + nonDefectQty
  const exposure = accumulatedSales * launchingPeriod
  const defectPpm = exposure ? defectQty / exposure * 1_000_000 : null
  const nonDefectPpm = exposure ? nonDefectQty / exposure * 1_000_000 : null
  const totalPpm = exposure ? totalClaimQty / exposure * 1_000_000 : null

  rows.push({
    report_month: reportMonth,
    source_model: sourceModel,
    monitoring_file: file,
    launching_month: launchingMonth,
    launching_period: launchingPeriod,
    accumulated_sales: accumulatedSales,
    defect_qty: defectQty,
    non_defect_qty: nonDefectQty,
    total_claim_qty: totalClaimQty,
    exposure,
    defect_ppm: defectPpm?.toFixed(6) ?? 'CHECK',
    non_defect_ppm: nonDefectPpm?.toFixed(6) ?? 'CHECK',
    total_ppm: totalPpm?.toFixed(6) ?? 'CHECK',
  })

  totals.accumulatedSales += accumulatedSales
  totals.defectQty += defectQty
  totals.nonDefectQty += nonDefectQty
  totals.totalClaimQty += totalClaimQty
  totals.exposure += exposure
}

const headers = [
  'report_month',
  'source_model',
  'monitoring_file',
  'launching_month',
  'launching_period',
  'accumulated_sales',
  'defect_qty',
  'non_defect_qty',
  'total_claim_qty',
  'exposure',
  'defect_ppm',
  'non_defect_ppm',
  'total_ppm',
]

const output = [
  headers.join(','),
  ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  [
    reportMonth,
    'TOTAL',
    '',
    '',
    '',
    totals.accumulatedSales,
    totals.defectQty,
    totals.nonDefectQty,
    totals.totalClaimQty,
    totals.exposure,
    (totals.defectQty / totals.exposure * 1_000_000).toFixed(6),
    (totals.nonDefectQty / totals.exposure * 1_000_000).toFixed(6),
    (totals.totalClaimQty / totals.exposure * 1_000_000).toFixed(6),
  ].map(csvEscape).join(','),
]

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${output.join('\n')}\n`)

console.log(`Wrote ${outputPath}`)
console.log(`Models: ${rows.length}`)
console.log(`Accumulated sales: ${totals.accumulatedSales}`)
console.log(`Defect qty: ${totals.defectQty}`)
console.log(`Non-defect qty: ${totals.nonDefectQty}`)
console.log(`Total claim qty: ${totals.totalClaimQty}`)
console.log(`Defect PPM: ${(totals.defectQty / totals.exposure * 1_000_000).toFixed(6)}`)
console.log(`Non-defect PPM: ${(totals.nonDefectQty / totals.exposure * 1_000_000).toFixed(6)}`)
console.log(`Total PPM: ${(totals.totalClaimQty / totals.exposure * 1_000_000).toFixed(6)}`)
