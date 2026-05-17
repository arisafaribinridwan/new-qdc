import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const manufacturers = sqliteTable('manufacturers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const reportMonths = sqliteTable('report_months', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  monthKey: text('month_key').notNull().unique(),
  label: text('label').notNull(),
  calendarYear: integer('calendar_year').notNull(),
  calendarMonth: integer('calendar_month').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalHalf: text('fiscal_half', { enum: ['FH', 'LH'] }).notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const reportScopes = sqliteTable('report_scopes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportMonthId: integer('report_month_id').notNull().references(() => reportMonths.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  manufacturerId: integer('manufacturer_id').notNull().references(() => manufacturers.id, { onDelete: 'restrict' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex('report_scopes_month_product_manufacturer_unique').on(table.reportMonthId, table.productId, table.manufacturerId)
])

export const factoryMappings = sqliteTable('factory_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  manufacturerId: integer('manufacturer_id').notNull().references(() => manufacturers.id, { onDelete: 'cascade' }),
  factoryCode: text('factory_code').notNull(),
  factoryName: text('factory_name').notNull(),
  validFromMonth: text('valid_from_month').notNull(),
  validToMonth: text('valid_to_month'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex('factory_mappings_scope_factory_unique').on(table.productId, table.manufacturerId, table.factoryCode),
  index('factory_mappings_scope_idx').on(table.productId, table.manufacturerId)
])

export const dataImports = sqliteTable('data_imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  importType: text('import_type', { enum: ['sales', 'raw_service'] }).notNull(),
  sourceFilename: text('source_filename').notNull(),
  mode: text('mode', { enum: ['replace'] }).notNull().default('replace'),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
  rowCount: integer('row_count').notNull().default(0),
  acceptedCount: integer('accepted_count').notNull().default(0),
  rejectedCount: integer('rejected_count').notNull().default(0),
  warningCount: integer('warning_count').notNull().default(0),
  headerJson: text('header_json'),
  missingHeadersJson: text('missing_headers_json'),
  warningJson: text('warning_json'),
  replacedImportId: integer('replaced_import_id'),
  importedAt: text('imported_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('data_imports_scope_type_idx').on(table.reportScopeId, table.importType)
])

export const rawSalesRows = sqliteTable('raw_sales_rows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importId: integer('import_id').notNull().references(() => dataImports.id, { onDelete: 'cascade' }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  salesMonth: text('sales_month').notNull(),
  factoryCode: text('factory_code'),
  modelCode: text('model_code'),
  modelName: text('model_name'),
  quantity: integer('quantity').notNull().default(0),
  rawJson: text('raw_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('raw_sales_rows_import_idx').on(table.importId),
  index('raw_sales_rows_scope_month_idx').on(table.reportScopeId, table.salesMonth)
])

export const rawServiceRows = sqliteTable('raw_service_rows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importId: integer('import_id').notNull().references(() => dataImports.id, { onDelete: 'cascade' }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  keydate: text('keydate').notNull(),
  factoryCode: text('factory_code'),
  modelCode: text('model_code'),
  modelName: text('model_name'),
  jobSheetSection: integer('job_sheet_section'),
  symptomCode: text('symptom_code'),
  symptomName: text('symptom_name'),
  partsCost: integer('parts_cost').notNull().default(0),
  laborCost: integer('labor_cost').notNull().default(0),
  transportationCost: integer('transportation_cost').notNull().default(0),
  totalCost: integer('total_cost').notNull().default(0),
  rawJson: text('raw_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('raw_service_rows_import_idx').on(table.importId),
  index('raw_service_rows_scope_keydate_idx').on(table.reportScopeId, table.keydate)
])

export const fqmsSummaries = sqliteTable('fqms_summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  salesImportId: integer('sales_import_id').references(() => dataImports.id, { onDelete: 'set null' }),
  serviceImportId: integer('service_import_id').references(() => dataImports.id, { onDelete: 'set null' }),
  salesQuantity: integer('sales_quantity').notNull().default(0),
  claimQuantity: integer('claim_quantity').notNull().default(0),
  defectCount: integer('defect_count').notNull().default(0),
  nonDefectCount: integer('non_defect_count').notNull().default(0),
  status: text('status', { enum: ['ok', 'check'] }).notNull().default('check'),
  summaryJson: text('summary_json'),
  computedAt: text('computed_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex('fqms_summaries_scope_unique').on(table.reportScopeId)
])

export const fcostSummaries = sqliteTable('fcost_summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  serviceImportId: integer('service_import_id').references(() => dataImports.id, { onDelete: 'set null' }),
  rowCount: integer('row_count').notNull().default(0),
  partsCostRupiah: integer('parts_cost_rupiah').notNull().default(0),
  laborCostRupiah: integer('labor_cost_rupiah').notNull().default(0),
  transportationCostRupiah: integer('transportation_cost_rupiah').notNull().default(0),
  totalCostRupiah: integer('total_cost_rupiah').notNull().default(0),
  status: text('status', { enum: ['ok', 'check'] }).notNull().default('check'),
  summaryJson: text('summary_json'),
  computedAt: text('computed_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  uniqueIndex('fcost_summaries_scope_unique').on(table.reportScopeId)
])

export const validationRuns = sqliteTable('validation_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['ok', 'blocked', 'check'] }).notNull().default('check'),
  criticalCount: integer('critical_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  warningCount: integer('warning_count').notNull().default(0),
  summaryJson: text('summary_json'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('validation_runs_scope_idx').on(table.reportScopeId)
])

export const validationIssues = sqliteTable('validation_issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  validationRunId: integer('validation_run_id').notNull().references(() => validationRuns.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  severity: text('severity', { enum: ['critical', 'error', 'warning', 'check'] }).notNull(),
  reason: text('reason').notNull(),
  relatedPage: text('related_page'),
  relatedDataJson: text('related_data_json'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('validation_issues_run_idx').on(table.validationRunId)
])

export const exportJobs = sqliteTable('export_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportScopeId: integer('report_scope_id').notNull().references(() => reportScopes.id, { onDelete: 'cascade' }),
  exportType: text('export_type', { enum: ['fqms_excel', 'fcost_excel'] }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'blocked', 'failed'] }).notNull().default('pending'),
  outputPath: text('output_path'),
  validationRunId: integer('validation_run_id').references(() => validationRuns.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at')
}, table => [
  index('export_jobs_scope_idx').on(table.reportScopeId)
])
