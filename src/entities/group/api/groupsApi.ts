import { apiClient } from '@/shared/api'
import type { StudyGroup } from '../model/types'

export function listGroups(): Promise<StudyGroup[]> {
  return apiClient<StudyGroup[]>('/groups')
}
