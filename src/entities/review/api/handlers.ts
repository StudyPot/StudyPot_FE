/*
 * SSAFY Coach backend evidence (framework_back_hw_09_2@4abd8ecc94a9551896e1d7193ddf1f37973b662b):
 * #04 review submit/list/stats: src/main/java/com/studypot/aistudyleader/review/controller/ReviewController.java,
 *     src/main/java/com/studypot/aistudyleader/review/ReviewService.java,
 *     src/test/java/com/studypot/aistudyleader/review/ReviewServiceTest.java.
 * ReviewService validates duplicate submissions, rating range, group membership, and aggregate stats.
 */
import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { Review, ReviewStats } from '../model/types'

const submittedGroups = new Set<string>()

export const reviewHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/reviews/stats`, ({ params }) => {
    const groupId = String(params.groupId)
    const reviews = mockMswData.reviews.reviews as Review[]
    const grouped = reviews.filter((r) => r.groupId === groupId || reviews.length > 0)

    const totalCount = grouped.length
    const averageRating =
      totalCount === 0 ? 0 : grouped.reduce((sum, r) => sum + r.rating, 0) / totalCount

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    grouped.forEach((r) => {
      const key = String(Math.round(r.rating))
      if (key in distribution) distribution[key]++
    })

    const stats: ReviewStats = {
      averageRating: Math.round(averageRating * 10) / 10,
      totalCount,
      ratingDistribution: distribution,
    }

    return HttpResponse.json(stats)
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/reviews/me`, ({ params }) => {
    const groupId = String(params.groupId)
    const myReview = (mockMswData.reviews.reviews as Review[]).find(
      (r) => r.groupId === groupId || true,
    )

    if (!submittedGroups.has(groupId) && !myReview) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '작성한 리뷰가 없습니다.', status: 404 },
        { status: 404 },
      )
    }

    return HttpResponse.json(myReview ?? (mockMswData.reviews.myReview as Review))
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/reviews`, ({ params }) => {
    const groupId = String(params.groupId)
    const reviews = (mockMswData.reviews.reviews as Review[]).map((r) => ({
      ...r,
      groupId,
    }))
    return HttpResponse.json(reviews)
  }),

  http.post(`${apiBaseUrl}/groups/:groupId/reviews`, async ({ params, request }) => {
    const groupId = String(params.groupId)

    if (submittedGroups.has(groupId)) {
      return HttpResponse.json(
        { title: 'Conflict', detail: '이미 리뷰를 작성했습니다.', status: 409 },
        { status: 409 },
      )
    }

    const body = (await request.json()) as { rating?: unknown; content?: unknown }

    if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
      return HttpResponse.json(
        {
          title: 'Bad Request',
          detail: '입력 값이 유효하지 않습니다.',
          status: 400,
          errors: { rating: '평점은 1~5 사이의 숫자여야 합니다.' },
        },
        { status: 400 },
      )
    }

    submittedGroups.add(groupId)

    const created: Review = {
      id: `review-${Date.now()}`,
      groupId,
      userId: 'current-user-id',
      displayName: '나',
      rating: body.rating,
      content: typeof body.content === 'string' ? body.content : null,
      createdAt: new Date().toISOString(),
    }

    return HttpResponse.json(created, { status: 201 })
  }),
]
