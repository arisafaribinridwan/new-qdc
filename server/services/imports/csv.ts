import { parse } from 'csv-parse'
import { Readable } from 'node:stream'

import { ImportValidationError } from './errors'
import type { CsvRecord, ParsedCsv } from './types'

export async function parseCsv(content: Buffer): Promise<ParsedCsv> {
  const headers: string[] = []
  const records: CsvRecord[] = []

  const parser = Readable
    .from([content])
    .pipe(parse({
      bom: true,
      columns(header: string[]) {
        headers.push(...header.map(column => column.trim()))
        return headers
      },
      relax_column_count: true,
      skip_empty_lines: true,
      trim: false
    }))

  try {
    for await (const record of parser) {
      records.push(record as CsvRecord)
    }
  }
  catch (error) {
    throw new ImportValidationError('CSV file could not be parsed.', {
      reason: error instanceof Error ? error.message : 'Unknown CSV parse error'
    })
  }

  if (headers.length === 0) {
    throw new ImportValidationError('CSV file must include a header row.')
  }

  return { headers, records }
}
