import { desc, eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { exportJobs } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewExportJob = InferInsertModel<typeof exportJobs>
type ExportJobUpdate = Partial<Pick<NewExportJob, 'status' | 'outputPath' | 'validationRunId' | 'completedAt'>>

export function createExportJobsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewExportJob) {
      return database.insert(exportJobs).values(values).returning().get()
    },

    update(id: number, values: ExportJobUpdate) {
      return database
        .update(exportJobs)
        .set(values)
        .where(eq(exportJobs.id, id))
        .returning()
        .get()
    },

    listByScope(reportScopeId: number) {
      return database
        .select()
        .from(exportJobs)
        .where(eq(exportJobs.reportScopeId, reportScopeId))
        .orderBy(desc(exportJobs.createdAt), desc(exportJobs.id))
        .all()
    }
  }
}

export type ExportJobsRepository = ReturnType<typeof createExportJobsRepository>
