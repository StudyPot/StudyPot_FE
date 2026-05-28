import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/shared/api'
import { apiClient } from '@/shared/api'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('@/shared/config/api')
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'
  })

  it('sends cookie credentials by default and parses JSON responses', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient<{ id: string }>('/users/me')).resolves.toEqual({ id: 'user-1' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/users/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('serializes object bodies as JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await apiClient('/groups', {
      method: 'POST',
      body: { name: 'StudyPot' },
    })

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(requestInit.body).toBe(JSON.stringify({ name: 'StudyPot' }))
    expect(new Headers(requestInit.headers).get('Content-Type')).toBe('application/json')
  })

  it('echoes the readable XSRF cookie for unsafe cookie requests', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token-1'

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))

    vi.stubGlobal('fetch', fetchMock)

    await apiClient('/auth/logout', {
      method: 'POST',
    })

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(new Headers(requestInit.headers).get('X-XSRF-TOKEN')).toBe('csrf-token-1')
  })

  it('bootstraps an XSRF token when the cookie is not readable by the frontend origin', async () => {
    vi.resetModules()
    vi.doMock('@/shared/config/api', () => ({
      apiBaseUrl: 'https://api.example.test/api/v1',
      apiOrigin: 'https://api.example.test',
    }))

    const { apiClient: crossOriginApiClient } = await import('@/shared/api/client')

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cookieName: 'XSRF-TOKEN',
            headerName: 'X-XSRF-TOKEN',
            token: 'bootstrapped-csrf-token',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    vi.stubGlobal('fetch', fetchMock)

    await crossOriginApiClient('/auth/refresh', {
      method: 'POST',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/v1/auth/csrf',
      expect.objectContaining({
        credentials: 'include',
      }),
    )
    expect(
      new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).get('Accept'),
    ).toBe('application/json')

    const [, requestInit] = fetchMock.mock.calls[1] as [string, RequestInit]

    expect(new Headers(requestInit.headers).get('X-XSRF-TOKEN')).toBe('bootstrapped-csrf-token')
  })

  it('does not add the XSRF header for bearer token requests', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token-1'

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))

    vi.stubGlobal('fetch', fetchMock)

    await apiClient('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
      },
    })

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(new Headers(requestInit.headers).get('X-XSRF-TOKEN')).toBeNull()
  })

  it('returns undefined for 204 responses without parsing a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    )

    await expect(apiClient('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('throws ApiError with problem detail payloads', async () => {
    const problemDetail = {
      type: 'https://studypot.dev/problems/invalid-request',
      title: 'Invalid request',
      status: 400,
      detail: 'name is required.',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(problemDetail), {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )

    await expect(apiClient('/groups')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      payload: problemDetail,
      message: 'name is required.',
    } satisfies Partial<ApiError>)
  })
})
