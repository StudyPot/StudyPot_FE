import { apiClient, getRefreshToken, setAuthTokens } from '@/shared/api'
import type { User } from '@/entities/user/model/types'

export type AuthSessionResponse = {
  tokenType?: string
  expiresIn?: number
  accessToken?: string
  refreshToken?: string
  user: User
}

export async function refreshSession(): Promise<AuthSessionResponse> {
  // 저장된 refresh token이 있으면 바디로 전달(쿠키 못 쓰는 환경). 쿠키 환경에선 서버가 쿠키를 우선 사용.
  const refreshToken = getRefreshToken()
  const session = await apiClient<AuthSessionResponse>('/auth/refresh', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : undefined,
  })
  setAuthTokens(session.accessToken, session.refreshToken)
  return session
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
