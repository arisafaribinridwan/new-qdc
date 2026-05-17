import { desc, eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { validationIssues, validationRuns } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewValidationRun = InferInsertModel<typeof validationRuns>
type NewValidationIssue = InferInsertModel<typeof validationIssues>

export function createValidationRunsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    createRun(values: NewValidationRun) {
      return database.insert(validationRuns).values(values).returning().get()
    },

    findRunById(id: number) {
      return database.select().from(validationRuns).where(eq(validationRuns.id, id)).get()
    },

    findLatestRunByScope(reportScopeId: number) {
      return database
        .select()
        .from(validationRuns)
        .where(eq(validationRuns.reportScopeId, reportScopeId))
        .orderBy(desc(validationRuns.createdAt), desc(validationRuns.id))
        .get()
    },

    listRunsByScope(reportScopeId: number) {
      return database
        .select()
        .from(validationRuns)
        .where(eq(validationRuns.reportScopeId, reportScopeId))
        .orderBy(desc(validationRuns.createdAt), desc(validationRuns.id))
        .all()
    },

    addIssues(issues: NewValidationIssue[]) {
      if (issues.length === 0) {
        return []
      }

      return database.insert(validationIssues).values(issues).returning().all()
    },

    listIssuesByRunId(validationRunId: number) {
      return database
        .select()
        .from(validationIssues)
        .where(eq(validationIssues.validationRunId, validationRunId))
        .orderBy(validationIssues.id)
        .all()
    },

    deleteRun(id: number) {
      return database.delete(validationRuns).where(eq(validationRuns.id, id)).returning().get()
    }
  }
}

export type ValidationRunsRepository = ReturnType<typeof createValidationRunsRepository>
