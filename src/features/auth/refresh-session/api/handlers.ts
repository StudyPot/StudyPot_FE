import { HttpResponse, http } from 'msw'

import { mockAuthTokenResponse } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

type RefreshSessionRequest = {
  refreshToken?: string
}

const refreshSessionUrl = `${apiBaseUrl}/auth/refresh`

export const refreshSessionHandlers = [
  http.post(refreshSessionUrl, async ({ request }) => {
    const body = (await request.json()) as RefreshSessionRequest

    if (!body.refreshToken) {
      return HttpResponse.json(
        {
          type: 'https://studypot.dev/problems/invalid-refresh-token',
          title: 'Invalid refresh token',
          status: 400,
          detail: 'refreshToken is required.',
        },
        { status: 400 },
      )
    }

    return HttpResponse.json({
      ...mockAuthTokenResponse,
      accessToken: 'mock-access-token-refreshed',
      refreshToken: 'mock-refresh-token-rotated',
    })
  }),
]
