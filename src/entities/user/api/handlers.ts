import { HttpResponse, http } from 'msw'

import { mockUser } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { AiQuota, StudyQuota, UpdateUserRequest, User } from '../model/types'

const currentUserUrl = `${apiBaseUrl}/users/me`
const studyQuotaUrl = `${apiBaseUrl}/users/me/study-quota`
const aiQuotaUrl = `${apiBaseUrl}/users/me/ai-quota`

export const userHandlers = [
  http.get(currentUserUrl, () => HttpResponse.json(mockUser)),

  http.get(studyQuotaUrl, () =>
    HttpResponse.json<StudyQuota>({
      plan: 'FREE',
      hostedActiveCount: 1,
      limit: 3,
      canCreate: true,
    }),
  ),

  http.get(aiQuotaUrl, () =>
    HttpResponse.json<AiQuota>({
      plan: 'FREE',
      dailyLimit: 15,
      used: 13,
      remaining: 2,
      resetSeconds: 43200,
    }),
  ),

  http.patch(currentUserUrl, async ({ request }) => {
    const body = (await request.json()) as Partial<UpdateUserRequest>

    if (typeof body.nickname === 'string' && body.nickname.trim().length === 0) {
      return HttpResponse.json(
        {
          title: 'Bad Request',
          detail: '닉네임은 필수 입력 값입니다.',
          status: 400,
          errors: { nickname: '닉네임은 필수 입력 값입니다.' },
        },
        { status: 400 },
      )
    }

    const updated: User = {
      ...(mockUser as User),
      ...body,
      nickname: body.nickname?.trim() ?? (mockUser as User).nickname,
    }

    return HttpResponse.json(updated)
  }),
]
