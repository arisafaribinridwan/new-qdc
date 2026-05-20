import { and, eq, sql } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { rawServiceLineOverrides } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewRawServiceLineOverride = InferInsertModel<typeof rawServiceLineOverrides>

export function createRawServiceLineOverridesRepository(db?: RepositoryDb) {
  const database = resolveDb(db)
  const upsert = (values: NewRawServiceLineOverride) => database
    .insert(rawServiceLineOverrides)
    .values(values)
    .onConflictDoUpdate({
      target: [rawServiceLineOverrides.reportScopeId, rawServiceLineOverrides.lineKey],
      set: {
        notification: values.notification,
        overrideSymptom: values.overrideSymptom ?? null,
        overrideAction: values.overrideAction ?? null,
        note: values.note ?? null,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    })
    .returning()
    .get()

  return {
    create(values: NewRawServiceLineOverride) {
      return database.insert(rawServiceLineOverrides).values(values).returning().get()
    },

    upsert(values: NewRawServiceLineOverride) {
      return upsert(values)
    },

    upsertForLine(values: NewRawServiceLineOverride) {
      return upsert(values)
    },

    findByScopeAndLineKey(reportScopeId: number, lineKey: string) {
      return database
        .select()
        .from(rawServiceLineOverrides)
        .where(and(
          eq(rawServiceLineOverrides.reportScopeId, reportScopeId),
          eq(rawServiceLineOverrides.lineKey, lineKey)
        ))
        .get()
    },

    deleteByScopeAndLineKey(reportScopeId: number, lineKey: string) {
      return database
        .delete(rawServiceLineOverrides)
        .where(and(
          eq(rawServiceLineOverrides.reportScopeId, reportScopeId),
          eq(rawServiceLineOverrides.lineKey, lineKey)
        ))
        .returning()
        .get()
    },

    countByReportScopeId(reportScopeId: number) {
      const result = database
        .select({ count: sql<number>`count(*)` })
        .from(rawServiceLineOverrides)
        .where(eq(rawServiceLineOverrides.reportScopeId, reportScopeId))
        .get()

      return Number(result?.count ?? 0)
    },

    listByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(rawServiceLineOverrides)
        .where(eq(rawServiceLineOverrides.reportScopeId, reportScopeId))
        .orderBy(rawServiceLineOverrides.notification, rawServiceLineOverrides.lineKey)
        .all()
    }
  }
}

export type RawServiceLineOverridesRepository = ReturnType<typeof createRawServiceLineOverridesRepository>
