import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { factoryMappings } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewFactoryMapping = InferInsertModel<typeof factoryMappings>

export function createFactoryMappingsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewFactoryMapping) {
      return database.insert(factoryMappings).values(values).returning().get()
    },

    listByScope(productId: number, manufacturerId: number) {
      return database
        .select()
        .from(factoryMappings)
        .where(and(
          eq(factoryMappings.productId, productId),
          eq(factoryMappings.manufacturerId, manufacturerId)
        ))
        .orderBy(factoryMappings.factoryCode)
        .all()
    },

    listActiveByScope(productId: number, manufacturerId: number, monthKey: string) {
      return database
        .select()
        .from(factoryMappings)
        .where(and(
          eq(factoryMappings.productId, productId),
          eq(factoryMappings.manufacturerId, manufacturerId),
          eq(factoryMappings.isActive, true),
          lte(factoryMappings.validFromMonth, monthKey),
          or(isNull(factoryMappings.validToMonth), gte(factoryMappings.validToMonth, monthKey))
        ))
        .orderBy(factoryMappings.factoryCode)
        .all()
    },

    findByFactoryCode(productId: number, manufacturerId: number, factoryCode: string) {
      return database
        .select()
        .from(factoryMappings)
        .where(and(
          eq(factoryMappings.productId, productId),
          eq(factoryMappings.manufacturerId, manufacturerId),
          eq(factoryMappings.factoryCode, factoryCode)
        ))
        .get()
    },

    update(id: number, values: Partial<NewFactoryMapping>) {
      return database
        .update(factoryMappings)
        .set(values)
        .where(eq(factoryMappings.id, id))
        .returning()
        .get()
    },

    delete(id: number) {
      return database.delete(factoryMappings).where(eq(factoryMappings.id, id)).returning().get()
    }
  }
}

export type FactoryMappingsRepository = ReturnType<typeof createFactoryMappingsRepository>
