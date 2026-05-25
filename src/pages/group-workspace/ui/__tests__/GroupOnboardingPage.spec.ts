import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { OnboardingResponse } from '@/entities/onboarding'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupOnboardingPage from '../GroupOnboardingPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000010'

const submittedOnboarding: OnboardingResponse = {
  id: '018f7a4e-2000-7000-9000-000000000001',
  groupId,
  memberId: '018f7a4e-1000-7000-9000-000000000001',
  skillLevel: 3,
  additionalNote: '실전 위주 학습 선호',
  availabilitySlots: [
    { dayOfWeek: 2, startTime: '20:00', endTime: '22:00', timezone: 'Asia/Seoul' },
  ],
  status: 'SUBMITTED',
  submittedAt: '2026-05-08T14:02:00+09:00',
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/groups/:groupId/onboarding',
        name: 'group-onboarding',
        component: GroupOnboardingPage,
      },
      {
        path: '/groups/:groupId',
        name: 'group-overview',
        component: { template: '<main />' },
      },
    ],
  })
}

function mountPage() {
  const router = createTestRouter()
  void router.push(`/groups/${groupId}/onboarding`)

  return mount(GroupOnboardingPage, {
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

describe('GroupOnboardingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the form when onboarding has not been submitted yet (404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('온보딩 제출')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows the submitted state when onboarding is already completed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(submittedOnboarding), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('제출 완료')
    expect(wrapper.text()).toContain('3단계')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('submits onboarding with POST and transitions to submitted state', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...submittedOnboarding, submittedAt: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [submitUrl, submitInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(submitUrl).toBe(`/api/v1/groups/${groupId}/onboarding/me`)
    expect(submitInit.method).toBe('POST')

    expect(wrapper.text()).toContain('제출 완료')
  })

  it('shows a 409 error when onboarding has already been submitted', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ title: 'Conflict', detail: 'Onboarding already submitted.', status: 409 }),
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('이미 제출된 온보딩입니다.')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows an error state when the API call fails with a server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({ title: 'Internal Server Error', status: 500 }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
