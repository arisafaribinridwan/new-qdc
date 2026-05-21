import Database from 'better-sqlite3'
import { parse } from 'csv-parse/sync'
import fs from 'node:fs'
import path from 'node:path'

const csvPath = path.resolve(process.argv[2] ?? '.doc/sales-history-lcd-local.csv')
const reportMonth = normalizeMonthKey(process.argv[3] ?? '202604')
const databasePath = path.resolve(process.argv[4] ?? 'data/sqlite.db')
const productCode = normalizeCode(process.argv[5] ?? 'LCD')
const manufacturerCode = normalizeCode(process.argv[6] ?? 'LOCAL')
const expectedHeaders = ['Report Model', 'Sales Month', 'Sales Amount', 'Sales Qty']

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeModel(value) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').trim().toUpperCase()
}

function normalizeMonthKey(value) {
  const text = String(value ?? '').trim()

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text.replace('-', '')
  }

  if (/^\d{6}$/.test(text)) {
    return text
  }

  throw new Error(`Invalid month ${text || '(blank)'}. Use YYYY-MM or YYYYMM.`)
}

function parseInteger(value, field, rowNumber) {
  const text = String(value ?? '').trim()

  if (!text) {
    throw new Error(`Row ${rowNumber} is missing ${field}.`)
  }

  const parsed = Number.parseInt(text.replace(/[.,\s]/g, ''), 10)

  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber} has invalid ${field}: ${text}`)
  }

  return parsed
}

function parseCsvRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const records = parse(content, {
    bom: true,
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    trim: true
  })
  const headers = Object.keys(records[0] ?? {})
  const missingHeaders = expectedHeaders.filter(header => !headers.includes(header))

  if (missingHeaders.length > 0) {
    throw new Error(`Missing sales history headers: ${missingHeaders.join(', ')}`)
  }

  return records.map((record, index) => {
    const rowNumber = index + 2
    const reportModelCode = normalizeModel(record['Report Model'])

    if (!reportModelCode) {
      throw new Error(`Row ${rowNumber} is missing Report Model.`)
    }

    return {
      reportModelCode,
      salesMonth: normalizeMonthKey(record['Sales Month']),
      salesAmountRupiah: parseInteger(record['Sales Amount'], 'Sales Amount', rowNumber),
      salesQty: parseInteger(record['Sales Qty'], 'Sales Qty', rowNumber),
      sourceFilename: path.basename(filePath),
      rowNumber,
      rawJson: JSON.stringify(record)
    }
  })
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_history_rows (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      product_id integer NOT NULL,
      manufacturer_id integer NOT NULL,
      report_model_code text NOT NULL,
      sales_month text NOT NULL,
      sales_qty integer DEFAULT 0 NOT NULL,
      sales_amount_rupiah integer DEFAULT 0 NOT NULL,
      source_filename text NOT NULL,
      row_number integer NOT NULL,
      raw_json text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE cascade,
      FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sales_history_rows_scope_model_month_unique ON sales_history_rows (product_id, manufacturer_id, report_model_code, sales_month);
    CREATE INDEX IF NOT EXISTS sales_history_rows_scope_month_idx ON sales_history_rows (product_id, manufacturer_id, sales_month);
    CREATE INDEX IF NOT EXISTS sales_history_rows_scope_model_idx ON sales_history_rows (product_id, manufacturer_id, report_model_code);
  `)

  const rawSalesColumns = db.prepare('PRAGMA table_info(raw_sales_rows)').all().map(column => column.name)

  if (!rawSalesColumns.includes('sales_amount_rupiah')) {
    db.exec('ALTER TABLE raw_sales_rows ADD COLUMN sales_amount_rupiah integer DEFAULT 0 NOT NULL;')
  }
}

function getProductAndManufacturer(db) {
  const product = db.prepare('SELECT id, code FROM products WHERE upper(code) = ?').get(productCode)
  const manufacturer = db.prepare('SELECT id, code FROM manufacturers WHERE upper(code) = ?').get(manufacturerCode)

  if (!product) {
    throw new Error(`Missing product ${productCode}.`)
  }

  if (!manufacturer) {
    throw new Error(`Missing manufacturer ${manufacturerCode}.`)
  }

  return { product, manufacturer }
}

function getReportScope(db, productId, manufacturerId) {
  return db.prepare(`
    SELECT report_scopes.id
    FROM report_scopes
    JOIN report_months ON report_months.id = report_scopes.report_month_id
    WHERE report_months.month_key = ?
      AND report_scopes.product_id = ?
      AND report_scopes.manufacturer_id = ?
  `).get(reportMonth, productId, manufacturerId)
}

function aggregateDuplicateRows(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const key = `${row.reportModelCode}|${row.salesMonth}`
    const existing = grouped.get(key)

    if (existing) {
      existing.salesQty += row.salesQty
      existing.salesAmountRupiah += row.salesAmountRupiah
      existing.sourceRowNumbers.push(row.rowNumber)
      existing.rawRows.push(JSON.parse(row.rawJson))
      existing.rawJson = JSON.stringify({
        mergedRows: existing.rawRows,
        sourceRowNumbers: existing.sourceRowNumbers
      })
      continue
    }

    grouped.set(key, {
      ...row,
      sourceRowNumbers: [row.rowNumber],
      rawRows: [JSON.parse(row.rawJson)]
    })
  }

  return Array.from(grouped.values())
    .map((row) => {
      delete row.sourceRowNumbers
      delete row.rawRows
      return row
    })
    .sort((left, right) => left.salesMonth.localeCompare(right.salesMonth)
      || left.reportModelCode.localeCompare(right.reportModelCode))
}

function groupSales(rows) {
  const monthlyByModel = new Map()
  const accumulatedByModelMonth = new Map()
  const rowsByModel = new Map()

  for (const row of rows) {
    const modelRows = rowsByModel.get(row.reportModelCode) ?? []
    modelRows.push(row)
    rowsByModel.set(row.reportModelCode, modelRows)
    monthlyByModel.set(`${row.reportModelCode}|${row.salesMonth}`, row)
  }

  for (const [reportModelCode, modelRows] of rowsByModel.entries()) {
    let accumulatedQty = 0
    let accumulatedAmount = 0

    for (const row of modelRows.sort((left, right) => left.salesMonth.localeCompare(right.salesMonth))) {
      accumulatedQty += row.salesQty
      accumulatedAmount += row.salesAmountRupiah
      accumulatedByModelMonth.set(`${reportModelCode}|${row.salesMonth}`, {
        accumulatedQty,
        accumulatedAmount
      })
    }
  }

  return { monthlyByModel, accumulatedByModelMonth }
}

function replaceSalesHistory(db, rows, productId, manufacturerId) {
  const insert = db.prepare(`
    INSERT INTO sales_history_rows (
      product_id,
      manufacturer_id,
      report_model_code,
      sales_month,
      sales_qty,
      sales_amount_rupiah,
      source_filename,
      row_number,
      raw_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.prepare('DELETE FROM sales_history_rows WHERE product_id = ? AND manufacturer_id = ?').run(productId, manufacturerId)

  for (const row of rows) {
    insert.run(
      productId,
      manufacturerId,
      row.reportModelCode,
      row.salesMonth,
      row.salesQty,
      row.salesAmountRupiah,
      row.sourceFilename,
      row.rowNumber,
      row.rawJson
    )
  }
}

function updateReportMonthRawSales(db, rows, scopeId) {
  const reportRows = rows.filter(row => row.salesMonth === reportMonth)
  const previousImport = db.prepare(`
    SELECT id
    FROM data_imports
    WHERE report_scope_id = ?
      AND import_type = 'sales'
    ORDER BY imported_at DESC, id DESC
    LIMIT 1
  `).get(scopeId)
  const createdImport = db.prepare(`
    INSERT INTO data_imports (
      report_scope_id,
      import_type,
      source_filename,
      mode,
      status,
      row_count,
      accepted_count,
      rejected_count,
      warning_count,
      header_json,
      missing_headers_json,
      warning_json,
      replaced_import_id
    )
    VALUES (?, 'sales', ?, 'replace', 'completed', ?, ?, 0, 0, ?, '[]', '[]', ?)
    RETURNING id
  `).get(
    scopeId,
    path.basename(csvPath),
    reportRows.length,
    reportRows.length,
    JSON.stringify(expectedHeaders),
    previousImport?.id ?? null
  )
  const insert = db.prepare(`
    INSERT INTO raw_sales_rows (
      import_id,
      report_scope_id,
      row_number,
      sales_month,
      factory_code,
      model_code,
      model_name,
      quantity,
      sales_amount_rupiah,
      raw_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  if (previousImport) {
    db.prepare('DELETE FROM raw_sales_rows WHERE import_id = ?').run(previousImport.id)
  }

  for (const row of reportRows) {
    insert.run(
      createdImport.id,
      scopeId,
      row.rowNumber,
      row.salesMonth,
      null,
      row.reportModelCode,
      row.reportModelCode,
      row.salesQty,
      row.salesAmountRupiah,
      JSON.stringify({
        ...JSON.parse(row.rawJson),
        __source: 'verified_sales_history',
        __sourceFilename: path.basename(csvPath)
      })
    )
  }

  return {
    importId: createdImport.id,
    replacedImportId: previousImport?.id ?? null,
    rawSalesRows: reportRows.length,
    reportMonthQty: reportRows.reduce((total, row) => total + row.salesQty, 0),
    reportMonthAmount: reportRows.reduce((total, row) => total + row.salesAmountRupiah, 0)
  }
}

function updateFqmsAccumulatedRows(db, scopeId, grouped) {
  const rows = db.prepare(`
    SELECT id, source_model_code, report_model_code
    FROM fqms_accumulated_model_rows
    WHERE report_scope_id = ?
  `).all(scopeId)
  const duplicateReportModels = findDuplicateReportModels(rows)

  if (duplicateReportModels.length > 0) {
    throw new Error(`Cannot update accumulated sales when report models have multiple source rows: ${duplicateReportModels.join(', ')}`)
  }

  const update = db.prepare(`
    UPDATE fqms_accumulated_model_rows
    SET accumulated_sales = ?,
        source_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  let updated = 0
  const missing = []

  for (const row of rows) {
    const reportModelCode = normalizeModel(row.report_model_code)
    const accumulated = grouped.accumulatedByModelMonth.get(`${reportModelCode}|${reportMonth}`)

    if (!accumulated) {
      missing.push(row.report_model_code)
      continue
    }

    update.run(
      accumulated.accumulatedQty,
      JSON.stringify({
        salesHistorySource: path.basename(csvPath),
        salesHistoryReportModel: reportModelCode,
        salesHistoryMonth: reportMonth,
        accumulatedSalesAmountRupiah: accumulated.accumulatedAmount,
        updatedAt: new Date().toISOString()
      }),
      row.id
    )
    updated += 1
  }

  return { updated, missing }
}

function findDuplicateReportModels(rows) {
  const counts = new Map()

  for (const row of rows) {
    const key = normalizeModel(row.report_model_code)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
}

function updateMonitoringSnapshots(db, scopeId, grouped) {
  const rows = db.prepare(`
    SELECT id, report_model_code, month_key, passing_month, accumulated_defect_qty, source_json
    FROM fqms_monitoring_monthly_snapshots
    WHERE report_scope_id = ?
  `).all(scopeId)
  const update = db.prepare(`
    UPDATE fqms_monitoring_monthly_snapshots
    SET sales_qty = ?,
        accumulated_sales = ?,
        average_defect_ppm = ?,
        source_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  let updated = 0
  const missing = []

  for (const row of rows) {
    const reportModelCode = normalizeModel(row.report_model_code)
    const monthly = grouped.monthlyByModel.get(`${reportModelCode}|${row.month_key}`)
    const accumulated = grouped.accumulatedByModelMonth.get(`${reportModelCode}|${row.month_key}`)

    if (!monthly || !accumulated) {
      missing.push(`${row.report_model_code}/${row.month_key}`)
      continue
    }

    const exposure = accumulated.accumulatedQty > 0 && row.passing_month > 0
      ? accumulated.accumulatedQty * row.passing_month
      : 0
    const averageDefectPpm = exposure > 0
      ? Number((row.accumulated_defect_qty / exposure * 1_000_000).toFixed(6))
      : null
    const sourceJson = mergeSourceJson(row.source_json, {
      salesHistorySource: path.basename(csvPath),
      salesHistoryReportModel: reportModelCode,
      salesHistoryMonth: row.month_key,
      accumulatedSalesAmountRupiah: accumulated.accumulatedAmount,
      averageDefectPpmRecalculated: averageDefectPpm != null,
      updatedAt: new Date().toISOString()
    })

    update.run(
      monthly.salesQty,
      accumulated.accumulatedQty,
      averageDefectPpm,
      JSON.stringify(sourceJson),
      row.id
    )
    updated += 1
  }

  return { updated, missing }
}

function updateSummaries(db, scopeId, rawSales) {
  const fqms = db.prepare('SELECT id, claim_quantity, summary_json FROM fqms_summaries WHERE report_scope_id = ?').get(scopeId)
  const fcost = db.prepare('SELECT id, total_cost_rupiah, summary_json FROM fcost_summaries WHERE report_scope_id = ?').get(scopeId)
  let updatedFqms = false
  let updatedFcost = false

  if (fqms) {
    const details = mergeSourceJson(fqms.summary_json, {
      salesHistoryRows: rawSales.rawSalesRows,
      salesSource: 'verified_sales_history',
      ppm: rawSales.reportMonthQty > 0
        ? Math.ceil((fqms.claim_quantity / rawSales.reportMonthQty) * 1_000_000)
        : null,
      denominatorStatus: rawSales.reportMonthQty > 0 ? 'ok' : 'missing_or_zero',
      updatedFromSalesHistoryAt: new Date().toISOString()
    })

    db.prepare(`
      UPDATE fqms_summaries
      SET sales_quantity = ?,
          summary_json = ?,
          computed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rawSales.reportMonthQty, JSON.stringify(details), fqms.id)
    updatedFqms = true
  }

  if (fcost) {
    const details = mergeSourceJson(fcost.summary_json, {
      salesHistoryRows: rawSales.rawSalesRows,
      totalSalesAmountRupiah: rawSales.reportMonthAmount,
      costVsSalesRatio: rawSales.reportMonthAmount !== 0
        ? Number((fcost.total_cost_rupiah / rawSales.reportMonthAmount).toFixed(12))
        : null,
      updatedFromSalesHistoryAt: new Date().toISOString()
    })

    db.prepare(`
      UPDATE fcost_summaries
      SET summary_json = ?,
          computed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(details), fcost.id)
    updatedFcost = true
  }

  return { updatedFqms, updatedFcost }
}

function mergeSourceJson(value, updates) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...parsed, ...updates }
      : updates
  }
  catch {
    return updates
  }
}

const sourceRows = parseCsvRows(csvPath)
const rows = aggregateDuplicateRows(sourceRows)

const db = new Database(databasePath)
db.pragma('foreign_keys = ON')
ensureSchema(db)

const result = db.transaction(() => {
  const { product, manufacturer } = getProductAndManufacturer(db)
  const scope = getReportScope(db, product.id, manufacturer.id)

  if (!scope) {
    throw new Error(`Missing report scope ${reportMonth}/${productCode}/${manufacturerCode}.`)
  }

  const grouped = groupSales(rows)
  replaceSalesHistory(db, rows, product.id, manufacturer.id)
  const rawSales = updateReportMonthRawSales(db, rows, scope.id)
  const accumulated = updateFqmsAccumulatedRows(db, scope.id, grouped)
  const snapshots = updateMonitoringSnapshots(db, scope.id, grouped)
  const summaries = updateSummaries(db, scope.id, rawSales)

  return {
    productCode: product.code,
    manufacturerCode: manufacturer.code,
    reportMonth,
    sourceRows: sourceRows.length,
    salesHistoryRows: rows.length,
    modelCount: new Set(rows.map(row => row.reportModelCode)).size,
    rawSales,
    accumulated,
    snapshots,
    summaries
  }
})()

db.close()

console.log(`Imported ${result.salesHistoryRows} verified sales history rows for ${result.productCode}/${result.manufacturerCode}.`)
console.log(`Source CSV rows: ${result.sourceRows}`)
console.log(`Models: ${result.modelCount}`)
console.log(`Report month raw sales rows: ${result.rawSales.rawSalesRows}`)
console.log(`Report month sales qty: ${result.rawSales.reportMonthQty}`)
console.log(`Report month sales amount: ${result.rawSales.reportMonthAmount}`)
console.log(`Replaced sales import: ${result.rawSales.replacedImportId ?? 'none'} -> ${result.rawSales.importId}`)
console.log(`Updated FQMS accumulated rows: ${result.accumulated.updated}`)
console.log(`Updated FQMS monitoring snapshots: ${result.snapshots.updated}`)
console.log(`Updated FQMS summary: ${result.summaries.updatedFqms ? 'yes' : 'missing'}`)
console.log(`Updated F-COST summary: ${result.summaries.updatedFcost ? 'yes' : 'missing'}`)

if (result.accumulated.missing.length > 0) {
  console.log(`Missing accumulated sales for models: ${result.accumulated.missing.join(', ')}`)
}

if (result.snapshots.missing.length > 0) {
  console.log(`Missing snapshot sales buckets: ${result.snapshots.missing.slice(0, 20).join(', ')}${result.snapshots.missing.length > 20 ? '...' : ''}`)
}
