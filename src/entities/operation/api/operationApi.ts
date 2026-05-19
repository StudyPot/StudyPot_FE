import { apiClient } from '@/shared/api'
import type { LlmUsage } from '../model/types'

export function listGroupLlmUsage(groupId: string): Promise<LlmUsage[]> {
  return apiClient<LlmUsage[]>(`/groups/${groupId}/llm-usage`)
}
