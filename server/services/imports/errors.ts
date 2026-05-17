export class ImportValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'ImportValidationError'
  }
}

export class ImportNotFoundError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'ImportNotFoundError'
  }
}
