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
})
