export const defaultImportScope = {
  monthKey: '202604',
  productCode: 'LCD',
  manufacturerCode: 'LOCAL'
} as const

export const salesRequiredHeaders = [
  'Model',
  'Report Model',
  'Category',
  'Sales Amount',
  'Sales (Qty)',
  'Factory'
] as const

export const rawServiceRequiredHeaders = [
  'notification',
  'job_sheet_section',
  'malfunction_start_date',
  'basic_finish_date',
  'model_name',
  'category',
  'serial_number',
  'symptom_code',
  'symptom_code_description',
  'pmacttype',
  'pmacttype_description',
  'symptom_comment',
  'repair_comment',
  'description',
  'warranty',
  'planner_group',
  'branch',
  'purchased_date',
  'labor_cost',
  'transportation_cost',
  'parts_cost',
  'part_used',
  'section',
  'prod_lot',
  'prod_date',
  'inch',
  'total_cost',
  'diff_month',
  'part_name',
  'panel_usage',
  'factory',
  'model_series',
  'symptom',
  'action',
  'defect_category',
  'defect',
  'keydate'
] as const

export const importTypes = {
  sales: 'sales',
  rawService: 'raw_service'
} as const
