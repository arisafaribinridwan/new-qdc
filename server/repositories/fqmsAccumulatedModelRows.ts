import { eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { fqmsAccumulatedModelRows } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFqmsAccumulatedModelRow = InferInsertModel<typeof fqmsAccumulatedModelRows>
const insertChunkSize = 100

export function createFqmsAccumulatedModelRowsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    insertMany(rows: NewFqmsAccumulatedModelRow[]) {
      if (rows.length === 0) {
        return []
      }

      return chunkRows(rows, insertChunkSize)
        .flatMap(chunk => database.insert(fqmsAccumulatedModelRows).values(chunk).returning().all())
    },

    replaceForScope(reportScopeId: number, rows: NewFqmsAccumulatedModelRow[]) {
      database.delete(fqmsAccumulatedModelRows).where(eq(fqmsAccumulatedModelRows.reportScopeId, reportScopeId)).run()
      return this.insertMany(rows)
    },

    listByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(fqmsAccumulatedModelRows)
        .where(eq(fqmsAccumulatedModelRows.reportScopeId, reportScopeId))
        .orderBy(fqmsAccumulatedModelRows.reportModelCode, fqmsAccumulatedModelRows.sourceModelCode)
        .all()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(fqmsAccumulatedModelRows).where(eq(fqmsAccumulatedModelRows.reportScopeId, reportScopeId)).returning().all()
    }
  }
}

export type FqmsAccumulatedModelRowsRepository = ReturnType<typeof createFqmsAccumulatedModelRowsRepository>

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}
