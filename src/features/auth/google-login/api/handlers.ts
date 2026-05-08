import { HttpResponse, http } from 'msw'

import { mockAuthTokenResponse } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

type GoogleLoginRequest = {
  authorizationCode?: string
  redirectUri?: string
  codeVerifier?: string
}

const googleLoginUrl = `${apiBaseUrl}/auth/oauth/google`

export const googleLoginHandlers = [
  http.post(googleLoginUrl, async ({ request }) => {
    const body = (await request.json()) as GoogleLoginRequest

    if (!body.authorizationCode || !body.redirectUri || !body.codeVerifier) {
      return HttpResponse.json(
        {
          type: 'https://studypot.dev/problems/invalid-google-login-request',
          title: 'Invalid Google login request',
          status: 400,
          detail: 'authorizationCode, redirectUri, codeVerifier are required.',
        },
        { status: 400 },
      )
    }

    return HttpResponse.json(mockAuthTokenResponse)
  }),
]
