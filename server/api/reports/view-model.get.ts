import { createError, getQuery } from 'h3'

import { ImportValidationError } from '../../services/imports'
import { ReportNotFoundError, getReportViewModel } from '../../reports'

export default defineEventHandler((event) => {
  try {
    const query = getQuery(event)

    return getReportViewModel({
      monthKey: asString(query.monthKey),
      productCode: asString(query.productCode),
      manufacturerCode: asString(query.manufacturerCode)
    })
  }
  catch (error) {
    if (error instanceof ImportValidationError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: error.details })
    }

    if (error instanceof ReportNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: error.message, data: error.details })
    }

    throw error
  }
})

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
