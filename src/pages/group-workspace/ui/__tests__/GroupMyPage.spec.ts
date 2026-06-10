import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import type { MemberOnboardingResponse } from '@/entities/onboarding'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupMyPage from '../GroupMyPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000012'

const submittedMember: MemberOnboardingResponse = {
  id: '018f7a4e-2000-7000-9000-000000000001',
  groupId,
  memberId: '018f7a4e-1000-7000-9000-000000000001',
  memberNickname: 'user1',
  skillLevel: 3,
  additionalNote: '실전 위주의 과제를 많이 하고 싶어요.',
  availabilitySlots: [
    { dayOfWeek: 2, startTime: '20:00', endTime: '22:30', timezone: 'Asia/Seoul' },
    { dayOfWeek: 6, startTime: '10:00', endTime: '13:00', timezone: 'Asia/Seoul' },
  ],
  status: 'SUBMITTED',
  submittedAt: '2026-05-08T14:02:00+09:00',
}

const draftMember: MemberOnboardingResponse = {
  id: '018f7a4e-2000-7000-9000-000000000003',
  groupId,
  memberId: '018f7a4e-1000-7000-9000-000000000003',
  memberNickname: 'kim_study',
  skillLevel: 1,
  additionalNote: null,
  availabilitySlots: [],
  status: 'DRAFT',
  submittedAt: null,
}

function makeFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function mountPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  return mount(GroupMyPage, {
    global: {
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

describe('GroupMyPage (팀원 온보딩 목록)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state on mount', () => {
    const wrapper = mountPage(makeFetch([submittedMember]))
    expect(wrapper.text()).toContain('팀원 정보를 불러오는 중입니다.')
  })

  it('renders member list after loading', async () => {
    const wrapper = mountPage(makeFetch([submittedMember, draftMember]))
    await flushPromises()

    expect(wrapper.text()).toContain('user1')
    expect(wrapper.text()).toContain('kim_study')
  })

  it('shows 제출 완료 badge for submitted member', async () => {
    const wrapper = mountPage(makeFetch([submittedMember]))
    await flushPromises()

    expect(wrapper.text()).toContain('제출 완료')
  })

  it('shows 미제출 badge for draft member', async () => {
    const wrapper = mountPage(makeFetch([draftMember]))
    await flushPromises()

    expect(wrapper.text()).toContain('미제출')
    expect(wrapper.text()).toContain('아직 온보딩을 제출하지 않았습니다.')
  })

  it('renders skill level and additional note for submitted member', async () => {
    const wrapper = mountPage(makeFetch([submittedMember]))
    await flushPromises()

    expect(wrapper.text()).toContain('3단계')
    expect(wrapper.text()).toContain('실습 가능')
    expect(wrapper.text()).toContain('실전 위주의 과제를 많이 하고 싶어요.')
  })

  it('renders availability slots for submitted member', async () => {
    const wrapper = mountPage(makeFetch([submittedMember]))
    await flushPromises()

    expect(wrapper.text()).toContain('화요일 20:00 – 22:30')
    expect(wrapper.text()).toContain('토요일 10:00 – 13:00')
  })

  it('shows empty state when member list is empty', async () => {
    const wrapper = mountPage(makeFetch([]))
    await flushPromises()

    expect(wrapper.text()).toContain('아직 온보딩 정보가 없습니다.')
  })

  it('shows error state when API fails', async () => {
    const wrapper = mountPage(makeFetch({ title: 'Internal Server Error', status: 500 }, 500))
    await flushPromises()

    expect(wrapper.text()).toContain('팀원 정보를 불러오지 못했습니다.')
  })

  it('calls GET /groups/:groupId/onboarding with correct groupId', async () => {
    const fetchMock = makeFetch([submittedMember])
    mountPage(fetchMock)
    await flushPromises()

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>
    expect(calls.some(([url]) => url.includes(`/groups/${groupId}/onboarding`))).toBe(true)
  })
})
