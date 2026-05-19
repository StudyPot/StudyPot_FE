export type LlmUsagePurpose =
  | 'DETAIL_KEYWORD_SUGGEST'
  | 'CURRICULUM_GENERATE'
  | 'CURRICULUM_REGENERATE_WEEK'
  | 'TEAM_LEAD_CHAT'
  | 'RETROSPECTIVE_ANALYZE'
  | 'RETROSPECTIVE_FEEDBACK'
  | 'NEXT_WEEK_ADJUST'

export type LlmProvider = 'OPENAI'

export type LlmUsageStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT'

export type LlmUsage = {
  id: string
  purpose: LlmUsagePurpose
  provider: LlmProvider
  model: string
  inputTokens: number
  outputTokens: number
  status: LlmUsageStatus
  groupId?: string
  conversationId?: string
  totalTokens?: number
  latencyMs?: number
  createdAt?: string
}
