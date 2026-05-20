import { eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { masterActions } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewMasterAction = InferInsertModel<typeof masterActions>

export function createMasterActionsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewMasterAction) {
      return database.insert(masterActions).values(values).returning().get()
    },

    findByAction(action: string) {
      return database
        .select()
        .from(masterActions)
        .where(eq(masterActions.action, action))
        .get()
    },

    listAll() {
      return database
        .select()
        .from(masterActions)
        .orderBy(masterActions.action)
        .all()
    },

    listActive() {
      return database
        .select()
        .from(masterActions)
        .where(eq(masterActions.isActive, true))
        .orderBy(masterActions.action)
        .all()
    }
  }
}

export type MasterActionsRepository = ReturnType<typeof createMasterActionsRepository>
