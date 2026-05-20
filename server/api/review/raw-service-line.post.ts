import { createError, readBody } from 'h3'

import { ImportValidationError } from '../../services/imports'
import {
  RawServiceReviewNotFoundError,
  RawServiceReviewValidationError,
  reviewRawServiceLine
} from '../../services/rawService'

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

    return reviewRawServiceLine(body ?? {})
  }
  catch (error) {
    if (error instanceof ImportValidationError || error instanceof RawServiceReviewValidationError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: error.details })
    }

    if (error instanceof RawServiceReviewNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: error.message, data: error.details })
    }

    throw error
  }
})
