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

const QUESTIONS = [
  { id: 'q1', text: '이번 주 학습 목표를 충분히 달성했다', type: 'LIKERT_5' as const },
  { id: 'q2', text: '커리큘럼 난이도가 나에게 적절했다', type: 'LIKERT_5' as const },
  { id: 'q3', text: '스터디 모임이 학습에 도움이 되었다', type: 'LIKERT_5' as const },
  { id: 'q4', text: '팀원들과 충분히 소통했다', type: 'LIKERT_5' as const },
  { id: 'q5', text: '계획한 학습 시간을 지켰다', type: 'LIKERT_5' as const },
  { id: 'q6', text: '이번 주 분량이 부담스럽지 않았다', type: 'LIKERT_5' as const },
  { id: 'q7', text: '한 줄 회고를 남겨 주세요', type: 'TEXT' as const },
]

const SUBMITTED_ANSWERS = [
  { questionId: 'q1', score: 5 },
  { questionId: 'q2', score: 4 },
  { questionId: 'q3', score: 5 },
  { questionId: 'q4', score: 3 },
  { questionId: 'q5', score: 4 },
  { questionId: 'q6', score: 2 },
  { questionId: 'q7', text: '필터 체인 흐름을 잡으니 전체 그림이 보였어요.' },
]

function overviewWeeks() {
  return Array.from({ length: 10 }, (_, i) => {
    const weekNumber = i + 1
    const status = weekNumber < 3 ? 'COMPLETED' : weekNumber === 3 ? 'IN_PROGRESS' : 'PENDING'
    return {
      weekId: `w${weekNumber}`,
      weekNumber,
      status,
      unlocked: weekNumber < 3,
      answered: weekNumber < 3,
      questions: QUESTIONS,
    }
  })
}

export const retrospectiveHandlers = [
  http.post(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { answers?: unknown }
    return HttpResponse.json({ ...toRetrospective('COMPLETED'), answers: body?.answers ?? [] })
  }),
  http.get(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, () => {
    return HttpResponse.json({ ...toRetrospective('COMPLETED'), answers: SUBMITTED_ANSWERS })
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/me`, () => {
    return HttpResponse.json([toRetrospective('COMPLETED')])
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/overview`, () => {
    return HttpResponse.json(overviewWeeks())
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
