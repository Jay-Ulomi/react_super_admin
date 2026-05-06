export type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
  errors?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly errors?: unknown

  constructor(message: string, status: number, errors?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}
