import { apiClient } from '@/shared/api'
import type { Retrospective, RetrospectiveAnswer, RetrospectiveWeekOverview } from '../model/types'

/** 회고 설문 답변을 제출합니다. 그 주차 필수 TODO 를 모두 완료해야만 가능합니다(아니면 409). */
export function submitRetrospective(
  weekId: string,
  answers: RetrospectiveAnswer[],
): Promise<Retrospective> {
  return apiClient<Retrospective>(`/weeks/${weekId}/retrospectives/me`, {
    method: 'POST',
    body: { answers },
  })
}

export function getMyRetrospective(weekId: string): Promise<Retrospective> {
  return apiClient<Retrospective>(`/weeks/${weekId}/retrospectives/me`)
}

/** 그룹 내 내 모든 주차 회고를 최신 주차 순으로 조회합니다. */
export function listMyRetrospectives(groupId: string): Promise<Retrospective[]> {
  return apiClient<Retrospective[]>(`/groups/${groupId}/retrospectives/me`)
}

/** 주차별 회고 개요(질문/잠금/작성여부)를 한 번에 조회합니다. */
export function getRetrospectiveOverview(groupId: string): Promise<RetrospectiveWeekOverview[]> {
  return apiClient<RetrospectiveWeekOverview[]>(`/groups/${groupId}/retrospectives/overview`)
}
