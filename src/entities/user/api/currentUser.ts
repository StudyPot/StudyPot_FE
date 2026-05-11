import { apiClient } from '@/shared/api'
import type { User } from '@/entities/user/model/types'

export function getCurrentUser(): Promise<User> {
  return apiClient<User>('/users/me')
}
