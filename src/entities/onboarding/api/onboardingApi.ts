import { apiClient } from '@/shared/api'
import type { MemberOnboardingResponse, OnboardingResponse, SubmitOnboardingRequest } from '../model/types'

export function getMyOnboarding(groupId: string): Promise<OnboardingResponse> {
  return apiClient<OnboardingResponse>(`/groups/${groupId}/onboarding/me`)
}

export function getGroupOnboardings(groupId: string): Promise<MemberOnboardingResponse[]> {
  return apiClient<MemberOnboardingResponse[]>(`/groups/${groupId}/onboarding`)
}

export function submitMyOnboarding(
  groupId: string,
  request: SubmitOnboardingRequest,
): Promise<OnboardingResponse> {
  return apiClient<OnboardingResponse>(`/groups/${groupId}/onboarding/me`, {
    method: 'POST',
    body: request,
  })
}
