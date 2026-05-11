import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient, ApiError } from '@/shared/api'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends cookie credentials by default and parses JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
    const fetchMock = vi.fn().mockResolvedValue(
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

  it('returns undefined for 204 responses without parsing a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

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
      vi.fn().mockResolvedValue(
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
