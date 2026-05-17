import type { DatabaseClient } from '../db/client'
import { getDb } from '../db/client'

export type RepositoryDb = DatabaseClient

export function resolveDb(db?: RepositoryDb) {
  return db ?? getDb()
}
