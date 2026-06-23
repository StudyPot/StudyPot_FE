import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReview, getMyReview, getRetroQuestions } from '../reviewsApi'
import type { RetroQuestion, Review } from '../../model/types'

const groupId = '018f7a4e-0000-7000-9000-000000000011'

const questions: RetroQuestion[] = [
  { id: 'taskDifficulty', type: 'scale', label: '이번 주차 과제 난이도는 어땠나요?', required: true },
  {
    id: 'reflection',
    type: 'text',
    label: '이번 주차를 돌아보며 한 줄 소감을 남겨주세요.',
    required: false,
    placeholder: '배운 점, 아쉬운 점 등을 자유롭게 적어보세요.',
  },
]

const review: Review = {
  id: '018f7a4e-9000-7000-9000-000000000001',
  groupId,
  userId: '018f7a4e-0000-7000-9000-000000000002',
  displayName: '김민준',
  answers: { taskDifficulty: 3, reflection: '유익했습니다.' },
  createdAt: '2026-06-01T10:30:00+09:00',
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

  describe('getRetroQuestions', () => {
    it('calls GET /api/v1/groups/{groupId}/reviews/questions', async () => {
      const fetchMock = mockFetch(questions)
      vi.stubGlobal('fetch', fetchMock)

      await expect(getRetroQuestions(groupId)).resolves.toEqual(questions)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/reviews/questions`,
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
        mockFetch({ title: 'Not Found', detail: '작성한 회고가 없습니다.', status: 404 }, 404),
      )

      await expect(getMyReview(groupId)).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
      })
    })
  })

  describe('createReview', () => {
    it('calls POST /api/v1/groups/{groupId}/reviews with answers', async () => {
      const fetchMock = mockFetch(review, 201)
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        createReview(groupId, { answers: { taskDifficulty: 3, reflection: '유익했습니다.' } }),
      ).resolves.toEqual(review)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/reviews`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(init.body as string)).toEqual({
        answers: { taskDifficulty: 3, reflection: '유익했습니다.' },
      })
    })

    it('propagates ApiError on 409 when review already exists', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ title: 'Conflict', detail: '이미 회고를 작성했습니다.', status: 409 }, 409),
      )

      await expect(createReview(groupId, { answers: { taskDifficulty: 4 } })).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
      })
    })
  })
})
