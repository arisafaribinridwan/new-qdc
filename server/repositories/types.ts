import type { DatabaseClient } from '../db/client'
import { getDb } from '../db/client'

type TransactionClient = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0]

export type RepositoryDb = DatabaseClient | TransactionClient

export function resolveDb(db?: RepositoryDb) {
  return db ?? getDb()
}
