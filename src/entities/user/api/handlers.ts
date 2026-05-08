import { HttpResponse, http } from 'msw'

import { mockUser } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

const currentUserUrl = `${apiBaseUrl}/users/me`

export const userHandlers = [http.get(currentUserUrl, () => HttpResponse.json(mockUser))]
