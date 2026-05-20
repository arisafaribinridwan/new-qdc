export class RawServiceReviewValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'RawServiceReviewValidationError'
  }
}

export class RawServiceReviewNotFoundError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'RawServiceReviewNotFoundError'
  }
}
