import { apiBaseUrl } from '@/shared/config/api'

export type ProblemDetail = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  [key: string]: unknown
}

export type ApiErrorPayload =
  | ProblemDetail
  | {
      message?: string
      [key: string]: unknown
    }

export class ApiError extends Error {
  readonly status: number
  readonly payload: ApiErrorPayload | null

  constructor(status: number, payload: ApiErrorPayload | null, message?: string) {
    super(message ?? getApiErrorMessage(status, payload))
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export type ApiClientOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
}

export async function apiClient<TResponse = unknown>(
  path: string,
  options: ApiClientOptions = {},
): Promise<TResponse> {
  const { headers, body, ...requestOptions } = options
  const requestHeaders = new Headers(headers)
  const hasJsonBody = isJsonBody(body)

  if (hasJsonBody && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    ...requestOptions,
    headers: requestHeaders,
    body: hasJsonBody ? JSON.stringify(body) : body,
  })

  if (!response.ok) {
    throw new ApiError(response.status, await parseResponseBody<ApiErrorPayload>(response))
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return parseResponseBody<TResponse>(response)
}

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBaseUrl}${normalizedPath}`
}

function isJsonBody(body: ApiClientOptions['body']): body is Record<string, unknown> | unknown[] {
  return (
    body !== null &&
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof URLSearchParams) &&
    typeof body !== 'string'
  )
}

async function parseResponseBody<TBody>(response: Response): Promise<TBody> {
  const text = await response.text()

  if (!text) {
    return undefined as TBody
  }

  const contentType = response.headers.get('Content-Type')

  if (contentType?.includes('application/json') || looksLikeJson(text)) {
    return JSON.parse(text) as TBody
  }

  return text as TBody
}

function getApiErrorMessage(status: number, payload: ApiErrorPayload | null): string {
  if (payload && 'detail' in payload && typeof payload.detail === 'string') {
    return payload.detail
  }

  if (payload && 'title' in payload && typeof payload.title === 'string') {
    return payload.title
  }

  if (payload && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return `API request failed with status ${status}`
}

function looksLikeJson(text: string): boolean {
  const trimmedText = text.trim()

  return trimmedText.startsWith('{') || trimmedText.startsWith('[')
}
