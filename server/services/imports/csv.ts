import { parse } from 'csv-parse'
import { Readable } from 'node:stream'

import { ImportValidationError } from './errors'
import type { CsvRecord, ParsedCsv } from './types'

type CsvCell = string | undefined
type CsvRow = CsvCell[]

export async function parseCsv(content: Buffer, requiredHeaders: readonly string[] = []): Promise<ParsedCsv> {
  const rows: CsvRow[] = []
  const delimiter = detectDelimiter(content, requiredHeaders)
  const parser = Readable
    .from([content])
    .pipe(parse({
      bom: true,
      delimiter,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: false
    }))

  try {
    for await (const row of parser) {
      rows.push(row as CsvRow)
    }
  }
  catch (error) {
    throw new ImportValidationError('CSV file could not be parsed.', {
      reason: error instanceof Error ? error.message : 'Unknown CSV parse error'
    })
  }

  if (rows.length === 0) {
    throw new ImportValidationError('CSV file must include a header row.')
  }

  const headerRowIndex = findHeaderRowIndex(rows, requiredHeaders)
  const headerRow = rows[headerRowIndex]

  if (!headerRow) {
    throw new ImportValidationError('CSV file must include a header row.')
  }

  const headers = normalizeHeaders(headerRow, requiredHeaders)
  const records = rows.slice(headerRowIndex + 1).map(row => toRecord(headers, row))

  return {
    headers,
    records,
    headerRowNumber: headerRowIndex + 1
  }
}

function findHeaderRowIndex(rows: CsvRow[], requiredHeaders: readonly string[]) {
  if (requiredHeaders.length === 0) {
    return 0
  }

  const foundIndex = rows.findIndex((row) => {
    const headerSet = new Set(row.map(column => normalizeHeaderName(column)))
    return requiredHeaders.every(header => headerSet.has(normalizeHeaderName(header)))
  })

  return foundIndex >= 0 ? foundIndex : 0
}

function normalizeHeaders(headerRow: CsvRow, requiredHeaders: readonly string[]) {
  const canonicalHeaderByName = new Map(
    requiredHeaders.map(header => [normalizeHeaderName(header), header])
  )

  return headerRow.map((column) => {
    const header = (column ?? '').trim()
    return canonicalHeaderByName.get(normalizeHeaderName(header)) ?? header
  })
}

function normalizeHeaderName(value: string | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function detectDelimiter(content: Buffer, requiredHeaders: readonly string[]) {
  const fallbackDelimiter = ','

  if (requiredHeaders.length === 0) {
    return fallbackDelimiter
  }

  const sampleLines = content
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 50)
  const candidates = [',', ';', '\t']
  const requiredHeaderSet = new Set(requiredHeaders.map(header => normalizeHeaderName(header)))
  let bestDelimiter = fallbackDelimiter
  let bestScore = -1

  for (const candidate of candidates) {
    const score = sampleLines.reduce((highestScore, line) => {
      const columnNames = line
        .split(candidate)
        .map(column => normalizeHeaderName(column))
      const matchedHeaders = columnNames.filter(column => requiredHeaderSet.has(column)).length

      return Math.max(highestScore, matchedHeaders)
    }, 0)

    if (score > bestScore) {
      bestDelimiter = candidate
      bestScore = score
    }
  }

  return bestDelimiter
}

function toRecord(headers: string[], row: CsvRow): CsvRecord {
  return headers.reduce<CsvRecord>((record, header, index) => {
    if (header) {
      record[header] = row[index]
    }

    return record
  }, {})
}
