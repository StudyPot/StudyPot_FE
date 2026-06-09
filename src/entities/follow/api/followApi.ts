import { apiClient } from '@/shared/api'
import type { FollowToggleResult, FollowUser } from '../model/types'

export function toggleFollow(userId: string): Promise<FollowToggleResult> {
  return apiClient<FollowToggleResult>(`/users/${userId}/follow`, {
    method: 'POST',
  })
}

export function listFollowing(): Promise<FollowUser[]> {
  return apiClient<FollowUser[]>('/users/me/following')
}

export function listFollowers(): Promise<FollowUser[]> {
  return apiClient<FollowUser[]>('/users/me/followers')
}
