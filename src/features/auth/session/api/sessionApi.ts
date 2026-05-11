import { apiClient } from '@/shared/api'
import type { User } from '@/entities/user/model/types'

export type AuthSessionResponse = {
  tokenType?: string
  expiresIn?: number
  user: User
}

export function refreshSession(): Promise<AuthSessionResponse> {
  return apiClient<AuthSessionResponse>('/auth/refresh', {
    method: 'POST',
  })
}

export function logout(): Promise<void> {
  return apiClient<void>('/auth/logout', {
    method: 'POST',
  })
}

export function logoutAll(): Promise<void> {
  return apiClient<void>('/auth/logout-all', {
    method: 'POST',
  })
}
