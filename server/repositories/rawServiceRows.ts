import { and, eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { rawServiceRows } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewRawServiceRow = InferInsertModel<typeof rawServiceRows>

export function createRawServiceRowsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    insertMany(rows: NewRawServiceRow[]) {
      if (rows.length === 0) {
        return []
      }

      return database.insert(rawServiceRows).values(rows).returning().all()
    },

    findByImportId(importId: number) {
      return database
        .select()
        .from(rawServiceRows)
        .where(eq(rawServiceRows.importId, importId))
        .orderBy(rawServiceRows.rowNumber)
        .all()
    },

    findByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(rawServiceRows)
        .where(eq(rawServiceRows.reportScopeId, reportScopeId))
        .orderBy(rawServiceRows.rowNumber)
        .all()
    },

    findByScopeAndKeydate(reportScopeId: number, keydate: string) {
      return database
        .select()
        .from(rawServiceRows)
        .where(and(
          eq(rawServiceRows.reportScopeId, reportScopeId),
          eq(rawServiceRows.keydate, keydate)
        ))
        .orderBy(rawServiceRows.rowNumber)
        .all()
    },

    deleteByImportId(importId: number) {
      return database.delete(rawServiceRows).where(eq(rawServiceRows.importId, importId)).returning().all()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(rawServiceRows).where(eq(rawServiceRows.reportScopeId, reportScopeId)).returning().all()
    }
  }
}

export type RawServiceRowsRepository = ReturnType<typeof createRawServiceRowsRepository>
