import { and, asc, eq, lte } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { salesHistoryRows } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewSalesHistoryRow = InferInsertModel<typeof salesHistoryRows>
const insertChunkSize = 200

export function createSalesHistoryRowsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    insertMany(rows: NewSalesHistoryRow[]) {
      if (rows.length === 0) {
        return []
      }

      return chunkRows(rows, insertChunkSize)
        .flatMap(chunk => database.insert(salesHistoryRows).values(chunk).returning().all())
    },

    listByScope(productId: number, manufacturerId: number) {
      return database
        .select()
        .from(salesHistoryRows)
        .where(and(
          eq(salesHistoryRows.productId, productId),
          eq(salesHistoryRows.manufacturerId, manufacturerId)
        ))
        .orderBy(asc(salesHistoryRows.salesMonth), asc(salesHistoryRows.reportModelCode))
        .all()
    },

    listByScopeThroughMonth(productId: number, manufacturerId: number, monthKey: string) {
      return database
        .select()
        .from(salesHistoryRows)
        .where(and(
          eq(salesHistoryRows.productId, productId),
          eq(salesHistoryRows.manufacturerId, manufacturerId),
          lte(salesHistoryRows.salesMonth, monthKey)
        ))
        .orderBy(asc(salesHistoryRows.salesMonth), asc(salesHistoryRows.reportModelCode))
        .all()
    },

    deleteByScope(productId: number, manufacturerId: number) {
      return database
        .delete(salesHistoryRows)
        .where(and(
          eq(salesHistoryRows.productId, productId),
          eq(salesHistoryRows.manufacturerId, manufacturerId)
        ))
        .returning()
        .all()
    }
  }
}

export type SalesHistoryRowsRepository = ReturnType<typeof createSalesHistoryRowsRepository>

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}
