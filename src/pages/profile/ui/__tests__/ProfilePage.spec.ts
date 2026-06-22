import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import ProfilePage from '../ProfilePage.vue'

const mockUser = {
  id: '018f7a4e-0000-7000-9000-000000000001',
  email: 'user@example.com',
  nickname: 'user1',
  bio: 'Spring Boot와 JPA를 공부하고 있는 백엔드 개발자입니다.',
  preferredTopics: ['Spring Boot', 'JPA'],
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

let currentWrapper: ReturnType<typeof mount> | null = null

function mountPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/profile', component: ProfilePage }],
  })

  const pinia = createPinia()
  setActivePinia(pinia)

  currentWrapper = mount(ProfilePage, {
    global: { plugins: [pinia, router] },
  })
  return currentWrapper
}

describe('ProfilePage', () => {
  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
    vi.unstubAllGlobals()
  })

  it('shows loading state on mount', async () => {
    const wrapper = mountPage(mockFetch(mockUser))
    await nextTick()
    expect(wrapper.text()).toContain('프로필을 불러오는 중입니다.')
  })

  it('renders profile info after loading', async () => {
    const wrapper = mountPage(mockFetch(mockUser))
    await flushPromises()

    expect(wrapper.text()).toContain(mockUser.email)
    expect(wrapper.text()).toContain(mockUser.nickname)
    expect(wrapper.text()).toContain(mockUser.bio)
    expect(wrapper.text()).toContain('Spring Boot')
  })

  it('shows 👤 emoji as profile icon', async () => {
    const wrapper = mountPage(mockFetch(mockUser))
    await flushPromises()

    expect(wrapper.text()).toContain('👤')
  })

  it('opens edit form with pre-filled values on 수정 click', async () => {
    const wrapper = mountPage(mockFetch(mockUser))
    await flushPromises()

    const editBtn = wrapper.findAll('button').find((b) => b.text() === '수정')
    expect(editBtn).toBeDefined()
    await editBtn!.trigger('click')

    const nicknameInput = wrapper.find('input[name="nickname"]')
    expect(nicknameInput.exists()).toBe(true)
    expect((nicknameInput.element as HTMLInputElement).value).toBe(mockUser.nickname)

    const bioTextarea = wrapper.find('textarea[name="bio"]')
    expect((bioTextarea.element as HTMLTextAreaElement).value).toBe(mockUser.bio)
  })

  it('submits PATCH /users/me on 저장 and returns to view', async () => {
    const updatedUser = { ...mockUser, nickname: '새닉네임' }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockUser), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedUser), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const editBtn = wrapper.findAll('button').find((b) => b.text() === '수정')
    await editBtn!.trigger('click')

    await wrapper.find('input[name="nickname"]').setValue('새닉네임')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>
    const patchCall = calls.find(([, opts]) => opts?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(JSON.parse(patchCall![1].body as string)).toMatchObject({ nickname: '새닉네임' })

    expect(wrapper.find('input[name="nickname"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('새닉네임')
  })

  it('shows validation error when nickname is empty on submit', async () => {
    const wrapper = mountPage(mockFetch(mockUser))
    await flushPromises()

    const editBtn = wrapper.findAll('button').find((b) => b.text() === '수정')
    await editBtn!.trigger('click')

    await wrapper.find('input[name="nickname"]').setValue('')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('닉네임은 필수 입력 값입니다.')
    expect(wrapper.find('input[name="nickname"]').exists()).toBe(true)
  })

  it('cancels edit and returns to view on 취소 click', async () => {
    const wrapper = mountPage(mockFetch(mockUser))
    await flushPromises()

    const editBtn = wrapper.findAll('button').find((b) => b.text() === '수정')
    await editBtn!.trigger('click')

    expect(wrapper.find('input[name="nickname"]').exists()).toBe(true)

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === '취소')
    await cancelBtn!.trigger('click')

    expect(wrapper.find('input[name="nickname"]').exists()).toBe(false)
  })

  it('adds and removes preferred topics in edit mode', async () => {
    const wrapper = mountPage(mockFetch({ ...mockUser, preferredTopics: [] }))
    await flushPromises()

    const editBtn = wrapper.findAll('button').find((b) => b.text() === '수정')
    await editBtn!.trigger('click')

    const topicInput = wrapper.find('input[name="topic-input"]')
    await topicInput.setValue('Vue.js')
    await topicInput.trigger('keydown.enter')

    expect(wrapper.text()).toContain('Vue.js')

    const removeBtn = wrapper.find('button[aria-label="Vue.js 제거"]')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(wrapper.text()).not.toContain('Vue.js')
  })
})
