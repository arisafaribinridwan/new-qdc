import { createError, getQuery } from 'h3'

import { ImportValidationError, getImportHistory } from '../../services/imports'

export default defineEventHandler((event) => {
  try {
    const query = getQuery(event)

    return getImportHistory({
      monthKey: getQueryValue(query.monthKey),
      productCode: getQueryValue(query.productCode),
      manufacturerCode: getQueryValue(query.manufacturerCode)
    })
  }
  catch (error) {
    if (error instanceof ImportValidationError) {
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
