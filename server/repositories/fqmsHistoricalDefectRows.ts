import { eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { fqmsHistoricalDefectRows } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFqmsHistoricalDefectRow = InferInsertModel<typeof fqmsHistoricalDefectRows>
const insertChunkSize = 100

export function createFqmsHistoricalDefectRowsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    insertMany(rows: NewFqmsHistoricalDefectRow[]) {
      if (rows.length === 0) {
        return []
      }

      return chunkRows(rows, insertChunkSize)
        .flatMap(chunk => database.insert(fqmsHistoricalDefectRows).values(chunk).returning().all())
    },

    replaceForScope(reportScopeId: number, rows: NewFqmsHistoricalDefectRow[]) {
      database.delete(fqmsHistoricalDefectRows).where(eq(fqmsHistoricalDefectRows.reportScopeId, reportScopeId)).run()
      return this.insertMany(rows)
    },

    listByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(fqmsHistoricalDefectRows)
        .where(eq(fqmsHistoricalDefectRows.reportScopeId, reportScopeId))
        .orderBy(fqmsHistoricalDefectRows.reportModelCode, fqmsHistoricalDefectRows.keydate, fqmsHistoricalDefectRows.rowNumber)
        .all()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(fqmsHistoricalDefectRows).where(eq(fqmsHistoricalDefectRows.reportScopeId, reportScopeId)).returning().all()
    }
  }
}

export type FqmsHistoricalDefectRowsRepository = ReturnType<typeof createFqmsHistoricalDefectRowsRepository>

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}
