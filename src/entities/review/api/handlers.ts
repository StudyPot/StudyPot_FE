import { HttpResponse, http } from 'msw'

import { apiBaseUrl } from '@/shared/config/api'
import type { RetroAnswers, Review } from '../model/types'

// groupId → 내 회고 (메모리 저장, 새로고침 시 초기화)
const myReviews = new Map<string, Review>()

function validateAnswers(answers: unknown): answers is RetroAnswers {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false
  return Object.values(answers as Record<string, unknown>).every(
    (v) => typeof v === 'number' || typeof v === 'string',
  )
}

export const reviewHandlers = [
  // 내 회고 조회
  http.get(`${apiBaseUrl}/groups/:groupId/reviews/me`, ({ params }) => {
    const groupId = String(params.groupId)
    const review = myReviews.get(groupId)

    if (!review) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '작성한 회고가 없습니다.', status: 404 },
        { status: 404 },
      )
    }

    return HttpResponse.json(review)
  }),

  // 회고 작성
  http.post(`${apiBaseUrl}/groups/:groupId/reviews`, async ({ params, request }) => {
    const groupId = String(params.groupId)

    if (myReviews.has(groupId)) {
      return HttpResponse.json(
        { title: 'Conflict', detail: '이미 회고를 작성했습니다.', status: 409 },
        { status: 409 },
      )
    }

    const body = (await request.json()) as { answers?: unknown }

    if (!validateAnswers(body.answers)) {
      return HttpResponse.json(
        { title: 'Bad Request', detail: '답변 형식이 올바르지 않습니다.', status: 400 },
        { status: 400 },
      )
    }

    const created: Review = {
      id: `review-${Date.now()}`,
      groupId,
      userId: 'current-user-id',
      displayName: '나',
      answers: body.answers,
      createdAt: new Date().toISOString(),
    }

    myReviews.set(groupId, created)
    return HttpResponse.json(created, { status: 201 })
  }),

  // 회고 수정
  http.patch(`${apiBaseUrl}/groups/:groupId/reviews/me`, async ({ params, request }) => {
    const groupId = String(params.groupId)
    const existing = myReviews.get(groupId)

    if (!existing) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '작성한 회고가 없습니다.', status: 404 },
        { status: 404 },
      )
    }

    const body = (await request.json()) as { answers?: unknown }

    if (!validateAnswers(body.answers)) {
      return HttpResponse.json(
        { title: 'Bad Request', detail: '답변 형식이 올바르지 않습니다.', status: 400 },
        { status: 400 },
      )
    }

    const updated: Review = { ...existing, answers: body.answers }
    myReviews.set(groupId, updated)
    return HttpResponse.json(updated)
  }),
]
