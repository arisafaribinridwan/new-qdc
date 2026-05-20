import { and, eq, lte } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { fqmsMonitoringMonthlySnapshots } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFqmsMonitoringMonthlySnapshot = InferInsertModel<typeof fqmsMonitoringMonthlySnapshots>
const insertChunkSize = 100

export function createFqmsMonitoringMonthlySnapshotsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    insertMany(rows: NewFqmsMonitoringMonthlySnapshot[]) {
      if (rows.length === 0) {
        return []
      }

      return chunkRows(rows, insertChunkSize)
        .flatMap(chunk => database.insert(fqmsMonitoringMonthlySnapshots).values(chunk).returning().all())
    },

    replaceForScope(reportScopeId: number, rows: NewFqmsMonitoringMonthlySnapshot[]) {
      database.delete(fqmsMonitoringMonthlySnapshots).where(eq(fqmsMonitoringMonthlySnapshots.reportScopeId, reportScopeId)).run()
      return this.insertMany(rows)
    },

    listByReportScopeId(reportScopeId: number) {
      return database
        .select()
        .from(fqmsMonitoringMonthlySnapshots)
        .where(eq(fqmsMonitoringMonthlySnapshots.reportScopeId, reportScopeId))
        .orderBy(fqmsMonitoringMonthlySnapshots.monthKey, fqmsMonitoringMonthlySnapshots.reportModelCode, fqmsMonitoringMonthlySnapshots.sourceModelCode)
        .all()
    },

    listByReportScopeIdThroughMonth(reportScopeId: number, monthKey: string) {
      return database
        .select()
        .from(fqmsMonitoringMonthlySnapshots)
        .where(and(
          eq(fqmsMonitoringMonthlySnapshots.reportScopeId, reportScopeId),
          lte(fqmsMonitoringMonthlySnapshots.monthKey, monthKey)
        ))
        .orderBy(fqmsMonitoringMonthlySnapshots.monthKey, fqmsMonitoringMonthlySnapshots.reportModelCode, fqmsMonitoringMonthlySnapshots.sourceModelCode)
        .all()
    },

    deleteByReportScopeId(reportScopeId: number) {
      return database.delete(fqmsMonitoringMonthlySnapshots).where(eq(fqmsMonitoringMonthlySnapshots.reportScopeId, reportScopeId)).returning().all()
    }
  }
}

export type FqmsMonitoringMonthlySnapshotsRepository = ReturnType<typeof createFqmsMonitoringMonthlySnapshotsRepository>

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}
