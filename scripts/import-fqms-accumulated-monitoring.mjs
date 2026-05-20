import ExcelJS from 'exceljs'
import Database from 'better-sqlite3'
import { parse } from 'csv-parse/sync'
import fs from 'node:fs'
import path from 'node:path'

const reportMonth = normalizeMonthKey(process.argv[2] ?? '202604')
const monitoringDir = path.resolve(process.argv[3] ?? '.doc/raw')
const proofPath = path.resolve(process.argv[4] ?? 'storage/proofs/fqms-accumulated-lcd-local-2026-04.csv')
const databasePath = path.resolve(process.argv[5] ?? 'data/sqlite.db')

function cellValue(cell) {
  const value = cell.value
  return value && typeof value === 'object' && 'result' in value ? value.result : value
}

function isDateLike(value) {
  return Object.prototype.toString.call(value) === '[object Date]'
}

function monthKey(value) {
  if (isDateLike(value)) {
    return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}`
  }

  return normalizeMonthKey(String(value ?? ''))
}

function normalizeMonthKey(value) {
  const text = String(value ?? '').trim()

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text.replace('-', '')
  }

  return text
}

function normalizeModel(value) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').trim().toUpperCase()
}

function numberValue(value) {
  return Number(value) || 0
}

function parseProofRows(filePath) {
  const records = parse(fs.readFileSync(filePath, 'utf8'), {
    columns: true,
    skip_empty_lines: true
  })
  return new Map(records
    .filter(row => normalizeModel(row.source_model) !== 'TOTAL')
    .map(row => [normalizeModel(row.source_model), row]))
}

function findReportMonthColumn(worksheet) {
  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    if (monthKey(cellValue(worksheet.getCell(6, column))) === reportMonth) {
      return column
    }
  }

  return 0
}

function findFirstMonthColumn(worksheet, endColumn) {
  for (let column = 1; column <= endColumn; column += 1) {
    const value = cellValue(worksheet.getCell(6, column))

    if (isDateLike(value)) {
      return column
    }
  }

  return 0
}

async function readMonitoringWorkbook(file) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(monitoringDir, file))

  const worksheet = workbook.getWorksheet('summary')

  if (!worksheet) {
    throw new Error(`Missing summary sheet in ${file}`)
  }

  const sourceModel = String(cellValue(worksheet.getCell('E4')) ?? '').trim()
  const reportColumn = findReportMonthColumn(worksheet)

  if (!reportColumn) {
    throw new Error(`Missing report month ${reportMonth} in ${file}`)
  }

  const firstMonthColumn = findFirstMonthColumn(worksheet, reportColumn)

  if (!firstMonthColumn) {
    throw new Error(`Missing first monitoring month in ${file}`)
  }

  let nonDefectQty = 0

  for (let column = firstMonthColumn; column <= reportColumn; column += 1) {
    nonDefectQty += numberValue(cellValue(worksheet.getCell(10, column)))
  }

  return {
    sourceModelCode: sourceModel,
    monitoringFile: file,
    launchingMonth: monthKey(cellValue(worksheet.getCell('O4'))),
    launchingPeriod: numberValue(cellValue(worksheet.getCell(7, reportColumn))),
    defectQty: numberValue(cellValue(worksheet.getCell(12, reportColumn))),
    nonDefectQty
  }
}

function compareRows(actual, proof) {
  const mismatches = []
  const checks = [
    ['launching_month', actual.launchingMonth, normalizeMonthKey(proof.launching_month)],
    ['launching_period', actual.launchingPeriod, Number(proof.launching_period)],
    ['defect_qty', actual.defectQty, Number(proof.defect_qty)],
    ['non_defect_qty', actual.nonDefectQty, Number(proof.non_defect_qty)]
  ]

  for (const [field, actualValue, expectedValue] of checks) {
    if (actualValue !== expectedValue) {
      mismatches.push(`${field}: workbook=${actualValue} proof=${expectedValue}`)
    }
  }

  return mismatches
}

const proofRows = parseProofRows(proofPath)
const files = fs.readdirSync(monitoringDir)
  .filter(file => file.toLowerCase().endsWith('.xlsx'))
  .sort()

if (files.length !== 14) {
  throw new Error(`Expected 14 monitoring workbooks, found ${files.length}`)
}

const rows = []

for (const file of files) {
  const actual = await readMonitoringWorkbook(file)
  const proof = proofRows.get(normalizeModel(actual.sourceModelCode))

  if (!proof) {
    throw new Error(`Missing proof row for ${actual.sourceModelCode}`)
  }

  const mismatches = compareRows(actual, proof)

  if (mismatches.length > 0) {
    throw new Error(`Monitoring workbook ${file} does not match proof: ${mismatches.join('; ')}`)
  }

  const accumulatedSales = Number(proof.accumulated_sales)
  const totalClaimQty = actual.defectQty + actual.nonDefectQty

  rows.push({
    ...actual,
    reportModelCode: proof.source_model.replace(/^(\dT)C/, '$1-C'),
    accumulatedSales,
    totalClaimQty,
    sourceJson: JSON.stringify({
      proofSource: path.relative(process.cwd(), proofPath),
      monitoringWorkbook: path.relative(process.cwd(), path.join(monitoringDir, file)),
      verifiedAt: new Date().toISOString()
    })
  })
}

const totals = rows.reduce((result, row) => ({
  accumulatedSales: result.accumulatedSales + row.accumulatedSales,
  defectQty: result.defectQty + row.defectQty,
  nonDefectQty: result.nonDefectQty + row.nonDefectQty,
  totalClaimQty: result.totalClaimQty + row.totalClaimQty,
  exposure: result.exposure + row.accumulatedSales * row.launchingPeriod
}), {
  accumulatedSales: 0,
  defectQty: 0,
  nonDefectQty: 0,
  totalClaimQty: 0,
  exposure: 0
})

const db = new Database(databasePath)
db.pragma('foreign_keys = ON')

const scope = db.prepare(`
  SELECT report_scopes.id
  FROM report_scopes
  JOIN report_months ON report_months.id = report_scopes.report_month_id
  JOIN products ON products.id = report_scopes.product_id
  JOIN manufacturers ON manufacturers.id = report_scopes.manufacturer_id
  WHERE report_months.month_key = ?
    AND products.code = 'LCD'
    AND manufacturers.code = 'LOCAL'
`).get(reportMonth)

if (!scope) {
  db.close()
  throw new Error(`Missing report scope ${reportMonth}/LCD/LOCAL`)
}

const replaceRows = db.transaction(() => {
  db.prepare('DELETE FROM fqms_accumulated_model_rows WHERE report_scope_id = ?').run(scope.id)
  const insert = db.prepare(`
    INSERT INTO fqms_accumulated_model_rows (
      report_scope_id,
      source_model_code,
      report_model_code,
      monitoring_file,
      launching_month,
      launching_period,
      accumulated_sales,
      defect_qty,
      non_defect_qty,
      total_claim_qty,
      source_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const row of rows) {
    insert.run(
      scope.id,
      normalizeModel(row.sourceModelCode),
      row.reportModelCode,
      row.monitoringFile,
      row.launchingMonth,
      row.launchingPeriod,
      row.accumulatedSales,
      row.defectQty,
      row.nonDefectQty,
      row.totalClaimQty,
      row.sourceJson
    )
  }
})

replaceRows()
db.close()

console.log(`Verified and imported ${rows.length} monitoring workbooks into ${databasePath}`)
console.log(`Accumulated sales: ${totals.accumulatedSales}`)
console.log(`Defect qty: ${totals.defectQty}`)
console.log(`Non-defect qty: ${totals.nonDefectQty}`)
console.log(`Total claim qty: ${totals.totalClaimQty}`)
console.log(`Defect PPM: ${(totals.defectQty / totals.exposure * 1_000_000).toFixed(6)}`)
console.log(`Non-defect PPM: ${(totals.nonDefectQty / totals.exposure * 1_000_000).toFixed(6)}`)
console.log(`Total PPM: ${(totals.totalClaimQty / totals.exposure * 1_000_000).toFixed(6)}`)
