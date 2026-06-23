import { HttpResponse, http } from 'msw'

import { apiBaseUrl } from '@/shared/config/api'
import type { Review, ReviewStats } from '../model/types'

const myReviews = new Map<string, Review>()

export const reviewHandlers = [
  // 리뷰 통계 조회
  http.get(`${apiBaseUrl}/groups/:groupId/reviews/stats`, ({ params }) => {
    const groupId = String(params.groupId)
    const reviews = [...myReviews.values()].filter((r) => r.groupId === groupId)
    const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    for (const r of reviews) dist[String(r.rating)] = (dist[String(r.rating)] ?? 0) + 1
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    const stats: ReviewStats = {
      averageRating: Math.round(avg * 10) / 10,
      totalCount: reviews.length,
      ratingDistribution: dist,
    }
    return HttpResponse.json(stats)
  }),

  // 리뷰 목록 조회
  http.get(`${apiBaseUrl}/groups/:groupId/reviews`, ({ params }) => {
    const groupId = String(params.groupId)
    const reviews = [...myReviews.values()].filter((r) => r.groupId === groupId)
    return HttpResponse.json(reviews)
  }),

  // 내 리뷰 조회
  http.get(`${apiBaseUrl}/groups/:groupId/reviews/me`, ({ params }) => {
    const groupId = String(params.groupId)
    const review = myReviews.get(groupId)
    if (!review) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '작성한 리뷰가 없습니다.', status: 404 },
        { status: 404 },
      )
    }
    return HttpResponse.json(review)
  }),

  // 리뷰 작성
  http.post(`${apiBaseUrl}/groups/:groupId/reviews`, async ({ params, request }) => {
    const groupId = String(params.groupId)
    if (myReviews.has(groupId)) {
      return HttpResponse.json(
        { title: 'Conflict', detail: '이미 리뷰를 작성했습니다.', status: 409 },
        { status: 409 },
      )
    }
    const body = (await request.json()) as { rating?: unknown; content?: unknown }
    if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
      return HttpResponse.json(
        { title: 'Bad Request', detail: '평점은 1~5 사이의 숫자여야 합니다.', status: 400 },
        { status: 400 },
      )
    }
    const created: Review = {
      id: `review-${Date.now()}`,
      groupId,
      userId: 'current-user-id',
      displayName: '나',
      rating: body.rating,
      content: typeof body.content === 'string' ? body.content : undefined,
      createdAt: new Date().toISOString(),
    }
    myReviews.set(groupId, created)
    return HttpResponse.json(created, { status: 201 })
  }),

  // 리뷰 수정
  http.patch(`${apiBaseUrl}/groups/:groupId/reviews/me`, async ({ params, request }) => {
    const groupId = String(params.groupId)
    const existing = myReviews.get(groupId)
    if (!existing) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '작성한 리뷰가 없습니다.', status: 404 },
        { status: 404 },
      )
    }
    const body = (await request.json()) as { rating?: unknown; content?: unknown }
    const updated: Review = {
      ...existing,
      rating: typeof body.rating === 'number' ? body.rating : existing.rating,
      content: typeof body.content === 'string' ? body.content : existing.content,
    }
    myReviews.set(groupId, updated)
    return HttpResponse.json(updated)
  }),
]
