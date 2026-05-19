import { eq, sql } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { rawServiceLineOverrides } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewRawServiceLineOverride = InferInsertModel<typeof rawServiceLineOverrides>

export function createRawServiceLineOverridesRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewRawServiceLineOverride) {
      return database.insert(rawServiceLineOverrides).values(values).returning().get()
    },

    countByReportScopeId(reportScopeId: number) {
      const result = database
        .select({ count: sql<number>`count(*)` })
        .from(rawServiceLineOverrides)
        .where(eq(rawServiceLineOverrides.reportScopeId, reportScopeId))
        .get()

      return Number(result?.count ?? 0)
    }
  }
}

export type RawServiceLineOverridesRepository = ReturnType<typeof createRawServiceLineOverridesRepository>
