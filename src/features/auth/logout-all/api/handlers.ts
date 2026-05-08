import { HttpResponse, http } from 'msw'

import { apiBaseUrl } from '@/shared/config/api'

const logoutAllUrl = `${apiBaseUrl}/auth/logout-all`

export const logoutAllHandlers = [
  http.post(logoutAllUrl, () => new HttpResponse(null, { status: 204 })),
]
