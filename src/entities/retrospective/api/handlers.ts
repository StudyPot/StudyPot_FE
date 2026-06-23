import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { JsonObject } from '@/shared/model/json'
import type { Retrospective } from '../model/types'

type LegacyRetrospective = {
  id: string
  weekId?: string
  status: Retrospective['status']
  feedback?: JsonObject
  nextWeekAdjustment?: JsonObject
}

export const retrospectiveHandlers = [
  http.post(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { answers?: unknown }
    return HttpResponse.json({ ...toRetrospective('COMPLETED'), answers: body?.answers ?? [] })
  }),
  http.get(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, () => {
    return HttpResponse.json(toRetrospective('COMPLETED'))
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/me`, () => {
    return HttpResponse.json([toRetrospective('COMPLETED')])
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/overview`, () => {
    const weekId =
      (mockMswData.retrospective.retrospective as LegacyRetrospective).weekId ??
      '018f7a4e-4000-7000-9000-000000000002'
    return HttpResponse.json([
      {
        weekId,
        weekNumber: 2,
        status: 'IN_PROGRESS',
        unlocked: true,
        answered: false,
        questions: [
          { id: 'q1', text: '이번 주 학습 목표를 달성했다', type: 'LIKERT_5' },
          { id: 'q2', text: '가장 어려웠던 점은 무엇인가요?', type: 'TEXT' },
        ],
      },
    ])
  }),
]

function toRetrospective(status?: Retrospective['status']): Retrospective {
  const source = mockMswData.retrospective.retrospective as LegacyRetrospective

  return {
    id: source.id,
    weekId: source.weekId,
    status: status ?? source.status,
    aiFeedback: source.feedback ?? {},
    nextWeekAdjustment: source.nextWeekAdjustment ?? {},
  }
}
