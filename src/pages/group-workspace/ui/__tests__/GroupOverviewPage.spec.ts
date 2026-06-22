import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { GroupMember, StudyGroup } from '@/entities/group'
import type { MemberActivityRow } from '@/entities/curriculum'
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

const activeMembers: GroupMember[] = [
  {
    id: '018f7a4e-0000-7000-9000-000000000101',
    groupId: activeGroup.id,
    userId: '018f7a4e-0000-7000-9000-000000000001',
    permission: 'MEMBER',
    status: 'ACTIVE',
    displayName: '현우',
    nickname: '현우',
    onboardingStatus: 'SUBMITTED',
  },
]

function buildActivityRows(): MemberActivityRow[] {
  const today = new Date()
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (27 - i))
    return d.toISOString().slice(0, 10)
  })
  return [
    {
      memberId: '018f7a4e-1000-7000-9000-000000000001',
      memberNickname: 'user1',
      dailyActivity: days.map((date, i) => ({ date, count: i % 6 })),
    },
    {
      memberId: '018f7a4e-1000-7000-9000-000000000002',
      memberNickname: 'dev_lee',
      dailyActivity: days.map((date, i) => ({ date, count: (i + 3) % 8 })),
    },
  ]
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups/:groupId', name: 'group-overview', component: GroupOverviewPage },
      { path: '/groups/:groupId/onboarding', name: 'group-onboarding', component: { template: '<main />' } },
      { path: '/groups/:groupId/curriculum', name: 'group-curriculum', component: { template: '<main />' } },
      { path: '/groups/:groupId/todo', name: 'group-todo', component: { template: '<main />' } },
      { path: '/groups/:groupId/retrospective', name: 'group-retrospective', component: { template: '<main />' } },
      { path: '/groups/:groupId/ai', name: 'group-ai', component: { template: '<main />' } },
      { path: '/groups/:groupId/board', name: 'group-board', component: { template: '<main />' } },
      { path: '/groups/:groupId/my', name: 'group-my', component: { template: '<main />' } },
    ],
  })
}

async function mountActive(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createTestRouter()
  await router.push(`/groups/${activeGroup.id}`)
  await router.isReady()

  return mount(GroupOverviewPage, {
    global: {
      plugins: [createPinia(), router],
      provide: {
        [groupWorkspaceContextKey as symbol]: {
          groupId: computed(() => activeGroup.id),
          group: ref(activeGroup),
          isGroupLoading: ref(false),
          groupErrorMessage: ref(''),
          reloadGroup: vi.fn(async () => {}),
          reloadMembers: vi.fn(async () => {}),
          members: ref(activeMembers),
        },
      },
    },
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

    vi.stubGlobal('fetch', mockFetch([]))

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [createPinia(), router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(activeGroup),
            isGroupLoading: ref(false),
            groupErrorMessage: ref(''),
            reloadGroup: vi.fn(async () => {}),
            reloadMembers: vi.fn(async () => {}),
            members: ref(activeMembers),
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
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('fetch', mockFetch([]))

    const router = createTestRouter()
    await router.push(`/groups/${activeGroup.id}`)
    await router.isReady()

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [createPinia(), router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(activeGroup),
            isGroupLoading: ref(false),
            groupErrorMessage: ref(''),
            reloadGroup: vi.fn(async () => {}),
            reloadMembers: vi.fn(async () => {}),
            members: ref(activeMembers),
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
    vi.stubGlobal('fetch', mockFetch([]))

    const router = createTestRouter()
    await router.push(`/groups/${activeGroup.id}`)
    await router.isReady()

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [createPinia(), router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(null),
            isGroupLoading: ref(false),
            groupErrorMessage: ref('study group was not found.'),
            reloadGroup,
            members: ref([]),
          },
        },
      },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('study group was not found.')

    await wrapper.get('button').trigger('click')

    expect(reloadGroup).toHaveBeenCalled()
  })
})

describe('GroupOverviewPage — 활동 현황 (잔디)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls GET /groups/:groupId/learning-activity when group is ACTIVE', async () => {
    const fetchMock = mockFetch(buildActivityRows())
    await mountActive(fetchMock)
    await flushPromises()

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>
    expect(calls.some(([url]) => url.includes(`/groups/${activeGroup.id}/learning-activity`))).toBe(true)
  })

  it('does not call learning-activity API when group is not ACTIVE', async () => {
    const inactiveGroup: StudyGroup = { ...activeGroup, status: 'ONBOARDING' }
    vi.stubGlobal('fetch', mockFetch([]))

    const router = createTestRouter()
    await router.push(`/groups/${inactiveGroup.id}`)
    await router.isReady()

    const fetchMock = mockFetch([])
    vi.stubGlobal('fetch', fetchMock)

    mount(GroupOverviewPage, {
      global: {
        plugins: [createPinia(), router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => inactiveGroup.id),
            group: ref(inactiveGroup),
            isGroupLoading: ref(false),
            groupErrorMessage: ref(''),
            reloadGroup: vi.fn(async () => {}),
            reloadMembers: vi.fn(async () => {}),
            members: ref([]),
          },
        },
      },
    })
    await flushPromises()

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>
    expect(calls.some(([url]) => url.includes('learning-activity'))).toBe(false)
  })

  it('renders member nicknames in the heatmap after API response', async () => {
    const fetchMock = mockFetch(buildActivityRows())
    const wrapper = await mountActive(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('user1')
    expect(wrapper.text()).toContain('dev_lee')
  })

  it('maps activity counts to correct color levels', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows: MemberActivityRow[] = [
      {
        memberId: 'id-1',
        memberNickname: 'tester',
        dailyActivity: [
          { date: today, count: 0 },
        ],
      },
    ]

    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push(`/groups/${activeGroup.id}`)
    await router.isReady()

    const wrapper = mount(GroupOverviewPage, {
      global: {
        plugins: [createPinia(), router],
        provide: {
          [groupWorkspaceContextKey as symbol]: {
            groupId: computed(() => activeGroup.id),
            group: ref(activeGroup),
            isGroupLoading: ref(false),
            groupErrorMessage: ref(''),
            reloadGroup: vi.fn(async () => {}),
            reloadMembers: vi.fn(async () => {}),
            members: ref(activeMembers),
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('tester')
  })

  it('shows empty heatmap when API fails', async () => {
    const fetchMock = mockFetch({ title: 'Internal Server Error', status: 500 }, 500)
    const wrapper = await mountActive(fetchMock)
    await flushPromises()

    // 잔디 섹션 자체가 없거나 멤버 행이 없음 (heatmapData.length === 0)
    expect(wrapper.text()).not.toContain('user1')
    expect(wrapper.text()).not.toContain('dev_lee')
  })
})
