import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { RetroQuestion, Review } from '@/entities/review'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupReviewPage from '../GroupReviewPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000011'

const questions: RetroQuestion[] = [
  { id: 'taskDifficulty', type: 'scale', label: '이번 주차 과제 난이도는 어땠나요?', required: true },
  {
    id: 'reflection',
    type: 'text',
    label: '이번 주차를 돌아보며 한 줄 소감을 남겨주세요.',
    required: false,
    placeholder: '자유롭게 적어보세요.',
  },
]

const myReview: Review = {
  id: 'review-001',
  groupId,
  userId: 'user-001',
  displayName: '나',
  answers: { taskDifficulty: 3, reflection: '유익했습니다.' },
  createdAt: '2026-06-01T10:30:00+09:00',
}

function makeFetch(handlers: Array<{ match: string; body: unknown; status?: number }>) {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = String(input)
    const handler = handlers.find((h) => url.includes(h.match))
    return Promise.resolve(
      new Response(JSON.stringify(handler?.body ?? {}), {
        status: handler?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
}

function mountReviewPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups/:groupId/review', name: 'group-review', component: GroupReviewPage },
    ],
  })

  return mount(GroupReviewPage, {
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

describe('GroupReviewPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state on mount', () => {
    const fetchMock = makeFetch([
      { match: '/reviews/questions', body: questions },
      { match: '/reviews/me', body: {}, status: 404 },
    ])
    const wrapper = mountReviewPage(fetchMock)
    expect(wrapper.text()).toContain('회고를 불러오는 중입니다.')
  })

  it('renders question labels after load', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/questions', body: questions },
      { match: '/reviews/me', body: { title: 'Not Found', status: 404 }, status: 404 },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('이번 주차 과제 난이도는 어땠나요?')
    expect(wrapper.text()).toContain('이번 주차를 돌아보며 한 줄 소감을 남겨주세요.')
  })

  it('shows write form when user has not reviewed yet (getMyReview returns 404)', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/questions', body: questions },
      { match: '/reviews/me', body: { title: 'Not Found', status: 404 }, status: 404 },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('회고 작성')
  })

  it('shows view mode with existing answers when getMyReview returns 200', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/questions', body: questions },
      { match: '/reviews/me', body: myReview },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('유익했습니다.')
  })

  it('shows validation error when submitting without answering required question', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/questions', body: questions },
      { match: '/reviews/me', body: { title: 'Not Found', status: 404 }, status: 404 },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('필수 항목입니다.')
  })

  it('shows error state when questions fetch fails', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/questions', body: { title: 'Internal Server Error', status: 500 }, status: 500 },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('회고를 불러오지 못했습니다.')
  })
})
