import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReview, getMyReview, getReviewStats, listReviews } from '../reviewsApi'
import type { Review, ReviewStats } from '../../model/types'

const groupId = '018f7a4e-0000-7000-9000-000000000011'

const review: Review = {
  id: '018f7a4e-9000-7000-9000-000000000001',
  groupId,
  userId: '018f7a4e-0000-7000-9000-000000000002',
  displayName: '김민준',
  rating: 5,
  content: '정말 좋은 스터디였습니다.',
  createdAt: '2026-06-01T10:30:00+09:00',
}

const stats: ReviewStats = {
  averageRating: 4.7,
  totalCount: 3,
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 2 },
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('reviewsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getReviewStats', () => {
    it('calls GET /api/v1/groups/{groupId}/reviews/stats', async () => {
      const fetchMock = mockFetch(stats)
      vi.stubGlobal('fetch', fetchMock)

      await expect(getReviewStats(groupId)).resolves.toEqual(stats)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/reviews/stats`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })
  })

  describe('listReviews', () => {
    it('calls GET /api/v1/groups/{groupId}/reviews and returns array', async () => {
      const fetchMock = mockFetch([review])
      vi.stubGlobal('fetch', fetchMock)

      await expect(listReviews(groupId)).resolves.toEqual([review])
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/reviews`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })
  })

  describe('getMyReview', () => {
    it('calls GET /api/v1/groups/{groupId}/reviews/me and returns my review', async () => {
      const fetchMock = mockFetch(review)
      vi.stubGlobal('fetch', fetchMock)

      await expect(getMyReview(groupId)).resolves.toEqual(review)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/reviews/me`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('propagates ApiError on 404 when user has not reviewed', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ title: 'Not Found', detail: '작성한 리뷰가 없습니다.', status: 404 }, 404),
      )

      await expect(getMyReview(groupId)).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
      })
    })
  })

  describe('createReview', () => {
    it('calls POST /api/v1/groups/{groupId}/reviews with rating and content', async () => {
      const fetchMock = mockFetch(review, 201)
      vi.stubGlobal('fetch', fetchMock)

      await expect(createReview(groupId, { rating: 5, content: '좋아요' })).resolves.toEqual(review)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/reviews`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(init.body as string)).toEqual({ rating: 5, content: '좋아요' })
    })

    it('propagates ApiError on 409 when review already exists (중복 방지)', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ title: 'Conflict', detail: '이미 리뷰를 작성했습니다.', status: 409 }, 409),
      )

      await expect(createReview(groupId, { rating: 4 })).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
      })
    })

    it('propagates ApiError on 400 when rating is out of range', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(
          {
            title: 'Bad Request',
            detail: '입력 값이 유효하지 않습니다.',
            status: 400,
            errors: { rating: '평점은 1~5 사이의 숫자여야 합니다.' },
          },
          400,
        ),
      )

      await expect(createReview(groupId, { rating: 0 })).rejects.toMatchObject({
        name: 'ApiError',
        status: 400,
      })
    })
  })
})
