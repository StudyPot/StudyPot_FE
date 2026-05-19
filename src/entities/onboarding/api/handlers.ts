import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { AvailabilitySlot, OnboardingResponse } from '../model/types'

type LegacyKeywordLevel = {
  keyword: string
  skillLevel: number
}

type LegacyTaskPreference = {
  taskType: string
  score: number
}

type LegacyAvailabilitySlot = {
  dayOfWeek: string | number
  startTime: string
  endTime: string
  timezone: string
}

type LegacyOnboarding = {
  groupId: string
  status: 'DRAFT' | 'SUBMITTED'
  detailKeywordLevels: LegacyKeywordLevel[]
  taskPreferences: LegacyTaskPreference[]
  availabilitySlots: LegacyAvailabilitySlot[]
  memo?: string
  submittedAt?: string | null
  updatedAt?: string | null
}

const dayOfWeekMap: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

export const onboardingHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/onboarding/me`, ({ params }) => {
    return HttpResponse.json(
      toOnboardingResponse(mockMswData.onboarding.myOnboarding as unknown as LegacyOnboarding, params.groupId),
    )
  }),
  http.put(`${apiBaseUrl}/groups/:groupId/onboarding/me`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<OnboardingResponse>

    return HttpResponse.json({
      ...toOnboardingResponse(
        mockMswData.onboarding.saveOnboardingResponse as unknown as LegacyOnboarding,
        params.groupId,
      ),
      ...body,
      status: 'DRAFT',
    })
  }),
  http.post(`${apiBaseUrl}/groups/:groupId/onboarding/me/submit`, ({ params }) => {
    return HttpResponse.json(
      toOnboardingResponse(
        mockMswData.onboarding.submitOnboardingResponse as unknown as LegacyOnboarding,
        params.groupId,
      ),
    )
  }),
]

function toOnboardingResponse(
  source: LegacyOnboarding,
  groupId: string | readonly string[] | undefined,
): OnboardingResponse {
  return {
    id: '018f7a4e-2000-7000-9000-000000000001',
    groupId: String(groupId || source.groupId),
    memberId: '018f7a4e-1000-7000-9000-000000000001',
    keywordSkillLevels: Object.fromEntries(
      source.detailKeywordLevels.map((item) => [item.keyword, item.skillLevel]),
    ),
    taskPreferences: Object.fromEntries(
      source.taskPreferences.map((item) => [item.taskType, item.score]),
    ),
    additionalNote: source.memo ?? null,
    availabilitySlots: source.availabilitySlots.map(toAvailabilitySlot),
    status: source.status,
    submittedAt: source.submittedAt ?? null,
  }
}

function toAvailabilitySlot(source: LegacyAvailabilitySlot): AvailabilitySlot {
  return {
    dayOfWeek:
      typeof source.dayOfWeek === 'number' ? source.dayOfWeek : dayOfWeekMap[source.dayOfWeek] ?? 0,
    startTime: source.startTime,
    endTime: source.endTime,
    timezone: source.timezone,
  }
}
