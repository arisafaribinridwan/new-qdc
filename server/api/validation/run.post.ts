import { createError, readBody } from 'h3'

import { ImportValidationError } from '../../services/imports'
import { ValidationNotFoundError, runScopeValidation } from '../../services/validation'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      monthKey?: string
      productCode?: string
      manufacturerCode?: string
    }>(event)

    return runScopeValidation(body ?? {})
  }
  catch (error) {
    if (error instanceof ImportValidationError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: error.details })
    }

    if (error instanceof ValidationNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: error.message, data: error.details })
    }

    throw error
  }
})
