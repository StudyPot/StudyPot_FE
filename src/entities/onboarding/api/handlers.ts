import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

export const onboardingHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/onboarding/me`, () => {
    return HttpResponse.json(mockMswData.onboarding.myOnboarding)
  }),
  http.post(`${apiBaseUrl}/groups/:groupId/onboarding/me`, async ({ request }) => {
    const body = await request.json()

    return HttpResponse.json({
      ...mockMswData.onboarding.submitOnboardingResponse,
      ...body,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    })
  }),
]
