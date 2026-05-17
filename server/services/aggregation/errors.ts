export class AggregationNotFoundError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'AggregationNotFoundError'
  }
}

