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
      new Response(
        JSON.stringify({
          tokenType: 'Cookie',
          expiresIn: 3600,
          user: mockUser,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
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
})
