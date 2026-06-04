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
  http.post(`${apiBaseUrl}/groups/detail-keyword-suggestions`, async ({ request }) => {
    const body = (await request.json()) as { hintKeywords?: string[]; maxCandidates?: number }
    const sourceKeywords = mockMswData.groups.detailKeywordSuggestionResponse.keywords
    const hintKeywords = new Set(body.hintKeywords ?? [])
    const maxCandidates = body.maxCandidates ?? 5
    const keywords = sourceKeywords
      .filter((keyword) => !hintKeywords.has(keyword))
      .slice(0, maxCandidates)

    return HttpResponse.json({ keywords })
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
  http.get(`${apiBaseUrl}/groups/:groupId/members`, () => {
    return HttpResponse.json(mockMswData.groups.groupMembers)
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/members/me/profile`, ({ params }) => {
    return HttpResponse.json({
      ...mockMswData.groups.myMemberProfile,
      groupId: String(params.groupId),
    })
  }),
  http.post(`${apiBaseUrl}/groups/:groupId/start`, async ({ params }) => {
    // AI 커리큘럼 생성 시간 시뮬레이션 (프로그레스바 테스트용: 약 8초)
    await new Promise<void>((resolve) => setTimeout(resolve, 8000))
    return HttpResponse.json(
      {
        ...mockMswData.groups.startStudyResponse,
        groupId: String(params.groupId),
      },
      { status: 201 },
    )
  }),
]
