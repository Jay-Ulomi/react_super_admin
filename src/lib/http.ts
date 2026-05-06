import { ApiError, type ApiEnvelope } from '../types/api'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: Method
  body?: unknown
}

type Tokens = {
  accessToken: string
  refreshToken: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://pos.chita.co.tz'

let tokenProvider: (() => Tokens | null) | null = null
let unauthorizedHandler: (() => Promise<void>) | null = null

export function configureHttpAuth(
  getTokens: () => Tokens | null,
  onUnauthorized: () => Promise<void>,
): void {
  tokenProvider = getTokens
  unauthorizedHandler = onUnauthorized
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  const tokens = tokenProvider?.()

  if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const execute = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

  let response = await execute()
  if ((response.status === 401 || response.status === 403) && unauthorizedHandler) {
    await unauthorizedHandler()
    const refreshed = tokenProvider?.()
    if (refreshed?.accessToken) headers.Authorization = `Bearer ${refreshed.accessToken}`
    response = await execute()
  }

  const contentType = response.headers.get('content-type')
  const parsed = contentType?.includes('application/json')
    ? ((await response.json()) as ApiEnvelope<T>)
    : null

  if (!response.ok) {
    throw new ApiError(parsed?.message ?? `Request failed (${response.status})`, response.status, parsed?.errors)
  }

  if (!parsed) {
    throw new ApiError('Expected JSON response body', response.status)
  }

  return parsed.data
}
