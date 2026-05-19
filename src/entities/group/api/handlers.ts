import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

export const groupHandlers = [
  http.get(`${apiBaseUrl}/groups`, () => HttpResponse.json(mockMswData.groups.groupList)),
  http.post(`${apiBaseUrl}/groups`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    return HttpResponse.json(
      {
        ...mockMswData.groups.createGroupResponse,
        ...body,
      },
      { status: 201 },
    )
  }),
  http.post(`${apiBaseUrl}/groups/:groupId/join`, ({ params }) => {
    return HttpResponse.json({
      id: '018f7a4e-1000-7000-9000-000000000099',
      groupId: String(params.groupId),
      userId: '018f7a4e-0000-7000-9000-000000000001',
      permission: 'MEMBER',
      status: 'PENDING_ONBOARDING',
      displayName: 'user1',
    })
  }),
]
