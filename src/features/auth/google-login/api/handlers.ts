import { HttpResponse, http } from 'msw'

const googleLoginStartUrl = '/api/oauth2/authorization/google'

export const googleLoginHandlers = [
  http.get(googleLoginStartUrl, () => HttpResponse.redirect('/auth/success', 302)),
]
