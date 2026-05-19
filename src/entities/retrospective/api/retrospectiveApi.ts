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
