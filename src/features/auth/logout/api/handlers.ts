import { HttpResponse, http } from 'msw'

import { apiBaseUrl } from '@/shared/config/api'

const logoutUrl = `${apiBaseUrl}/auth/logout`

export const logoutHandlers = [http.post(logoutUrl, () => new HttpResponse(null, { status: 204 }))]
