import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import LogoutButton from '../LogoutButton.vue'

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

describe('LogoutButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs out the current session and redirects to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    )

    const router = createTestRouter()
    await router.push('/groups')

    const sessionStore = useSessionStore()
    sessionStore.user = mockUser
    sessionStore.status = 'authenticated'

    const wrapper = mount(LogoutButton, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(sessionStore.user).toBeNull()
    expect(sessionStore.status).toBe('anonymous')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('shows an error and keeps the session when logout fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: 'CSRF token is required.',
            status: 403,
          }),
          {
            status: 403,
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

    const wrapper = mount(LogoutButton, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('CSRF token is required.')
    expect(sessionStore.user).toEqual(mockUser)
    expect(sessionStore.status).toBe('authenticated')
    expect(router.currentRoute.value.name).toBe('groups')
  })
})

