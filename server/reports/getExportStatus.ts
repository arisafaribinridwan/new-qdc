import { getDb } from '../db/client'
import { createExportJobsRepository, createScopesRepository } from '../repositories'
import { resolveImportScope } from '../services/imports/validators'
import { ReportNotFoundError } from './errors'
import type { ReportExportStatus, ReportExportType, ReportScopeInput } from './types'

export function getReportExportStatus(input: ReportScopeInput = {}): ReportExportStatus {
  const scopeInput = resolveImportScope(input)
  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ReportNotFoundError('Selected report scope was not found.', scopeInput)
  }

  const jobs = createExportJobsRepository(database).listByScope(scopeResult.scope.id)
  const latestByType: ReportExportStatus['latestByType'] = {
    fqms_excel: findLatestByType(jobs, 'fqms_excel'),
    fcost_excel: findLatestByType(jobs, 'fcost_excel')
  }

  return {
    reportScopeId: scopeResult.scope.id,
    exported: Object.values(latestByType).some(job => job?.status === 'completed'),
    latestByType,
    jobs
  }
}

function findLatestByType(
  jobs: ReportExportStatus['jobs'],
  exportType: ReportExportType
) {
  return jobs.find(job => job.exportType === exportType) ?? null
}
