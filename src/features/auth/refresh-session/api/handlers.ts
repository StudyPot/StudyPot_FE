import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

const refreshSessionUrl = `${apiBaseUrl}/auth/refresh`

export const refreshSessionHandlers = [
  http.post(refreshSessionUrl, () => {
    return HttpResponse.json(mockMswData.auth.refreshResponse)
  }),
]
