import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { fqmsModelSeries } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFqmsModelSeries = InferInsertModel<typeof fqmsModelSeries>

export function createFqmsModelSeriesRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewFqmsModelSeries) {
      return database.insert(fqmsModelSeries).values(values).returning().get()
    },

    listByScope(productId: number, manufacturerId: number) {
      return database
        .select()
        .from(fqmsModelSeries)
        .where(and(
          eq(fqmsModelSeries.productId, productId),
          eq(fqmsModelSeries.manufacturerId, manufacturerId)
        ))
        .orderBy(fqmsModelSeries.reportModelCode, fqmsModelSeries.modelCode)
        .all()
    },

    listActiveByScope(productId: number, manufacturerId: number, monthKey: string) {
      return database
        .select()
        .from(fqmsModelSeries)
        .where(and(
          eq(fqmsModelSeries.productId, productId),
          eq(fqmsModelSeries.manufacturerId, manufacturerId),
          eq(fqmsModelSeries.isActive, true),
          lte(fqmsModelSeries.validFromMonth, monthKey),
          or(isNull(fqmsModelSeries.validToMonth), gte(fqmsModelSeries.validToMonth, monthKey))
        ))
        .orderBy(fqmsModelSeries.reportModelCode, fqmsModelSeries.modelCode)
        .all()
    }
  }
}

export type FqmsModelSeriesRepository = ReturnType<typeof createFqmsModelSeriesRepository>
