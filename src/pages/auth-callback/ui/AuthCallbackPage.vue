<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const errorMessage = ref('')

onMounted(async () => {
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
