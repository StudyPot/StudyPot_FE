import { beforeEach, describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '@/features/auth/session'
import App from '../App.vue'
import router from '../router'

function mountWithAnonymousSession() {
  const pinia = createPinia()
  setActivePinia(pinia)
  // AppShell shows the login UI when status is 'anonymous'
  useSessionStore().$patch({ status: 'anonymous' })
  return mount(App, { global: { plugins: [pinia, router] } })
}

describe('App', () => {
  beforeEach(async () => {
    await router.push('/login')
    await router.isReady()
  })

  it('renders the login UI when not authenticated', () => {
    const wrapper = mountWithAnonymousSession()

    expect(wrapper.text()).toContain('Google로 계속하기')
    expect(wrapper.get('button').text()).toContain('Google로 계속하기')
  })

  it('renders the logout-all notice on the login screen', async () => {
    await router.push({ name: 'login', query: { signedOut: 'all' } })
    await router.isReady()

    const wrapper = mountWithAnonymousSession()

    expect(wrapper.text()).toContain('모든 기기에서 로그아웃되었습니다.')
  })
})
