import { and, desc, eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'

import { dataImports, manufacturers, products, reportMonths, reportScopes } from '../db/schema'
import { resolveDb } from './types'
import type { RepositoryDb } from './types'

type NewDataImport = InferInsertModel<typeof dataImports>
type DataImportUpdate = Partial<Pick<NewDataImport, 'status' | 'rowCount' | 'acceptedCount' | 'rejectedCount' | 'warningCount' | 'headerJson' | 'missingHeadersJson' | 'warningJson' | 'replacedImportId'>>

export function createImportsRepository(db?: RepositoryDb) {
  const database = resolveDb(db)

  return {
    create(values: NewDataImport) {
      return database.insert(dataImports).values(values).returning().get()
    },

    findById(id: number) {
      return database.select().from(dataImports).where(eq(dataImports.id, id)).get()
    },

    listByScope(reportScopeId: number) {
      return database
        .select()
        .from(dataImports)
        .where(eq(dataImports.reportScopeId, reportScopeId))
        .orderBy(desc(dataImports.importedAt), desc(dataImports.id))
        .all()
    },

    listWithScope() {
      return database
        .select({
          import: dataImports,
          scope: reportScopes,
          reportMonth: reportMonths,
          product: products,
          manufacturer: manufacturers
        })
        .from(dataImports)
        .innerJoin(reportScopes, eq(dataImports.reportScopeId, reportScopes.id))
        .innerJoin(reportMonths, eq(reportScopes.reportMonthId, reportMonths.id))
        .innerJoin(products, eq(reportScopes.productId, products.id))
        .innerJoin(manufacturers, eq(reportScopes.manufacturerId, manufacturers.id))
        .orderBy(desc(dataImports.importedAt), desc(dataImports.id))
        .all()
    },

    findLatestByScopeAndType(reportScopeId: number, importType: NewDataImport['importType']) {
      return database
        .select()
        .from(dataImports)
        .where(and(
          eq(dataImports.reportScopeId, reportScopeId),
          eq(dataImports.importType, importType)
        ))
        .orderBy(desc(dataImports.importedAt), desc(dataImports.id))
        .get()
    },

    update(id: number, values: DataImportUpdate) {
      return database
        .update(dataImports)
        .set(values)
        .where(eq(dataImports.id, id))
        .returning()
        .get()
    },

    delete(id: number) {
      return database.delete(dataImports).where(eq(dataImports.id, id)).returning().get()
    }
  }
}

export type ImportsRepository = ReturnType<typeof createImportsRepository>
