import { createError, getQuery } from 'h3'

import { ImportValidationError } from '../../services/imports'
import { ReviewAnomaliesError, ReviewAnomaliesNotFoundError, getReviewAnomalies } from '../../services/reviewAnomalies'

export default defineEventHandler((event) => {
  try {
    const query = getQuery(event)

    return getReviewAnomalies({
      monthKey: getQueryValue(query.monthKey),
      productCode: getQueryValue(query.productCode),
      manufacturerCode: getQueryValue(query.manufacturerCode)
    })
  }
  catch (error) {
    if (error instanceof ReviewAnomaliesNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: error.message, data: error.details })
    }

    if (error instanceof ImportValidationError || error instanceof ReviewAnomaliesError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: error.details })
    }

    throw error
  }
})

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0]?.toString()
  }

  return value?.toString()
}
