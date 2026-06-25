import { apiBaseUrl, apiOrigin } from '@/shared/config/api'
import { getAccessToken, getRefreshToken, setAuthTokens } from './token'

export type PageInfo = {
  nextCursor: string | null
  hasNext: boolean
}

export type CursorPageResponse<T> = {
  items: T[]
  pageInfo: PageInfo
}

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

type CsrfBootstrapResponse = {
  cookieName?: string
  headerName?: string
  token?: string
}

// 동시에 여러 요청이 401 받아도 refresh를 한 번만 호출하기 위한 공유 Promise
let refreshingPromise: Promise<void> | null = null

async function refreshAccessToken(): Promise<void> {
  const headers = new Headers()
  const refreshToken = getRefreshToken()
  // 저장된 refresh token이 있으면 바디로 보낸다(쿠키를 못 쓰는 환경). 없으면 쿠키 기반으로 동작.
  if (refreshToken) {
    headers.set('Content-Type', 'application/json')
  }
  await appendCsrfHeader(headers, 'POST')
  const response = await fetch(resolveApiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
  })
  if (!response.ok) {
    throw new ApiError(response.status, await parseResponseBody<ApiErrorPayload>(response))
  }
  // 갱신된 토큰을 저장(쿠키도 함께 회전됨)
  const data = await parseResponseBody<{ accessToken?: string; refreshToken?: string }>(response)
  setAuthTokens(data?.accessToken, data?.refreshToken)
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

  applyAuthorization(requestHeaders)
  await appendCsrfHeader(requestHeaders, requestOptions.method)

  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    ...requestOptions,
    headers: requestHeaders,
    body: hasJsonBody ? JSON.stringify(body) : body,
  })

  // access token 만료 시 refresh 후 재시도 (refresh 엔드포인트 자체는 제외)
  if (response.status === 401 && !path.includes('/auth/refresh')) {
    try {
      if (!refreshingPromise) {
        refreshingPromise = refreshAccessToken().finally(() => {
          refreshingPromise = null
        })
      }
      await refreshingPromise

      // 새 토큰으로 원래 요청 재시도
      const retryHeaders = new Headers(headers)
      if (hasJsonBody && !retryHeaders.has('Content-Type')) {
        retryHeaders.set('Content-Type', 'application/json')
      }
      applyAuthorization(retryHeaders)
      await appendCsrfHeader(retryHeaders, requestOptions.method)

      const retryResponse = await fetch(resolveApiUrl(path), {
        credentials: 'include',
        ...requestOptions,
        headers: retryHeaders,
        body: hasJsonBody ? JSON.stringify(body) : body,
      })

      if (!retryResponse.ok) {
        throw new ApiError(retryResponse.status, await parseResponseBody<ApiErrorPayload>(retryResponse))
      }
      if (retryResponse.status === 204) {
        return undefined as TResponse
      }
      return parseResponseBody<TResponse>(retryResponse)
    } catch (refreshError) {
      // refresh 실패 시 원래 401 에러 던짐
      throw new ApiError(401, await parseResponseBody<ApiErrorPayload>(response))
    }
  }

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

async function appendCsrfHeader(headers: Headers, method?: string): Promise<void> {
  if (!requiresCsrfHeader(method) || hasBearerAuthorization(headers)) {
    return
  }

  if (headers.has('X-XSRF-TOKEN') || headers.has('X-CSRF-TOKEN')) {
    return
  }

  const token = getCookieValue('XSRF-TOKEN')

  if (token) {
    headers.set('X-XSRF-TOKEN', token)
    return
  }

  if (!requiresCsrfBootstrap()) {
    return
  }

  const bootstrappedToken = await fetchCsrfToken()

  if (bootstrappedToken?.token) {
    headers.set(bootstrappedToken.headerName ?? 'X-XSRF-TOKEN', bootstrappedToken.token)
  }
}

async function fetchCsrfToken(): Promise<CsrfBootstrapResponse | null> {
  const response = await fetch(resolveApiUrl('/auth/csrf'), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    return null
  }

  const body = await parseResponseBody<CsrfBootstrapResponse>(response)
  const headerToken = response.headers.get('X-XSRF-TOKEN')
  const token = typeof body?.token === 'string' && body.token ? body.token : headerToken

  if (!token) {
    return null
  }

  return {
    cookieName: body?.cookieName,
    headerName: body?.headerName,
    token,
  }
}

function requiresCsrfHeader(method = 'GET'): boolean {
  return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase())
}

// 저장된 access token이 있으면 Authorization 헤더를 붙인다(쿠키가 막힌 환경 대응).
function applyAuthorization(headers: Headers): void {
  if (headers.has('Authorization')) {
    return
  }
  const accessToken = getAccessToken()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
}

function hasBearerAuthorization(headers: Headers): boolean {
  return headers.get('Authorization')?.toLowerCase().startsWith('bearer ') ?? false
}

function requiresCsrfBootstrap(): boolean {
  return Boolean(apiOrigin && typeof window !== 'undefined' && apiOrigin !== window.location.origin)
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null
}
