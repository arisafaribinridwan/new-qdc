import { and, eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { manufacturers, products, reportMonths, reportScopes } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewProduct = InferInsertModel<typeof products>
type NewManufacturer = InferInsertModel<typeof manufacturers>
type NewReportMonth = InferInsertModel<typeof reportMonths>
type NewReportScope = InferInsertModel<typeof reportScopes>

export function createScopesRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    createProduct(values: NewProduct) {
      return database.insert(products).values(values).returning().get()
    },

    findProductByCode(code: string) {
      return database.select().from(products).where(eq(products.code, code)).get()
    },

    createManufacturer(values: NewManufacturer) {
      return database.insert(manufacturers).values(values).returning().get()
    },

    findManufacturerByCode(code: string) {
      return database.select().from(manufacturers).where(eq(manufacturers.code, code)).get()
    },

    createReportMonth(values: NewReportMonth) {
      return database.insert(reportMonths).values(values).returning().get()
    },

    findReportMonthByKey(monthKey: string) {
      return database.select().from(reportMonths).where(eq(reportMonths.monthKey, monthKey)).get()
    },

    createReportScope(values: NewReportScope) {
      return database.insert(reportScopes).values(values).returning().get()
    },

    findReportScope(reportMonthId: number, productId: number, manufacturerId: number) {
      return database
        .select()
        .from(reportScopes)
        .where(and(
          eq(reportScopes.reportMonthId, reportMonthId),
          eq(reportScopes.productId, productId),
          eq(reportScopes.manufacturerId, manufacturerId)
        ))
        .get()
    },

    findReportScopeByCodes(monthKey: string, productCode: string, manufacturerCode: string) {
      return database
        .select({
          scope: reportScopes,
          reportMonth: reportMonths,
          product: products,
          manufacturer: manufacturers
        })
        .from(reportScopes)
        .innerJoin(reportMonths, eq(reportScopes.reportMonthId, reportMonths.id))
        .innerJoin(products, eq(reportScopes.productId, products.id))
        .innerJoin(manufacturers, eq(reportScopes.manufacturerId, manufacturers.id))
        .where(and(
          eq(reportMonths.monthKey, monthKey),
          eq(products.code, productCode),
          eq(manufacturers.code, manufacturerCode)
        ))
        .get()
    }
  }
}

export type ScopesRepository = ReturnType<typeof createScopesRepository>
