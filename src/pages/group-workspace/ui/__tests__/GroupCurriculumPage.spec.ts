import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Curriculum, CurriculumWeek, WeeklyTask } from '@/entities/curriculum'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupCurriculumPage from '../GroupCurriculumPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000011'
const weekId = '018f7a4e-4000-7000-9000-000000000003'
const unknownWeekId = 'non-existent-week-id'

const curriculum: Curriculum = {
  id: '018f7a4e-3000-7000-9000-000000000001',
  groupId,
  title: 'Spring Boot 실전',
  totalWeeks: 4,
  status: 'ACTIVE',
  weeks: [
    {
      id: weekId,
      weekNumber: 3,
      title: 'Spring Security 구조 이해',
      status: 'IN_PROGRESS',
    },
  ],
}

const weekDetail: CurriculumWeek = {
  id: weekId,
  curriculumId: curriculum.id,
  weekNumber: 3,
  title: 'Spring Security 구조 이해',
  sprintGoal: '필터 체인과 인증 흐름 이해',
  startsAt: '2026-05-18',
  endsAt: '2026-05-24',
  status: 'IN_PROGRESS',
}

const tasks: WeeklyTask[] = [
  {
    id: 'task-001',
    curriculumWeekId: weekId,
    displayOrder: 1,
    taskType: 'READING',
    title: 'Spring Security Architecture 문서 정독',
    description: '공식 문서를 읽고 핵심 개념을 정리하세요.',
    required: true,
  },
]

function makeFetch(
  handlers: Array<{ match: string; body: unknown; status?: number }>,
): typeof vi.fn {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = String(input)
    const handler = handlers.find((h) => url.includes(h.match))
    const body = handler?.body ?? {}
    const status = handler?.status ?? 200
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
}

function mountCurriculumPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups/:groupId/curriculum', name: 'group-curriculum', component: GroupCurriculumPage },
    ],
  })

  return mount(GroupCurriculumPage, {
    global: {
      plugins: [router, createPinia()],
      provide: {
        [groupWorkspaceContextKey as symbol]: {
          groupId: computed(() => groupId),
          group: ref(null),
          isGroupLoading: ref(false),
          groupErrorMessage: ref(''),
          reloadGroup: vi.fn(async () => {}),
          members: ref([]),
        },
      },
    },
  })
}

describe('GroupCurriculumPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state while curriculum is being fetched', () => {
    const fetchMock = makeFetch([{ match: '/curriculum', body: curriculum }])
    const wrapper = mountCurriculumPage(fetchMock)

    expect(wrapper.text()).toContain('커리큘럼을 불러오는 중입니다.')
  })

  it('renders curriculum title and week list after a successful fetch', async () => {
    const fetchMock = makeFetch([{ match: '/curriculum', body: curriculum }])
    const wrapper = mountCurriculumPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('Spring Boot 실전')
    expect(wrapper.text()).toContain('Spring Security 구조 이해')
    expect(wrapper.text()).toContain('진행 중')
  })

  it('shows empty state when the server returns 404 (no curriculum)', async () => {
    const fetchMock = makeFetch([
      { match: '/curriculum', body: { title: 'Not Found', status: 404 }, status: 404 },
    ])
    const wrapper = mountCurriculumPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('아직 커리큘럼이 없습니다')
  })

  it('shows error state with retry button when fetch fails', async () => {
    const fetchMock = makeFetch([
      {
        match: '/curriculum',
        body: { title: 'Internal Server Error', status: 500 },
        status: 500,
      },
    ])
    const wrapper = mountCurriculumPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('커리큘럼을 불러오지 못했습니다.')
    expect(wrapper.find('button[type="button"]').text()).toBe('다시 시도')
  })

  it('loads week detail with tasks when a week button is clicked', async () => {
    const fetchMock = makeFetch([
      { match: '/curriculum', body: curriculum },
      { match: `/weeks/${weekId}/tasks`, body: tasks },
      { match: `/weeks/${weekId}`, body: weekDetail },
    ])
    const wrapper = mountCurriculumPage(fetchMock)
    await flushPromises()

    const weekButton = wrapper.find('button[aria-expanded]')
    expect(weekButton.attributes('aria-expanded')).toBe('false')

    await weekButton.trigger('click')
    await flushPromises()

    expect(weekButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('필터 체인과 인증 흐름 이해')
    expect(wrapper.text()).toContain('Spring Security Architecture 문서 정독')
    expect(wrapper.text()).toContain('읽기')
    expect(wrapper.text()).toContain('필수')

    const detailCalls = fetchMock.mock.calls
      .map(([url]: [string]) => url)
      .filter((u: string) => u.includes(`/weeks/${weekId}`))
    expect(detailCalls.some((u: string) => u.endsWith(`/weeks/${weekId}`))).toBe(true)
    expect(detailCalls.some((u: string) => u.endsWith(`/weeks/${weekId}/tasks`))).toBe(true)
  })

  it('shows 404 error in the week detail panel when getWeek returns 404', async () => {
    const fetchMock = makeFetch([
      { match: '/curriculum', body: curriculum },
      {
        match: `/weeks/${weekId}`,
        body: { title: 'Not Found', detail: '존재하지 않는 주차입니다.', status: 404 },
        status: 404,
      },
    ])
    const wrapper = mountCurriculumPage(fetchMock)
    await flushPromises()

    await wrapper.find('button[aria-expanded]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('해당 주차 정보를 찾을 수 없습니다. (404)')
  })

  it('collapses the week detail panel when the same week is clicked again', async () => {
    const fetchMock = makeFetch([
      { match: '/curriculum', body: curriculum },
      { match: `/weeks/${weekId}/tasks`, body: tasks },
      { match: `/weeks/${weekId}`, body: weekDetail },
    ])
    const wrapper = mountCurriculumPage(fetchMock)
    await flushPromises()

    const weekButton = wrapper.find('button[aria-expanded]')
    await weekButton.trigger('click')
    await flushPromises()
    expect(weekButton.attributes('aria-expanded')).toBe('true')

    await weekButton.trigger('click')
    await flushPromises()
    expect(weekButton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('필터 체인과 인증 흐름 이해')
  })
})
