import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type {
  GroupRule,
  GroupRuleType,
  HandleViolationRequest,
  RecordViolationRequest,
  RuleViolation,
  RuleViolationStatus,
  SaveRuleRequest,
} from '../model/types'

export const ruleHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/rules`, ({ params }) => {
    return HttpResponse.json(withGroupId(mockMswData.rules.rules as unknown as GroupRule[], params.groupId))
  }),
  http.put(`${apiBaseUrl}/groups/:groupId/rules/:ruleType`, async ({ params, request }) => {
    const body = (await request.json()) as SaveRuleRequest

    return HttpResponse.json({
      id: `rule-${String(params.ruleType)}`,
      groupId: String(params.groupId),
      createdBy: '018f7a4e-0000-7000-9000-000000000001',
      ruleType: String(params.ruleType) as GroupRuleType,
      config: body.config,
      description: body.description ?? null,
      active: body.active ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    } satisfies GroupRule)
  }),
  http.patch(`${apiBaseUrl}/groups/:groupId/rules/:ruleId/deactivate`, () => {
    return new HttpResponse(null, { status: 204 })
  }),
  http.delete(`${apiBaseUrl}/groups/:groupId/rules/:ruleId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/rule-violations`, () => {
    return HttpResponse.json(mockMswData.rules.violations)
  }),
  http.post(`${apiBaseUrl}/groups/:groupId/rule-violations`, async ({ request }) => {
    const body = (await request.json()) as RecordViolationRequest

    return HttpResponse.json(
      {
        id: `violation-${Date.now()}`,
        ruleId: body.ruleId,
        memberId: body.memberId,
        taskCompletionId: body.taskCompletionId ?? null,
        violationType: body.violationType,
        details: body.details ?? {},
        status: 'OPEN',
        resolvedAt: null,
        resolvedNote: null,
        occurredAt: body.occurredAt ?? new Date().toISOString(),
        createdAt: new Date().toISOString(),
      } satisfies RuleViolation,
      { status: 201 },
    )
  }),
  http.patch(
    `${apiBaseUrl}/groups/:groupId/rule-violations/:violationId/resolve`,
    async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as HandleViolationRequest

      return HttpResponse.json(handleViolation(String(params.violationId), 'RESOLVED', body.note))
    },
  ),
  http.patch(
    `${apiBaseUrl}/groups/:groupId/rule-violations/:violationId/waive`,
    async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as HandleViolationRequest

      return HttpResponse.json(handleViolation(String(params.violationId), 'WAIVED', body.note))
    },
  ),
]

function withGroupId(rules: GroupRule[], groupId: string | readonly string[] | undefined): GroupRule[] {
  return rules.map((rule) => ({
    ...rule,
    groupId: String(groupId || rule.groupId),
  }))
}

function handleViolation(
  violationId: string,
  status: RuleViolationStatus,
  note?: string,
): RuleViolation {
  const violation = (mockMswData.rules.violations as unknown as RuleViolation[])[0] ?? {
    id: violationId,
    ruleId: '018f7a4e-a000-7000-9000-000000000001',
    memberId: '018f7a4e-1000-7000-9000-000000000004',
    taskCompletionId: null,
    violationType: 'CUSTOM',
    details: {},
    status: 'OPEN',
    resolvedAt: null,
    resolvedNote: null,
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  return {
    ...violation,
    id: violationId,
    status,
    resolvedAt: new Date().toISOString(),
    resolvedNote: note ?? null,
  }
}
