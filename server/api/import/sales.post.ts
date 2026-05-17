import { createError, readMultipartFormData } from 'h3'
import type { MultiPartData } from 'h3'

import { ImportNotFoundError, ImportValidationError, importSalesCsv } from '../../services/imports'

export default defineEventHandler(async (event) => {
  try {
    const parts = await readMultipartFormData(event)

    if (!parts) {
      throw new ImportValidationError('Request must use multipart/form-data.')
    }

    const file = getUploadFile(parts)

    return await importSalesCsv({
      filename: file.filename,
      content: file.content,
      monthKey: getFormField(parts, 'monthKey'),
      productCode: getFormField(parts, 'productCode'),
      manufacturerCode: getFormField(parts, 'manufacturerCode')
    })
  }
  catch (error) {
    throw toImportHttpError(error)
  }
})

function getUploadFile(parts: MultiPartData[]) {
  const file = parts.find(part => part.name === 'file' && part.filename)

  if (!file) {
    throw new ImportValidationError('CSV upload field "file" is required.')
  }

  return {
    filename: file.filename ?? 'sales.csv',
    content: Buffer.from(file.data)
  }
}

function getFormField(parts: MultiPartData[], name: string) {
  const part = parts.find(item => item.name === name && !item.filename)
  return part?.data.toString('utf8')
}

function toImportHttpError(error: unknown) {
  if (error instanceof ImportValidationError) {
    return createError({ statusCode: 400, statusMessage: error.message, data: error.details })
  }

  if (error instanceof ImportNotFoundError) {
    return createError({ statusCode: 404, statusMessage: error.message, data: error.details })
  }

  return error
}
