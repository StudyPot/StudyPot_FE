import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

export const groupHandlers = [
  http.get(`${apiBaseUrl}/groups`, () => HttpResponse.json(mockMswData.groups.groupList)),
  http.get(`${apiBaseUrl}/groups/:groupId`, ({ params }) => {
    const groupId = String(params.groupId)
    const group = mockMswData.groups.groupList.find((item) => item.id === groupId)

    if (!group) {
      return HttpResponse.json(
        {
          title: 'Not Found',
          detail: 'study group was not found.',
          status: 404,
        },
        { status: 404 },
      )
    }

    return HttpResponse.json(group)
  }),
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
