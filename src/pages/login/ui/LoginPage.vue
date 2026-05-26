<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { apiOrigin } from '@/shared/config/api'

const route = useRoute()

const noticeMessage = computed(() => {
  if (route.query.error === 'oauth') {
    return 'Google 로그인에 실패했습니다. 다시 시도해주세요.'
  }

  if (route.query.signedOut === 'all') {
    return '모든 기기에서 로그아웃되었습니다.'
  }

  if (route.query.signedOut === 'current') {
    return '로그아웃되었습니다.'
  }

  return ''
})

function startGoogleLogin(): void {
  window.location.assign(`${apiOrigin}/api/oauth2/authorization/google`)
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-6 py-10">
    <section class="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-white p-6">
      <p
        v-if="noticeMessage"
        role="status"
        class="mb-4 rounded-md border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm font-semibold text-[var(--color-primary-deep)]"
      >
        {{ noticeMessage }}
      </p>

      <p class="text-base font-semibold text-[var(--color-ink)]">Google 계정으로 로그인</p>
      <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        스터디 그룹과 AI 커리큘럼을 사용하려면 Google 계정으로 시작하세요.
      </p>

      <button
        type="button"
        class="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-md bg-[var(--color-primary)] px-5 py-4 text-base font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
        @click="startGoogleLogin"
      >
        <svg
          aria-hidden="true"
          class="h-5 w-5"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21.64 12.2045C21.64 11.5668 21.5827 10.9536 21.4764 10.3636H12V14.2577H17.4145C17.1814 15.5159 16.4723 16.5818 15.4064 17.2927V19.8182H18.6618C20.5673 18.0636 21.64 15.4773 21.64 12.2045Z"
            fill="#4285F4"
          />
          <path
            d="M12 22C14.72 22 17.0018 21.0982 18.6618 19.8182L15.4064 17.2927C14.5045 17.8982 13.3509 18.2577 12 18.2577C9.37636 18.2577 7.15273 16.4855 6.36 14.1027H2.99455V16.7109C4.64545 19.9891 8.03818 22 12 22Z"
            fill="#34A853"
          />
          <path
            d="M6.36 14.1027C6.15818 13.4973 6.04364 12.8509 6.04364 12.1818C6.04364 11.5127 6.15818 10.8664 6.36 10.2609V7.65273H2.99455C2.31545 9.00545 1.93091 10.5291 1.93091 12.1818C1.93091 13.8345 2.31545 15.3582 2.99455 16.7109L6.36 14.1027Z"
            fill="#FBBC05"
          />
          <path
            d="M12 6.10545C13.4745 6.10545 14.7982 6.61273 15.84 7.60909L18.7355 4.71364C16.9973 3.06091 14.7155 2 12 2C8.03818 2 4.64545 4.01091 2.99455 7.28909L6.36 9.89727C7.15273 7.51455 9.37636 5.74227 12 5.74227V6.10545Z"
            fill="#EA4335"
          />
        </svg>
        Google로 시작하기
      </button>
    </section>
  </main>
</template>

