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
  http.post(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, () => {
    return HttpResponse.json(toRetrospective('PROCESSING'), { status: 202 })
  }),
  http.get(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, () => {
    return HttpResponse.json(toRetrospective('COMPLETED'))
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/me`, () => {
    return HttpResponse.json([toRetrospective('COMPLETED')])
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
