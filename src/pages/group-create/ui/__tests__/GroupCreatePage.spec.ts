import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GroupCreatePage from '../GroupCreatePage.vue'

const createdGroup = {
  id: '018f7a4e-0000-7000-9000-000000000020',
  name: 'Backend Interview Study',
  topic: 'Spring Boot',
  detailKeywords: ['JPA', 'Security', 'Testing'],
  status: 'ONBOARDING',
  maxMembers: 8,
  inviteCode: 'STUDY123',
  startsAt: '2026-06-01',
  endsAt: '2026-07-01',
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
        path: '/groups/new',
        name: 'group-create',
        component: GroupCreatePage,
      },
      {
        path: '/groups/:groupId/onboarding',
        name: 'group-onboarding',
        component: { template: '<main />' },
      },
    ],
  })
}

describe('GroupCreatePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  async function addCustomKeyword(
    wrapper: ReturnType<typeof mount>,
    keyword: string,
  ): Promise<void> {
    await wrapper.get('button[aria-label="키워드 직접 추가"]').trigger('click')
    await wrapper.get('input[placeholder="키워드 입력"]').setValue(keyword)
    const confirmButton = wrapper.findAll('button').find((button) => button.text() === '확인')

    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
  }

  it('shows validation errors and does not submit when required values are missing', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/new')
    await router.isReady()

    const wrapper = mount(GroupCreatePage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('form').trigger('submit')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('그룹 이름을 입력해주세요.')
    expect(wrapper.text()).toContain('스터디 주제를 입력해주세요.')
    expect(wrapper.text()).toContain('키워드를 하나 이상 선택하거나 추가해주세요.')
  })

  it('requests detail keyword suggestions and appends a selected keyword', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ keywords: ['JPA', 'Spring Security'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/new')
    await router.isReady()

    const wrapper = mount(GroupCreatePage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('input[name="topic"]').setValue('Spring Boot')
    await addCustomKeyword(wrapper, 'JPA')

    const suggestButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'AI 키워드 추천')

    expect(suggestButton).toBeTruthy()
    await suggestButton!.trigger('click')
    await flushPromises()

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/groups/detail-keyword-suggestions',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(JSON.parse(requestInit.body as string)).toEqual({
      topic: 'Spring Boot',
      hintKeywords: ['JPA'],
      maxCandidates: 5,
    })

    const springSecurityButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Spring Security')

    expect(springSecurityButton).toBeTruthy()
    await springSecurityButton!.trigger('click')

    const selectedSpringSecurityButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Spring Security')

    expect(selectedSpringSecurityButton?.attributes('aria-pressed')).toBe('true')
  })

  it('submits a create group request and redirects to onboarding', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(createdGroup), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/new')
    await router.isReady()

    const wrapper = mount(GroupCreatePage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('input[name="name"]').setValue('Backend Interview Study')
    await wrapper.get('input[name="topic"]').setValue('Spring Boot')
    await addCustomKeyword(wrapper, 'JPA')
    await addCustomKeyword(wrapper, 'Security')
    await addCustomKeyword(wrapper, 'Testing')
    await wrapper.get('input[name="maxMembers"]').setValue(8)
    await wrapper.get('input[name="startsAt"]').setValue('2026-06-01')
    await wrapper.get('input[name="endsAt"]').setValue('2026-07-01')
    await wrapper
      .get('textarea[name="description"]')
      .setValue('매주 백엔드 면접 주제를 정리합니다.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/groups',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(JSON.parse(requestInit.body as string)).toEqual({
      name: 'Backend Interview Study',
      topic: 'Spring Boot',
      detailKeywords: ['JPA', 'Security', 'Testing'],
      maxMembers: 8,
      startsAt: '2026-06-01',
      endsAt: '2026-07-01',
      description: '매주 백엔드 면접 주제를 정리합니다.',
    })

    expect(document.body.textContent).toContain('그룹이 생성되었습니다!')

    const onboardingButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '온보딩 하러 가기',
    )

    expect(onboardingButton).toBeTruthy()
    onboardingButton!.click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('group-onboarding')
    expect(router.currentRoute.value.params.groupId).toBe(createdGroup.id)
  })
})
