import { apiClient } from '@/shared/api'
import type { Retrospective } from '../model/types'

export function requestRetrospective(weekId: string): Promise<Retrospective> {
  return apiClient<Retrospective>(`/weeks/${weekId}/retrospectives/me`, {
    method: 'POST',
  })
}

export function getMyRetrospective(weekId: string): Promise<Retrospective> {
  return apiClient<Retrospective>(`/weeks/${weekId}/retrospectives/me`)
}

/** 그룹 내 내 모든 주차 회고를 최신 주차 순으로 조회합니다. (이번 주/지난 주 회고 확인) */
export function listMyRetrospectives(groupId: string): Promise<Retrospective[]> {
  return apiClient<Retrospective[]>(`/groups/${groupId}/retrospectives/me`)
}
