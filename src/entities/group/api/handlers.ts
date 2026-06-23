import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'

export const groupHandlers = [
  http.get(`${apiBaseUrl}/groups/summary`, () => {
    return HttpResponse.json(mockMswData.groups.groupSummary)
  }),
  http.get(`${apiBaseUrl}/groups`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const status = url.searchParams.get('status') ?? ''
    const sort = url.searchParams.get('sort') ?? ''
    const order = url.searchParams.get('order') ?? 'asc'

    let result = [...mockMswData.groups.groupList]

    if (q) {
      result = result.filter(
        (g) => g.name.toLowerCase().includes(q) || g.topic.toLowerCase().includes(q),
      )
    }

    if (status) {
      result = result.filter((g) => g.status === status)
    }

    if (sort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'startsAt') {
      result.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    } else if (sort === 'endsAt') {
      result.sort((a, b) => a.endsAt.localeCompare(b.endsAt))
    }

    if (sort && order === 'desc') {
      result.reverse()
    }

    return HttpResponse.json(result)
  }),
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
  http.post(`${apiBaseUrl}/groups/join`, async ({ request }) => {
    const body = (await request.json()) as { inviteCode: string }
    const group = mockMswData.groups.groupList.find((g) => g.inviteCode === body.inviteCode)

    if (!group) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '유효하지 않은 초대 코드입니다.', status: 404 },
        { status: 404 },
      )
    }

    return HttpResponse.json({
      id: '018f7a4e-1000-7000-9000-000000000099',
      groupId: group.id,
      userId: '018f7a4e-0000-7000-9000-000000000001',
      permission: 'MEMBER',
      status: 'PENDING_ONBOARDING',
      displayName: 'user1',
    })
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
  http.patch(`${apiBaseUrl}/groups/:groupId/members/me/profile`, async ({ params, request }) => {
    const body = (await request.json()) as { displayName: string }
    return HttpResponse.json({
      ...mockMswData.groups.myMemberProfile,
      groupId: String(params.groupId),
      displayName: body.displayName,
    })
  }),
  http.patch(`${apiBaseUrl}/groups/:groupId`, async ({ params, request }) => {
    const groupId = String(params.groupId)
    const group = mockMswData.groups.groupList.find((item) => item.id === groupId)

    if (!group) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '존재하지 않는 그룹입니다.', status: 404 },
        { status: 404 },
      )
    }

    const body = (await request.json()) as Record<string, unknown>

    if (typeof body.name === 'string' && body.name.trim().length === 0) {
      return HttpResponse.json(
        {
          title: 'Bad Request',
          detail: '그룹 이름은 필수 입력 값입니다.',
          status: 400,
          errors: { name: '그룹 이름은 필수 입력 값입니다.' },
        },
        { status: 400 },
      )
    }

    if (typeof body.name === 'string' && body.name.length > 120) {
      return HttpResponse.json(
        {
          title: 'Unprocessable Entity',
          detail: '입력 값이 유효하지 않습니다.',
          status: 422,
          errors: { name: '그룹 이름은 120자 이하로 입력해주세요.' },
        },
        { status: 422 },
      )
    }

    if (
      typeof body.endsAt === 'string' &&
      typeof body.startsAt === 'string' &&
      body.endsAt < body.startsAt
    ) {
      return HttpResponse.json(
        {
          title: 'Unprocessable Entity',
          detail: '입력 값이 유효하지 않습니다.',
          status: 422,
          errors: { endsAt: '종료일은 시작일 이후여야 합니다.' },
        },
        { status: 422 },
      )
    }

    return HttpResponse.json({ ...group, ...body })
  }),

  http.delete(`${apiBaseUrl}/groups/:groupId`, ({ params }) => {
    const groupId = String(params.groupId)
    const group = mockMswData.groups.groupList.find((item) => item.id === groupId)

    if (!group) {
      return HttpResponse.json(
        { title: 'Not Found', detail: '존재하지 않는 그룹입니다.', status: 404 },
        { status: 404 },
      )
    }

    return new HttpResponse(null, { status: 204 })
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
