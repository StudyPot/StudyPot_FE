import { apiClient } from '@/shared/api'
import type { OnboardingResponse, SaveOnboardingRequest } from '../model/types'

export function getMyOnboarding(groupId: string): Promise<OnboardingResponse> {
  return apiClient<OnboardingResponse>(`/groups/${groupId}/onboarding/me`)
}

export function saveMyOnboarding(
  groupId: string,
  request: SaveOnboardingRequest,
): Promise<OnboardingResponse> {
  return apiClient<OnboardingResponse>(`/groups/${groupId}/onboarding/me`, {
    method: 'PUT',
    body: request,
  })
}

export function submitMyOnboarding(groupId: string): Promise<OnboardingResponse> {
  return apiClient<OnboardingResponse>(`/groups/${groupId}/onboarding/me/submit`, {
    method: 'POST',
  })
}
