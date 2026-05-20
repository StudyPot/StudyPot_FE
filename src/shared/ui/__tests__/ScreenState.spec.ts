import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { ScreenState } from '@/shared/ui'

describe('ScreenState', () => {
  it('renders loading state with busy semantics', () => {
    const wrapper = mount(ScreenState, {
      props: {
        variant: 'loading',
        title: '불러오는 중',
        description: '잠시만 기다려주세요.',
      },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('불러오는 중')
  })

  it('emits action from the primary button', async () => {
    const wrapper = mount(ScreenState, {
      props: {
        variant: 'error',
        title: '목록을 불러오지 못했습니다.',
        actionLabel: '다시 시도',
      },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})

