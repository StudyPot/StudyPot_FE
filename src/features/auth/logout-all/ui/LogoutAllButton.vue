<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { ApiError } from '@/shared/api'

const router = useRouter()
const sessionStore = useSessionStore()

const isLoggingOut = ref(false)
const errorMessage = ref('')

async function logoutEverySession(): Promise<void> {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  errorMessage.value = ''

  try {
    await sessionStore.logoutEverySession()
    await router.replace({
      name: 'login',
      query: {
        signedOut: 'all',
      },
    })
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : '모든 기기에서 로그아웃하지 못했습니다. 다시 시도해주세요.'
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="grid gap-2">
    <button
      type="button"
      class="inline-flex h-10 items-center justify-center rounded-md border border-[rgba(237,66,69,0.3)] bg-[rgba(237,66,69,0.12)] px-4 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(237,66,69,0.2)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="isLoggingOut"
      @click="logoutEverySession"
    >
      {{ isLoggingOut ? '전체 로그아웃 중' : '모든 기기 로그아웃' }}
    </button>
    <p v-if="errorMessage" role="alert" class="text-xs leading-5 text-red-700">
      {{ errorMessage }}
    </p>
  </div>
</template>

