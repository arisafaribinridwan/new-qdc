export class ReportNotFoundError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'ReportNotFoundError'
  }
}

export class ReportInvalidRequestError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'ReportInvalidRequestError'
  }
}

export class ReportExportBlockedError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'ReportExportBlockedError'
  }
}
