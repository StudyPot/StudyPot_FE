import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Review, ReviewStats } from '@/entities/review'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupReviewPage from '../GroupReviewPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000011'

const stats: ReviewStats = {
  averageRating: 4.7,
  totalCount: 3,
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 2 },
}

const reviewList: Review[] = [
  {
    id: 'review-001',
    groupId,
    userId: 'user-002',
    displayName: '김민준',
    rating: 5,
    content: '최고의 스터디였습니다.',
    createdAt: '2026-06-01T10:30:00+09:00',
  },
  {
    id: 'review-002',
    groupId,
    userId: 'user-003',
    displayName: '이서연',
    rating: 4,
    content: '많이 배웠어요.',
    createdAt: '2026-06-02T14:15:00+09:00',
  },
]

const myReview: Review = {
  id: 'review-003',
  groupId,
  userId: 'user-001',
  displayName: '나',
  rating: 5,
  content: '정말 유익했습니다.',
  createdAt: '2026-06-03T09:00:00+09:00',
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
      { match: '/reviews/stats', body: stats },
      { match: '/reviews/me', body: {}, status: 404 },
      { match: '/reviews', body: reviewList },
    ])
    const wrapper = mountReviewPage(fetchMock)
    expect(wrapper.text()).toContain('리뷰를 불러오는 중입니다.')
  })

  it('renders average rating and review list after load', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/stats', body: stats },
      { match: '/reviews/me', body: {}, status: 404 },
      { match: '/reviews', body: reviewList },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('4.7')
    expect(wrapper.text()).toContain('3개의 리뷰')
    expect(wrapper.text()).toContain('최고의 스터디였습니다.')
    expect(wrapper.text()).toContain('많이 배웠어요.')
  })

  it('shows review form when user has not reviewed yet (getMyReview returns 404)', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/stats', body: stats },
      { match: '/reviews/me', body: { title: 'Not Found', status: 404 }, status: 404 },
      { match: '/reviews', body: reviewList },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('리뷰 제출')
  })

  it('shows "already reviewed" state when getMyReview returns 200', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/stats', body: stats },
      { match: '/reviews/me', body: myReview },
      { match: '/reviews', body: reviewList },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('이미 리뷰를 작성했습니다.')
    expect(wrapper.text()).toContain('정말 유익했습니다.')
  })

  it('shows validation error when submitting without selecting a star', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/stats', body: stats },
      { match: '/reviews/me', body: { title: 'Not Found', status: 404 }, status: 404 },
      { match: '/reviews', body: reviewList },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('평점을 선택해 주세요.')
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/groups/${groupId}/reviews`),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('submits review and hides the form on success', async () => {
    const created: Review = {
      id: 'review-new',
      groupId,
      userId: 'user-001',
      displayName: '나',
      rating: 4,
      content: '좋았습니다.',
      createdAt: new Date().toISOString(),
    }

    const postMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url = String(input)
      const req = init as RequestInit
      if (req?.method === 'POST' && url.includes('/reviews')) {
        return Promise.resolve(new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      }
      if (url.includes('/reviews/stats')) {
        return Promise.resolve(new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      if (url.includes('/reviews/me')) {
        return Promise.resolve(new Response(JSON.stringify({ title: 'Not Found', status: 404 }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify(reviewList), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })

    const wrapper = mountReviewPage(postMock)
    await flushPromises()

    const starButtons = wrapper.findAll('button[aria-label]').filter((b) =>
      b.attributes('aria-label')?.endsWith('점'),
    )
    await starButtons[3]!.trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('이미 리뷰를 작성했습니다.')
  })

  it('shows 409 conflict error message on duplicate submission (중복 방지)', async () => {
    const conflictMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url = String(input)
      const req = init as RequestInit
      if (req?.method === 'POST' && url.includes('/reviews')) {
        return Promise.resolve(new Response(
          JSON.stringify({ title: 'Conflict', detail: '이미 리뷰를 작성했습니다.', status: 409 }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ))
      }
      if (url.includes('/reviews/stats')) {
        return Promise.resolve(new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      if (url.includes('/reviews/me')) {
        return Promise.resolve(new Response(JSON.stringify({ title: 'Not Found', status: 404 }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify(reviewList), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })

    const wrapper = mountReviewPage(conflictMock)
    await flushPromises()

    const starButtons = wrapper.findAll('button[aria-label]').filter((b) =>
      b.attributes('aria-label')?.endsWith('점'),
    )
    await starButtons[4]!.trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('이미 리뷰를 작성했습니다.')
  })

  it('shows error state when stats/list fetch fails', async () => {
    const fetchMock = makeFetch([
      { match: '/reviews/stats', body: { title: 'Internal Server Error', status: 500 }, status: 500 },
      { match: '/reviews', body: [], status: 500 },
    ])
    const wrapper = mountReviewPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('리뷰를 불러오지 못했습니다.')
  })
})
