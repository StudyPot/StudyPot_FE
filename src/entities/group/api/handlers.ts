import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

export const groupHandlers = [
  http.get(`${apiBaseUrl}/groups`, () => HttpResponse.json(mockMswData.groups.groupList)),
]
