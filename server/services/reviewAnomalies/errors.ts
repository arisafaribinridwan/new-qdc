export class ReviewAnomaliesError extends Error {
  details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'ReviewAnomaliesError'
    this.details = details
  }
}

export class ReviewAnomaliesNotFoundError extends ReviewAnomaliesError {
  constructor(message: string, details?: unknown) {
    super(message, details)
    this.name = 'ReviewAnomaliesNotFoundError'
  }
}
