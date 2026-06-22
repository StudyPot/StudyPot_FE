import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { User } from '@/entities/user/model/types'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupMyPage from '../GroupMyPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000012'

const mockUser: User = {
  id: '018f7a4e-0000-7000-9000-000000000001',
  email: 'user@example.com',
  nickname: 'user1',
  bio: 'Spring Boot와 JPA를 공부하고 있는 백엔드 개발자입니다.',
  preferredTopics: ['Spring Boot', 'JPA'],
}

const notFoundBody = { title: 'Not Found', status: 404 }
const serverErrorBody = { title: 'Internal Server Error', status: 500 }

function makeFetch(handlers: Array<{ match: string; method?: string; body: unknown; status?: number }>) {
  return vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const url = String(input)
    const method = (init as RequestInit | undefined)?.method?.toUpperCase() ?? 'GET'
    const handler = handlers.find((h) => {
      const methodMatch = h.method ? h.method.toUpperCase() === method : true
      return methodMatch && url.includes(h.match)
    })
    return Promise.resolve(
      new Response(JSON.stringify(handler?.body ?? {}), {
        status: handler?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
}

function mountPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups/:groupId/my', name: 'group-my', component: GroupMyPage },
    ],
  })

  return mount(GroupMyPage, {
    global: {
      plugins: [router],
      provide: {
        [groupWorkspaceContextKey as symbol]: {
          groupId: computed(() => groupId),
          group: ref(null),
          isGroupLoading: ref(false),
          groupErrorMessage: ref(''),
          reloadGroup: vi.fn(async () => {}),
        },
      },
    },
  })
}

describe('GroupMyPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows onboarding loading state on mount', () => {
    const fetchMock = makeFetch([
      { match: '/users/me', body: mockUser },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)

    expect(wrapper.text()).toContain('내 정보를 불러오는 중입니다.')
  })

  it('renders profile nickname, email, bio and preferred topics after load', async () => {
    const fetchMock = makeFetch([
      { match: '/users/me', body: mockUser },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('내 프로필')
    expect(wrapper.text()).toContain('user@example.com')
    expect(wrapper.text()).toContain('user1')
    expect(wrapper.text()).toContain('Spring Boot와 JPA를 공부하고 있는 백엔드 개발자입니다.')
    expect(wrapper.text()).toContain('Spring Boot')
    expect(wrapper.text()).toContain('JPA')
  })

  it('shows edit form when 수정 button is clicked', async () => {
    const fetchMock = makeFetch([
      { match: '/users/me', body: mockUser },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const editButton = wrapper.findAll('button').find((b) => b.text() === '수정')
    expect(editButton?.exists()).toBe(true)

    await editButton!.trigger('click')

    expect(wrapper.find('#profile-nickname').exists()).toBe(true)
    expect(wrapper.find('#profile-bio').exists()).toBe(true)
    expect((wrapper.find('#profile-nickname').element as HTMLInputElement).value).toBe('user1')
  })

  it('shows client-side field error when nickname is empty and form is submitted', async () => {
    const fetchMock = makeFetch([
      { match: '/users/me', body: mockUser },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === '수정')!.trigger('click')

    const nicknameInput = wrapper.find('#profile-nickname')
    await nicknameInput.setValue('')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[role="alert"]').text()).toContain('닉네임은 필수 입력 값입니다.')
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/users/me',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('shows server-side field error on 400 when server rejects empty nickname', async () => {
    const fetchMock = makeFetch([
      { match: '/users/me', method: 'GET', body: mockUser },
      { match: '/users/me', method: 'PATCH', body: {
          title: 'Bad Request',
          detail: '닉네임은 필수 입력 값입니다.',
          status: 400,
          errors: { nickname: '닉네임은 필수 입력 값입니다.' },
        }, status: 400,
      },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === '수정')!.trigger('click')

    await wrapper.find('#profile-nickname').setValue('  ')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('닉네임은 필수 입력 값입니다.')
  })

  it('updates and displays new profile after successful PATCH', async () => {
    const updatedUser: User = { ...mockUser, nickname: '새닉네임', bio: '업데이트된 소개' }

    const fetchMock = makeFetch([
      { match: '/users/me', method: 'GET', body: mockUser },
      { match: '/users/me', method: 'PATCH', body: updatedUser },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === '수정')!.trigger('click')

    await wrapper.find('#profile-nickname').setValue('새닉네임')
    await wrapper.find('#profile-bio').setValue('업데이트된 소개')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#profile-nickname').exists()).toBe(false)
    expect(wrapper.text()).toContain('새닉네임')
    expect(wrapper.text()).toContain('업데이트된 소개')
  })

  it('shows onboarding edit form when no onboarding submitted yet (404)', async () => {
    const fetchMock = makeFetch([
      { match: '/users/me', body: mockUser },
      { match: '/onboarding/me', body: notFoundBody, status: 404 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('나의 준비 정보')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows error state when onboarding API fails with server error', async () => {
    const fetchMock = makeFetch([
      { match: '/users/me', body: mockUser },
      { match: '/onboarding/me', body: serverErrorBody, status: 500 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('정보를 불러오지 못했습니다.')
  })
})
