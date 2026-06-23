import { HttpResponse, http } from 'msw'

import { apiBaseUrl } from '@/shared/config/api'
import questionsData from '../model/questions.json'
import type { RetroQuestion, Review } from '../model/types'

const QUESTIONS: RetroQuestion[] = questionsData.questions as RetroQuestion[]

const myReviews = new Map<string, Review>()

export const reviewHandlers = [
  // 회고 질문 목록 조회
  http.get(`${apiBaseUrl}/groups/:groupId/reviews/questions`, () => {
    return HttpResponse.json(QUESTIONS)
  }),

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
    if (!body.answers || typeof body.answers !== 'object') {
      return HttpResponse.json(
        { title: 'Bad Request', detail: '답변 데이터가 올바르지 않습니다.', status: 400 },
        { status: 400 },
      )
    }
    const created: Review = {
      id: `review-${Date.now()}`,
      groupId,
      userId: 'current-user-id',
      displayName: '나',
      answers: body.answers as Record<string, number | string>,
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
    const updated: Review = {
      ...existing,
      answers:
        body.answers && typeof body.answers === 'object'
          ? (body.answers as Record<string, number | string>)
          : existing.answers,
    }
    myReviews.set(groupId, updated)
    return HttpResponse.json(updated)
  }),
]
