import { createError, readBody } from 'h3'

import { ImportValidationError } from '../../services/imports'
import { ReviewAnomaliesError, ReviewAnomaliesNotFoundError, saveRawServiceOverride } from '../../services/reviewAnomalies'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      monthKey?: string
      productCode?: string
      manufacturerCode?: string
      lineKey?: string
      overrideSymptom?: string | null
      overrideAction?: string | null
      note?: string | null
    }>(event)

    return saveRawServiceOverride(body ?? {})
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
