import { and, eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { rawSalesRows } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewRawSalesRow = InferInsertModel<typeof rawSalesRows>
const insertChunkSize = 100

export function createRawSalesRowsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    insertMany(rows: NewRawSalesRow[]) {
      if (rows.length === 0) {
        return []
      }

      return chunkRows(rows, insertChunkSize)
        .flatMap(chunk => database.insert(rawSalesRows).values(chunk).returning().all())
    },

    findByImportId(importId: number) {
      return database
        .select()
        .from(rawSalesRows)
        .where(eq(rawSalesRows.importId, importId))
        .orderBy(rawSalesRows.rowNumber)
        .all()
    },

    findByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(rawSalesRows)
        .where(eq(rawSalesRows.reportScopeId, reportScopeId))
        .orderBy(rawSalesRows.rowNumber)
        .all()
    },

    findByScopeAndMonth(reportScopeId: number, salesMonth: string) {
      return database
        .select()
        .from(rawSalesRows)
        .where(and(
          eq(rawSalesRows.reportScopeId, reportScopeId),
          eq(rawSalesRows.salesMonth, salesMonth)
        ))
        .orderBy(rawSalesRows.rowNumber)
        .all()
    },

    deleteByImportId(importId: number) {
      return database.delete(rawSalesRows).where(eq(rawSalesRows.importId, importId)).returning().all()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(rawSalesRows).where(eq(rawSalesRows.reportScopeId, reportScopeId)).returning().all()
    }
  }
}

export type RawSalesRowsRepository = ReturnType<typeof createRawSalesRowsRepository>

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}
