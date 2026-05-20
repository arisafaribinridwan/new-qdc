import { getDb } from '../../db/client'
import { createScopesRepository, createValidationRunsRepository } from '../../repositories'
import { resolveImportScope } from '../imports/validators'
import { ValidationNotFoundError } from './errors'
import type { ValidationRunResult, ValidationRunSummary, ValidationScopeInput } from './types'

const emptySummary: ValidationRunSummary = {
  issueCounts: {
    critical: 0,
    error: 0,
    warning: 0,
    check: 0
  },
  exportReady: false,
  importStatus: {
    sales: false,
    rawService: false
  },
  rawService: {
    currentMonthRows: 0,
    duplicateLineKeys: 0,
    manualOverrideCount: 0,
    invalidOverrideActionCount: 0,
    stagingCompare: {
      NEW_NOTIFICATION: 0,
      DUPLICATE_UNCHANGED: 0,
      SOURCE_CHANGED: 0,
      LINE_COUNT_CHANGED: 0,
      HAS_MANUAL_OVERRIDE: 0,
      OVERRIDE_CONFLICT: 0
    }
  },
  aggregation: {
    salesQuantity: null,
    fqmsClaimQuantity: null,
    fcostTotalRupiah: null
  }
}

export function getLatestValidation(input: ValidationScopeInput = {}): ValidationRunResult | null {
  const scopeInput = resolveImportScope(input)
  const database = getDb()
  const scopeResult = createScopesRepository(database).findReportScopeByCodes(
    scopeInput.monthKey,
    scopeInput.productCode,
    scopeInput.manufacturerCode
  )

  if (!scopeResult) {
    throw new ValidationNotFoundError('Selected report scope was not found.', scopeInput)
  }

  const validationRepository = createValidationRunsRepository(database)
  const run = validationRepository.findLatestRunByScope(scopeResult.scope.id)

  if (!run) {
    return null
  }

  const summary = parseSummary(run.summaryJson)

  return {
    reportScopeId: scopeResult.scope.id,
    monthKey: scopeInput.monthKey,
    productCode: scopeInput.productCode,
    manufacturerCode: scopeInput.manufacturerCode,
    status: run.status,
    exportReady: summary.exportReady,
    run,
    issues: validationRepository.listIssuesByRunId(run.id),
    summary
  }
}

function parseSummary(value: string | null): ValidationRunSummary {
  if (!value) {
    return emptySummary
  }

  try {
    const parsed: unknown = JSON.parse(value)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptySummary
    }

    const summary = parsed as Partial<ValidationRunSummary>

    return {
      ...emptySummary,
      ...summary,
      issueCounts: {
        ...emptySummary.issueCounts,
        ...summary.issueCounts
      },
      importStatus: {
        ...emptySummary.importStatus,
        ...summary.importStatus
      },
      rawService: {
        ...emptySummary.rawService,
        ...summary.rawService,
        stagingCompare: {
          ...emptySummary.rawService.stagingCompare,
          ...summary.rawService?.stagingCompare
        }
      },
      aggregation: {
        ...emptySummary.aggregation,
        ...summary.aggregation
      }
    }
  }
  catch {
    return emptySummary
  }
}
