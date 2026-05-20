import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import LogoutAllButton from '../LogoutAllButton.vue'

const mockUser = {
  id: '018f7a4e-0000-7000-9000-000000000001',
  email: 'user@example.com',
  nickname: 'user1',
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/groups',
        name: 'groups',
        component: { template: '<main />' },
      },
      {
        path: '/login',
        name: 'login',
        component: { template: '<main />' },
      },
    ],
  })
}

describe('LogoutAllButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs out every session and redirects to login with a notice flag', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups')

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    const wrapper = mount(LogoutAllButton, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/logout-all',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(sessionStore.user).toBeNull()
    expect(sessionStore.status).toBe('anonymous')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.signedOut).toBe('all')
  })

  it('shows an error and keeps the session when logout-all fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: 'Logout-all failed.',
            status: 503,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    const router = createTestRouter()
    await router.push('/groups')

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    const wrapper = mount(LogoutAllButton, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Logout-all failed.')
    expect(sessionStore.user).toEqual(mockUser)
    expect(sessionStore.status).toBe('authenticated')
    expect(router.currentRoute.value.name).toBe('groups')
  })
})

