import { beforeEach, describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'
import router from '../router'

describe('App', () => {
  beforeEach(async () => {
    await router.push('/login')
    await router.isReady()
  })

  it('renders the login page', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })
    const renderedText = wrapper.text().replace(/\s+/g, ' ').trim()
    const loginButton = wrapper.get('button')

    expect(renderedText).toContain('Google 계정으로 로그인')
    expect(loginButton.text()).toBe('Google로 시작하기')
  })

  it('renders the logout-all notice on the login page', async () => {
    await router.push({
      name: 'login',
      query: {
        signedOut: 'all',
      },
    })
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.text()).toContain('모든 기기에서 로그아웃되었습니다.')
  })
})
