import { createError, readBody } from 'h3'

import { AggregationNotFoundError, reprocessScopeAggregation } from '../../services/aggregation'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      monthKey?: string
      productCode?: string
      manufacturerCode?: string
    }>(event)

    return reprocessScopeAggregation(body ?? {})
  }
  catch (error) {
    if (error instanceof AggregationNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: error.message, data: error.details })
    }

    throw error
  }
})

