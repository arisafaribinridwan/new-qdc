export class ValidationNotFoundError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'ValidationNotFoundError'
  }
}
