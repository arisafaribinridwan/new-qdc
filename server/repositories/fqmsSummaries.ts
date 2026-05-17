import { eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { fqmsSummaries } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFqmsSummary = InferInsertModel<typeof fqmsSummaries>

export function createFqmsSummariesRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewFqmsSummary) {
      return database.insert(fqmsSummaries).values(values).returning().get()
    },

    upsertForScope(values: NewFqmsSummary) {
      return database
        .insert(fqmsSummaries)
        .values(values)
        .onConflictDoUpdate({
          target: fqmsSummaries.reportScopeId,
          set: {
            salesImportId: values.salesImportId,
            serviceImportId: values.serviceImportId,
            salesQuantity: values.salesQuantity,
            claimQuantity: values.claimQuantity,
            defectCount: values.defectCount,
            nonDefectCount: values.nonDefectCount,
            status: values.status,
            summaryJson: values.summaryJson
          }
        })
        .returning()
        .get()
    },

    findByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(fqmsSummaries)
        .where(eq(fqmsSummaries.reportScopeId, reportScopeId))
        .get()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(fqmsSummaries).where(eq(fqmsSummaries.reportScopeId, reportScopeId)).returning().get()
    }
  }
}

export type FqmsSummariesRepository = ReturnType<typeof createFqmsSummariesRepository>
