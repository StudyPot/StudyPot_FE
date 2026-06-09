import { apiClient } from '@/shared/api'
import type { UpdateUserRequest, User } from '@/entities/user/model/types'

export function getCurrentUser(): Promise<User> {
  return apiClient<User>('/users/me')
}

export function updateCurrentUser(request: UpdateUserRequest): Promise<User> {
  return apiClient<User>('/users/me', {
    method: 'PATCH',
    body: request,
  })
}
