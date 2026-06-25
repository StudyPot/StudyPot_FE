<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { setAuthTokens } from '@/shared/api'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const errorMessage = ref('')

// OAuth 성공 시 백엔드가 토큰을 URL fragment(#access_token=...&refresh_token=...)로 전달한다.
// 쿠키가 막힌 환경(모바일/시크릿/크로스도메인)을 위해 이를 저장하고 fragment는 즉시 제거한다.
function captureTokensFromFragment(): void {
  const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : ''
  if (!hash) return
  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken || refreshToken) {
    setAuthTokens(accessToken, refreshToken)
    // 주소창/히스토리에서 토큰 노출 제거
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}

onMounted(async () => {
  captureTokensFromFragment()
  const user = await sessionStore.restoreSession()

  if (!user) {
    errorMessage.value = '로그인 세션을 확인하지 못했습니다.'
    await router.replace({ name: 'login' })
    return
  }

  const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/groups'

  await router.replace(redirectPath)
})
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-6">
    <p class="text-base font-semibold text-[var(--color-ink)]">
      {{ errorMessage || '로그인 세션 확인 중' }}
    </p>
  </main>
</template>
