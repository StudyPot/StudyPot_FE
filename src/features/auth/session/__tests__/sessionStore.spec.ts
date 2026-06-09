import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useSessionStore } from '@/features/auth/session'

const mockUser = {
  id: '018f7a4e-0000-7000-9000-000000000001',
  email: 'user@example.com',
  nickname: 'user1',
}

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores a valid cookie session with the current user endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(mockUser), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const sessionStore = useSessionStore()

    await expect(sessionStore.restoreSession()).resolves.toEqual(mockUser)
    expect(sessionStore.user).toEqual(mockUser)
    expect(sessionStore.status).toBe('authenticated')
  })

  it('refreshes the session when current user returns unauthorized', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: 'Unauthorized',
          status: 401,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
      }),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const sessionStore = useSessionStore()

    await expect(sessionStore.restoreSession()).resolves.toEqual(mockUser)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/refresh',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/users/me',
      expect.objectContaining({
        credentials: 'include',
      }),
    )
  })

  it('clears the session after logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    )

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    await sessionStore.logoutCurrentSession()

    expect(sessionStore.user).toBeNull()
    expect(sessionStore.status).toBe('anonymous')
  })

  it('keeps the current session when logout fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Logout failed',
            status: 503,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    await expect(sessionStore.logoutCurrentSession()).rejects.toMatchObject({
      status: 503,
    })
    expect(sessionStore.user).toEqual(mockUser)
    expect(sessionStore.status).toBe('authenticated')
  })

  it('clears the session after logout-all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    )

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    await sessionStore.logoutEverySession()

    expect(sessionStore.user).toBeNull()
    expect(sessionStore.status).toBe('anonymous')
  })

  it('returns the cached user immediately without a network call when already authenticated', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    const result = await sessionStore.restoreSession()

    expect(result).toEqual(mockUser)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears the session without attempting a refresh on non-401 server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ title: 'Internal Server Error', status: 500 }), {
          status: 500,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )

    const sessionStore = useSessionStore()
    const result = await sessionStore.restoreSession()

    expect(result).toBeNull()
    expect(sessionStore.user).toBeNull()
    expect(sessionStore.status).toBe('anonymous')
  })

  it('clears the session and returns null when the automatic token refresh fails with 401', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    // Call 1: getCurrentUser → 401
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )
    // Call 2: refreshAccessToken (auto-refresh in apiClient) → 401 → apiClient throws
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )
    // Call 3: refreshSession (refreshAndRestoreSession fallback) → 401
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const sessionStore = useSessionStore()
    const result = await sessionStore.restoreSession()

    expect(result).toBeNull()
    expect(sessionStore.user).toBeNull()
    expect(sessionStore.status).toBe('anonymous')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('keeps the current session when logout-all fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Logout-all failed',
            status: 503,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    await expect(sessionStore.logoutEverySession()).rejects.toMatchObject({
      status: 503,
    })
    expect(sessionStore.user).toEqual(mockUser)
    expect(sessionStore.status).toBe('authenticated')
  })
})
