// 인증 토큰을 localStorage에 보관한다.
// 쿠키를 못 쓰는 환경(아이폰 사파리/시크릿/크로스도메인)에서도 로그인 세션이 유지되도록
// Authorization 헤더 방식으로 동작하기 위함이다. (쿠키도 병행되며, 쿠키가 막힌 환경에선 이 토큰이 사용됨)

const ACCESS_TOKEN_KEY = 'studypot_access_token'
const REFRESH_TOKEN_KEY = 'studypot_refresh_token'

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthTokens(accessToken?: string | null, refreshToken?: string | null): void {
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  } catch {
    // 저장 실패(프라이빗 모드 등) 시 쿠키 폴백에 의존
  }
}

export function clearAuthTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // noop
  }
}
