import { apiClient } from '@/shared/api'
import type {
  GroupRule,
  GroupRuleType,
  HandleViolationRequest,
  RecordViolationRequest,
  RuleViolation,
  SaveRuleRequest,
} from '../model/types'

export function listRules(groupId: string): Promise<GroupRule[]> {
  return apiClient<GroupRule[]>(`/groups/${groupId}/rules`)
}

export function saveRule(
  groupId: string,
  ruleType: GroupRuleType,
  request: SaveRuleRequest,
): Promise<GroupRule> {
  return apiClient<GroupRule>(`/groups/${groupId}/rules/${ruleType}`, {
    method: 'PUT',
    body: request,
  })
}

export function deactivateRule(groupId: string, ruleId: string): Promise<void> {
  return apiClient<void>(`/groups/${groupId}/rules/${ruleId}/deactivate`, {
    method: 'PATCH',
  })
}

export function deleteRule(groupId: string, ruleId: string): Promise<void> {
  return apiClient<void>(`/groups/${groupId}/rules/${ruleId}`, {
    method: 'DELETE',
  })
}

export function listViolations(groupId: string): Promise<RuleViolation[]> {
  return apiClient<RuleViolation[]>(`/groups/${groupId}/rule-violations`)
}

export function recordViolation(
  groupId: string,
  request: RecordViolationRequest,
): Promise<RuleViolation> {
  return apiClient<RuleViolation>(`/groups/${groupId}/rule-violations`, {
    method: 'POST',
    body: request,
  })
}

export function resolveViolation(
  groupId: string,
  violationId: string,
  request: HandleViolationRequest = {},
): Promise<RuleViolation> {
  return apiClient<RuleViolation>(`/groups/${groupId}/rule-violations/${violationId}/resolve`, {
    method: 'PATCH',
    body: request,
  })
}

export function waiveViolation(
  groupId: string,
  violationId: string,
  request: HandleViolationRequest = {},
): Promise<RuleViolation> {
  return apiClient<RuleViolation>(`/groups/${groupId}/rule-violations/${violationId}/waive`, {
    method: 'PATCH',
    body: request,
  })
}
