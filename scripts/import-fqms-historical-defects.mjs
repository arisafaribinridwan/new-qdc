import ExcelJS from 'exceljs'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const reportMonth = normalizeMonthKey(process.argv[2] ?? '202604')
const monitoringDir = path.resolve(process.argv[3] ?? '.doc/raw')
const databasePath = path.resolve(process.argv[4] ?? 'data/sqlite.db')
const requiredHeaders = [
  'notification',
  'job_sheet_section',
  'model_name',
  'factory',
  'model_series',
  'symptom',
  'action',
  'defect_category',
  'defect',
  'keydate'
]

function cellValue(cell) {
  const value = cell.value
  const result = value && typeof value === 'object' && 'result' in value ? value.result : value

  if (Object.prototype.toString.call(result) === '[object Date]') {
    return `${result.getFullYear()}${String(result.getMonth() + 1).padStart(2, '0')}`
  }

  return result
}

function normalizeMonthKey(value) {
  const text = String(value ?? '').trim()

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text.replace('-', '')
  }

  return text
}

function normalizeCode(value) {
  const text = String(value ?? '').trim().toUpperCase()
  return text.length > 0 ? text : null
}

function normalizeModel(value) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').trim().toUpperCase()
}

function normalizeText(value) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function parseOptionalInteger(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return null
  }

  const parsed = Number.parseInt(text, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function headerMap(worksheet, file) {
  const headers = new Map()

  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    const header = normalizeText(cellValue(worksheet.getCell(1, column)))

    if (header) {
      headers.set(header, column)
    }
  }

  const missing = requiredHeaders.filter(header => !headers.has(header))

  if (missing.length > 0) {
    throw new Error(`Missing raw sheet headers in ${file}: ${missing.join(', ')}`)
  }

  return headers
}

function recordFromRow(worksheet, headers, rowNumber) {
  const record = {}

  for (const [header, column] of headers.entries()) {
    const value = cellValue(worksheet.getCell(rowNumber, column))
    record[header] = value == null ? '' : String(value)
  }

  return record
}

async function readWorkbookRows(file, reportModelBySourceModel) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path.join(monitoringDir, file))

  const rawWorksheet = workbook.getWorksheet('raw')
  const summaryWorksheet = workbook.getWorksheet('summary')

  if (!rawWorksheet) {
    throw new Error(`Missing raw sheet in ${file}`)
  }

  if (!summaryWorksheet) {
    throw new Error(`Missing summary sheet in ${file}`)
  }

  const headers = headerMap(rawWorksheet, file)
  const sourceModelCode = normalizeModel(cellValue(summaryWorksheet.getCell('E4')))
  const reportModelCode = reportModelBySourceModel.get(sourceModelCode)

  if (!reportModelCode) {
    throw new Error(`Missing accumulated/report model mapping for ${sourceModelCode} from ${file}`)
  }

  const rows = []
  let defectQty = 0
  let nonDefectQty = 0

  for (let rowNumber = 2; rowNumber <= rawWorksheet.rowCount; rowNumber += 1) {
    const notification = normalizeText(cellValue(rawWorksheet.getCell(rowNumber, headers.get('notification'))))

    if (!notification) {
      continue
    }

    const record = recordFromRow(rawWorksheet, headers, rowNumber)
    const defectCategory = normalizeCode(record.defect_category)
    const defect = normalizeCode(record.defect)

    if (defectCategory === 'DEFECT' && defect && defect !== 'N/A') {
      defectQty += 1
    }
    else if (defectCategory === 'NON_DEFECT' && defect && defect !== 'N/A') {
      nonDefectQty += 1
    }

    rows.push({
      sourceModelCode,
      reportModelCode,
      monitoringFile: file,
      rowNumber,
      notification,
      keydate: normalizeMonthKey(record.keydate),
      jobSheetSection: parseOptionalInteger(record.job_sheet_section),
      factoryCode: normalizeText(record.factory),
      action: normalizeCode(record.action),
      defectCategory,
      defect,
      rawJson: JSON.stringify(record)
    })
  }

  const expectedDefectQty = numberValue(cellValue(summaryWorksheet.getCell('AD12')))
  let expectedNonDefectQty = 0

  for (let column = 1; column <= summaryWorksheet.columnCount; column += 1) {
    const keydate = normalizeMonthKey(cellValue(summaryWorksheet.getCell(6, column)))

    if (keydate && keydate <= reportMonth) {
      expectedNonDefectQty += numberValue(cellValue(summaryWorksheet.getCell(10, column)))
    }
  }

  if (defectQty !== expectedDefectQty || nonDefectQty !== expectedNonDefectQty) {
    throw new Error(
      `Raw sheet totals do not match summary in ${file}: `
      + `defect raw=${defectQty} summary=${expectedDefectQty}; `
      + `nonDefect raw=${nonDefectQty} summary=${expectedNonDefectQty}`
    )
  }

  return {
    file,
    rows,
    totals: {
      rows: rows.length,
      defectQty,
      nonDefectQty
    }
  }
}

function ensureTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS fqms_historical_defect_rows (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      report_scope_id integer NOT NULL,
      source_model_code text NOT NULL,
      report_model_code text NOT NULL,
      monitoring_file text NOT NULL,
      row_number integer NOT NULL,
      notification text,
      keydate text NOT NULL,
      job_sheet_section integer,
      factory_code text,
      action text,
      defect_category text,
      defect text,
      raw_json text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (report_scope_id) REFERENCES report_scopes(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS fqms_historical_defect_rows_scope_file_row_unique ON fqms_historical_defect_rows (report_scope_id, monitoring_file, row_number);
    CREATE INDEX IF NOT EXISTS fqms_historical_defect_rows_scope_keydate_idx ON fqms_historical_defect_rows (report_scope_id, keydate);
    CREATE INDEX IF NOT EXISTS fqms_historical_defect_rows_scope_model_idx ON fqms_historical_defect_rows (report_scope_id, report_model_code);
    CREATE INDEX IF NOT EXISTS fqms_historical_defect_rows_scope_defect_idx ON fqms_historical_defect_rows (report_scope_id, defect_category, defect);
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

if (files.length !== 14) {
  db.close()
  throw new Error(`Expected 14 monitoring workbooks, found ${files.length}`)
}

const imports = []

for (const file of files) {
  imports.push(await readWorkbookRows(file, reportModelBySourceModel))
}

const allRows = imports.flatMap(item => item.rows)
const insert = db.prepare(`
  INSERT INTO fqms_historical_defect_rows (
    report_scope_id,
    source_model_code,
    report_model_code,
    monitoring_file,
    row_number,
    notification,
    keydate,
    job_sheet_section,
    factory_code,
    action,
    defect_category,
    defect,
    raw_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

db.transaction(() => {
  db.prepare('DELETE FROM fqms_historical_defect_rows WHERE report_scope_id = ?').run(scope.id)

  for (const row of allRows) {
    insert.run(
      scope.id,
      row.sourceModelCode,
      row.reportModelCode,
      row.monitoringFile,
      row.rowNumber,
      row.notification,
      row.keydate,
      row.jobSheetSection,
      row.factoryCode,
      row.action,
      row.defectCategory,
      row.defect,
      row.rawJson
    )
  }
})()

db.close()

const totals = imports.reduce((result, item) => ({
  rows: result.rows + item.totals.rows,
  defectQty: result.defectQty + item.totals.defectQty,
  nonDefectQty: result.nonDefectQty + item.totals.nonDefectQty
}), { rows: 0, defectQty: 0, nonDefectQty: 0 })

console.log(`Imported ${totals.rows} historical FQMS rows from ${imports.length} workbooks into ${databasePath}`)
console.log(`Defect qty: ${totals.defectQty}`)
console.log(`Non-defect qty: ${totals.nonDefectQty}`)
