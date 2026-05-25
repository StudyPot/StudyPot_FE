import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { StudyGroup } from '@/entities/group'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupOverviewPage from '../GroupOverviewPage.vue'

const activeGroup: StudyGroup = {
  id: '018f7a4e-0000-7000-9000-000000000011',
  name: 'Spring Boot 실전 스터디',
  topic: 'Spring Boot',
  detailKeywords: ['JPA', 'Spring Security'],
  status: 'ACTIVE',
  maxMembers: 6,
  inviteCode: 'sb-active-2026',
  startsAt: '2026-04-22',
  endsAt: '2026-06-30',
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/groups/:groupId',
        name: 'group-overview',
        component: GroupOverviewPage,
      },
      {
        path: '/groups/:groupId/onboarding',
        name: 'group-onboarding',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId/curriculum',
        name: 'group-curriculum',
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
      {
        path: '/groups/:groupId/ai',
        name: 'group-ai',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId/notifications',
        name: 'group-notifications',
        component: { template: '<main />' },
      },
      {
        path: '/groups/:groupId/rules',
        name: 'group-rules',
        component: { template: '<main />' },
      },
    ],
  })
}

describe('GroupOverviewPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the primary entry action from the current group status', async () => {
    const router = createTestRouter()
    await router.push(`/groups/${activeGroup.id}`)
    await router.isReady()

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(activeGroup),
            isGroupLoading: ref(false),
            groupErrorMessage: ref(''),
            reloadGroup: vi.fn(async () => {}),
          },
        },
      },
    })

    expect(wrapper.text()).toContain('이번 주 Todo')
    expect(wrapper.text()).toContain('지금 진행해야 할 과제와 학습 흐름을 확인합니다.')
    expect(wrapper.find(`a[href="/groups/${activeGroup.id}/todo"]`).exists()).toBe(true)
  })

  it('copies the invite code from the group home', async () => {
    const writeText = vi.fn<Clipboard['writeText']>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText,
      },
    })

    const router = createTestRouter()
    await router.push(`/groups/${activeGroup.id}`)
    await router.isReady()

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(activeGroup),
            isGroupLoading: ref(false),
            groupErrorMessage: ref(''),
            reloadGroup: vi.fn(async () => {}),
          },
        },
      },
    })

    const copyCodeButton = wrapper.findAll('button').find((button) => button.text() === '코드 복사')

    expect(copyCodeButton).toBeTruthy()
    await copyCodeButton!.trigger('click')

    expect(writeText).toHaveBeenCalledWith(activeGroup.inviteCode)
    expect(wrapper.text()).toContain('초대 코드를 복사했습니다.')
  })

  it('renders an error state when the group detail cannot be loaded', async () => {
    const reloadGroup = vi.fn(async () => {})
    const router = createTestRouter()
    await router.push(`/groups/${activeGroup.id}`)
    await router.isReady()

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(null),
            isGroupLoading: ref(false),
            groupErrorMessage: ref('study group was not found.'),
            reloadGroup,
          },
        },
      },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('study group was not found.')

    await wrapper.get('button').trigger('click')

    expect(reloadGroup).toHaveBeenCalled()
  })
})
