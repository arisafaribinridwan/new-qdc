import { eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { fcostSummaries } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFcostSummary = InferInsertModel<typeof fcostSummaries>

export function createFcostSummariesRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewFcostSummary) {
      return database.insert(fcostSummaries).values(values).returning().get()
    },

    upsertForScope(values: NewFcostSummary) {
      return database
        .insert(fcostSummaries)
        .values(values)
        .onConflictDoUpdate({
          target: fcostSummaries.reportScopeId,
          set: {
            serviceImportId: values.serviceImportId,
            rowCount: values.rowCount,
            partsCostRupiah: values.partsCostRupiah,
            laborCostRupiah: values.laborCostRupiah,
            transportationCostRupiah: values.transportationCostRupiah,
            totalCostRupiah: values.totalCostRupiah,
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
        .from(fcostSummaries)
        .where(eq(fcostSummaries.reportScopeId, reportScopeId))
        .get()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(fcostSummaries).where(eq(fcostSummaries.reportScopeId, reportScopeId)).returning().get()
    }
  }
}

export type FcostSummariesRepository = ReturnType<typeof createFcostSummariesRepository>
