<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { ApiError } from '@/shared/api'

const router = useRouter()
const sessionStore = useSessionStore()

const isLoggingOut = ref(false)
const errorMessage = ref('')

async function logoutCurrentSession(): Promise<void> {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  errorMessage.value = ''

  try {
    await sessionStore.logoutCurrentSession()
    await router.replace({
      name: 'login',
      query: {
        signedOut: 'current',
      },
    })
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '로그아웃하지 못했습니다. 다시 시도해주세요.'
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="grid gap-2">
    <button
      type="button"
      class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="isLoggingOut"
      @click="logoutCurrentSession"
    >
      {{ isLoggingOut ? '로그아웃 중' : '로그아웃' }}
    </button>
    <p v-if="errorMessage" role="alert" class="text-xs leading-5 text-red-700">
      {{ errorMessage }}
    </p>
  </div>
</template>

