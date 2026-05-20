import { getDb } from '../../db/client'
import { createMasterActionsRepository } from '../../repositories'
import type { ReviewActionOptionsResult } from './types'

export function getReviewActionOptions(): ReviewActionOptionsResult {
  const database = getDb()
  const actions = createMasterActionsRepository(database).listActive()

  return {
    items: actions.map(action => ({
      action: action.action,
      category: action.category,
      defect: action.defect,
      isActive: action.isActive
    }))
  }
}
