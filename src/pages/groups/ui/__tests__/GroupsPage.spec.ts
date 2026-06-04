import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GroupsPage from '../GroupsPage.vue'

const onboardingGroupId = '018f7a4e-0000-7000-9000-000000000010'
const activeGroupId = '018f7a4e-0000-7000-9000-000000000011'
const readyGroupId = '018f7a4e-0000-7000-9000-000000000012'

const groups = [
  {
    id: onboardingGroupId,
    name: 'Backend Interview Study',
    topic: 'Spring Boot',
    detailKeywords: ['JPA', 'Security', 'Testing'],
    status: 'ONBOARDING',
    maxMembers: 6,
    inviteCode: 'sb-onboarding-2026',
    startsAt: '2026-05-12',
    endsAt: '2026-06-30',
  },
  {
    id: activeGroupId,
    name: 'Spring Boot 실전 스터디',
    topic: 'Spring Boot',
    detailKeywords: ['JPA', 'Spring Security'],
    status: 'ACTIVE',
    maxMembers: 6,
    inviteCode: 'sb-active-2026',
    startsAt: '2026-04-22',
    endsAt: '2026-06-30',
  },
  {
    id: readyGroupId,
    name: 'Java 시작 대기 스터디',
    topic: 'Java',
    detailKeywords: ['Stream', 'Concurrency'],
    status: 'READY_TO_START',
    maxMembers: 4,
    inviteCode: 'java-ready-2026',
    startsAt: '2026-06-01',
    endsAt: '2026-07-31',
  },
]

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/groups',
        name: 'groups',
        component: GroupsPage,
      },
      {
        path: '/groups/new',
        name: 'group-create',
        component: { template: '<main />' },
      },
      {
        path: '/groups/join',
        name: 'group-join',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId',
        name: 'group-overview',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId/onboarding',
        name: 'group-onboarding',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId/todo',
        name: 'group-todo',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId/retrospective',
        name: 'group-retrospective',
        component: { template: '<main />' },
      },
    ],
  })
}

describe('GroupsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders state-aware entry actions for each group card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(groups), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const router = createTestRouter()
    await router.push('/groups')
    await router.isReady()

    const wrapper = mount(GroupsPage, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('온보딩 작성')
    expect(wrapper.text()).toContain('이번 주 Todo')
    expect(wrapper.text()).not.toContain('스터디 시작하기')
    expect(wrapper.find(`a[href="/groups/${onboardingGroupId}/onboarding"]`).exists()).toBe(true)
    expect(wrapper.find(`a[href="/groups/${activeGroupId}/todo"]`).exists()).toBe(true)
    expect(wrapper.find(`a[href="/groups/${readyGroupId}"]`).exists()).toBe(true)
    expect(wrapper.find(`a[href="/groups/${onboardingGroupId}"]`).exists()).toBe(true)
  })
})
