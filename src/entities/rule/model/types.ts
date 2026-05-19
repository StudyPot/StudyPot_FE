import type { JsonObject } from '@/shared/model/json'

export type GroupRuleType = 'TASK_DEADLINE' | 'RETROSPECTIVE_REQUIRED' | 'CUSTOM_NOTE'

export type RuleViolationType = 'INCOMPLETE_REASON_MISSING' | 'RETROSPECTIVE_MISSING' | 'CUSTOM'

export type RuleViolationStatus = 'OPEN' | 'RESOLVED' | 'WAIVED'

export type SaveRuleRequest = {
  config: JsonObject
  description?: string
  active?: boolean
}

export type GroupRule = {
  id: string
  groupId: string
  createdBy: string
  ruleType: GroupRuleType
  config: JsonObject
  description?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type RecordViolationRequest = {
  ruleId: string
  memberId: string
  taskCompletionId?: string
  violationType: RuleViolationType
  details?: JsonObject
  occurredAt?: string
}

export type HandleViolationRequest = {
  note?: string
}

export type RuleViolation = {
  id: string
  ruleId: string
  memberId: string
  taskCompletionId?: string | null
  violationType: RuleViolationType
  details: JsonObject
  status: RuleViolationStatus
  resolvedAt?: string | null
  resolvedNote?: string | null
  occurredAt: string
  createdAt: string
}
