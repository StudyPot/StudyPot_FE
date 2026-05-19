import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { LlmUsage } from '../model/types'

type LegacyLlmUsage = {
  id: string
  groupId?: string
  conversationId?: string
  status: LlmUsage['status']
  model: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  latencyMs?: number
  createdAt?: string
}

export const operationHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/llm-usage`, ({ params }) => {
    return HttpResponse.json(
      (mockMswData.aiTeamLeader.llmUsage as LegacyLlmUsage[]).map((usage) =>
        toLlmUsage(usage, String(params.groupId)),
      ),
    )
  }),
]

function toLlmUsage(source: LegacyLlmUsage, groupId: string): LlmUsage {
  return {
    id: source.id,
    groupId,
    conversationId: source.conversationId,
    purpose: 'TEAM_LEAD_CHAT',
    provider: 'OPENAI',
    model: source.model,
    inputTokens: source.promptTokens ?? 0,
    outputTokens: source.completionTokens ?? 0,
    totalTokens: source.totalTokens,
    latencyMs: source.latencyMs,
    status: source.status,
    createdAt: source.createdAt,
  }
}
