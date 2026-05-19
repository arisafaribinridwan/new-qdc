import { createError, readBody } from 'h3'

import { ReportExportBlockedError, ReportInvalidRequestError, ReportNotFoundError, exportReportExcel } from '../../reports'
import { ImportValidationError } from '../../services/imports'
import { ValidationNotFoundError } from '../../services/validation'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      monthKey?: string
      productCode?: string
      manufacturerCode?: string
      exportType?: string
    }>(event)

    return await exportReportExcel(body ?? {})
  }
  catch (error) {
    if (error instanceof ImportValidationError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: error.details })
    }

    if (error instanceof ReportInvalidRequestError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: error.details })
    }

    if (error instanceof ReportNotFoundError || error instanceof ValidationNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: error.message, data: error.details })
    }

    if (error instanceof ReportExportBlockedError) {
      throw createError({ statusCode: 409, statusMessage: error.message, data: error.details })
    }

    throw error
  }
})
