import { apiClient } from '@/shared/api'
import type { StudyQuota, UpdateUserRequest, User } from '@/entities/user/model/types'

export function getCurrentUser(): Promise<User> {
  return apiClient<User>('/users/me')
}

export function updateCurrentUser(request: UpdateUserRequest): Promise<User> {
  return apiClient<User>('/users/me', {
    method: 'PATCH',
    body: request,
  })
}

// 호스트 스터디 개수 제한 현황 조회(생성 버튼 게이팅/안내용).
export function getStudyQuota(): Promise<StudyQuota> {
  return apiClient<StudyQuota>('/users/me/study-quota')
}

