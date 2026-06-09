import { HttpResponse, http } from 'msw'

import { mockUser } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { UpdateUserRequest, User } from '../model/types'

const currentUserUrl = `${apiBaseUrl}/users/me`

export const userHandlers = [
  http.get(currentUserUrl, () => HttpResponse.json(mockUser)),

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
