import ExcelJS from 'exceljs'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const reportMonth = normalizeMonthKey(process.argv[2] ?? '202604')
const monitoringDir = path.resolve(process.argv[3] ?? '.doc/raw')
const databasePath = path.resolve(process.argv[4] ?? 'data/sqlite.db')
const expectedWorkbookCount = 14

function cellValue(cell) {
  const value = cell.value

  if (value && typeof value === 'object') {
    if ('result' in value) {
      return value.result
    }

    if ('formula' in value || 'sharedFormula' in value) {
      return null
    }
  }

  return value
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
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableNumber(value) {
  if (value == null || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validateSummaryRows(worksheet, file) {
  const expected = new Map([
    [7, 'PASSING MONTH'],
    [8, 'SALES QTY'],
    [9, 'ACC SALES QTY'],
    [10, 'NON-DEFECT QTY'],
    [11, 'DEFECT QTY'],
    [12, 'ACC DEFECT'],
    [13, 'AVERAGE DEFECT PPM']
  ])

  for (const [rowNumber, label] of expected.entries()) {
    const actual = String(cellValue(worksheet.getCell(rowNumber, 3)) ?? '').trim().toUpperCase()

    if (actual !== label) {
      throw new Error(`Unexpected summary row ${rowNumber} in ${file}: expected ${label}, found ${actual || '(blank)'}`)
    }
  }
}

function findMonthColumns(worksheet, file) {
  const columns = []

  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    const key = monthKey(cellValue(worksheet.getCell(6, column)))

    if (/^\d{6}$/.test(key) && key <= reportMonth) {
      columns.push({ column, monthKey: key })
    }
  }

  if (columns.length === 0) {
    throw new Error(`Missing month columns through ${reportMonth} in ${file}`)
  }

  if (!columns.some(item => item.monthKey === reportMonth)) {
    throw new Error(`Missing report month ${reportMonth} in ${file}`)
  }

  return columns
}

async function readMonitoringWorkbook(file, reportModelBySourceModel) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(monitoringDir, file))

  const worksheet = workbook.getWorksheet('summary')

  if (!worksheet) {
    throw new Error(`Missing summary sheet in ${file}`)
  }

  validateSummaryRows(worksheet, file)

  const sourceModelCode = normalizeModel(cellValue(worksheet.getCell('E4')))
  const reportModelCode = reportModelBySourceModel.get(sourceModelCode)

  if (!reportModelCode) {
    throw new Error(`Missing accumulated/report model mapping for ${sourceModelCode} from ${file}. Run import-fqms-accumulated-monitoring first.`)
  }

  return findMonthColumns(worksheet, file).map(({ column, monthKey: key }) => {
    const salesQty = nullableNumber(cellValue(worksheet.getCell(8, column)))
    const accumulatedSales = nullableNumber(cellValue(worksheet.getCell(9, column)))
    const averageDefectPpm = nullableNumber(cellValue(worksheet.getCell(13, column)))

    return {
      sourceModelCode,
      reportModelCode,
      monitoringFile: file,
      monthKey: key,
      passingMonth: nullableNumber(cellValue(worksheet.getCell(7, column))),
      salesQty,
      accumulatedSales,
      monthlyNonDefectQty: numberValue(cellValue(worksheet.getCell(10, column))),
      monthlyDefectQty: numberValue(cellValue(worksheet.getCell(11, column))),
      accumulatedDefectQty: numberValue(cellValue(worksheet.getCell(12, column))),
      averageDefectPpm,
      sourceJson: JSON.stringify({
        workbook: path.relative(process.cwd(), path.join(monitoringDir, file)),
        sheet: 'summary',
        column,
        missingCachedValues: {
          salesQty: salesQty == null,
          accumulatedSales: accumulatedSales == null,
          averageDefectPpm: averageDefectPpm == null
        },
        importedAt: new Date().toISOString()
      })
    }
  })
}

function ensureTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS fqms_monitoring_monthly_snapshots (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      report_scope_id integer NOT NULL,
      source_model_code text NOT NULL,
      report_model_code text NOT NULL,
      monitoring_file text NOT NULL,
      month_key text NOT NULL,
      passing_month integer,
      sales_qty integer,
      accumulated_sales integer,
      monthly_defect_qty integer DEFAULT 0 NOT NULL,
      accumulated_defect_qty integer DEFAULT 0 NOT NULL,
      monthly_non_defect_qty integer DEFAULT 0 NOT NULL,
      average_defect_ppm real,
      source_json text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (report_scope_id) REFERENCES report_scopes(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS fqms_monitoring_monthly_snapshots_scope_file_month_unique ON fqms_monitoring_monthly_snapshots (report_scope_id, monitoring_file, month_key);
    CREATE INDEX IF NOT EXISTS fqms_monitoring_monthly_snapshots_scope_month_idx ON fqms_monitoring_monthly_snapshots (report_scope_id, month_key);
    CREATE INDEX IF NOT EXISTS fqms_monitoring_monthly_snapshots_scope_model_idx ON fqms_monitoring_monthly_snapshots (report_scope_id, report_model_code);
  `)
}

const db = new Database(databasePath)
db.pragma('foreign_keys = ON')
ensureTable(db)

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

const reportModelBySourceModel = new Map(db.prepare(`
  SELECT source_model_code, report_model_code
  FROM fqms_accumulated_model_rows
  WHERE report_scope_id = ?
`).all(scope.id).map(row => [normalizeModel(row.source_model_code), row.report_model_code]))

const files = fs.readdirSync(monitoringDir)
  .filter(file => file.toLowerCase().endsWith('.xlsx'))
  .sort()

if (files.length !== expectedWorkbookCount) {
  db.close()
  throw new Error(`Expected ${expectedWorkbookCount} monitoring workbooks, found ${files.length}`)
}

const imports = []

for (const file of files) {
  imports.push(...await readMonitoringWorkbook(file, reportModelBySourceModel))
}

const insert = db.prepare(`
  INSERT INTO fqms_monitoring_monthly_snapshots (
    report_scope_id,
    source_model_code,
    report_model_code,
    monitoring_file,
    month_key,
    passing_month,
    sales_qty,
    accumulated_sales,
    monthly_defect_qty,
    accumulated_defect_qty,
    monthly_non_defect_qty,
    average_defect_ppm,
    source_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

db.transaction(() => {
  db.prepare('DELETE FROM fqms_monitoring_monthly_snapshots WHERE report_scope_id = ?').run(scope.id)

  for (const row of imports) {
    insert.run(
      scope.id,
      row.sourceModelCode,
      row.reportModelCode,
      row.monitoringFile,
      row.monthKey,
      row.passingMonth,
      row.salesQty,
      row.accumulatedSales,
      row.monthlyDefectQty,
      row.accumulatedDefectQty,
      row.monthlyNonDefectQty,
      row.averageDefectPpm,
      row.sourceJson
    )
  }
})()

const reportMonthRows = imports.filter(row => row.monthKey === reportMonth)
const totals = imports.reduce((result, row) => ({
  monthlyNonDefectQty: result.monthlyNonDefectQty + row.monthlyNonDefectQty,
  missingAccumulatedSales: result.missingAccumulatedSales + (row.accumulatedSales == null ? 1 : 0),
  missingAverageDefectPpm: result.missingAverageDefectPpm + (row.averageDefectPpm == null ? 1 : 0)
}), { monthlyNonDefectQty: 0, missingAccumulatedSales: 0, missingAverageDefectPpm: 0 })
const reportMonthTotals = reportMonthRows.reduce((result, row) => ({
  accumulatedDefectQty: result.accumulatedDefectQty + row.accumulatedDefectQty,
  exposure: row.accumulatedSales == null || row.passingMonth == null
    ? null
    : result.exposure == null
      ? null
      : result.exposure + row.accumulatedSales * row.passingMonth
}), { accumulatedDefectQty: 0, exposure: 0 })

db.close()

if (reportMonthTotals.accumulatedDefectQty !== 4061 || totals.monthlyNonDefectQty !== 1025) {
  throw new Error(
    `Snapshot totals do not match April 2026 proof: `
    + `defect=${reportMonthTotals.accumulatedDefectQty} expected=4061; `
    + `nonDefect=${totals.monthlyNonDefectQty} expected=1025`
  )
}

console.log(`Imported ${imports.length} monthly monitoring snapshots from ${files.length} workbooks into ${databasePath}`)
console.log(`Report month accumulated defect qty: ${reportMonthTotals.accumulatedDefectQty}`)
console.log(`Accumulated non-defect qty through report month: ${totals.monthlyNonDefectQty}`)
console.log(`Missing accumulated sales cached values: ${totals.missingAccumulatedSales}`)
console.log(`Missing average defect PPM cached values: ${totals.missingAverageDefectPpm}`)
console.log(reportMonthTotals.exposure == null
  ? 'Exposure CHECK: ACC SALES QTY cached values are missing in summary sheets.'
  : `Exposure: ${reportMonthTotals.exposure}`)
