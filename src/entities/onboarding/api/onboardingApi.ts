import { apiClient } from '@/shared/api'
import type { OnboardingResponse, SubmitOnboardingRequest } from '../model/types'

export function getMyOnboarding(groupId: string): Promise<OnboardingResponse> {
  return apiClient<OnboardingResponse>(`/groups/${groupId}/onboarding/me`)
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
