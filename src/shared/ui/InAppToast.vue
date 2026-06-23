<script setup lang="ts">
import { useInAppNotificationStore } from '@/features/notification/model/inAppNotificationStore'
import type { ToastVariant } from '@/features/notification/model/inAppNotificationStore'

const store = useInAppNotificationStore()

// 변형별 아이콘 색(표면은 흰 카드로 통일, 좌측 점/아이콘만 색으로 구분)
const accent: Record<ToastVariant, string> = {
  success: 'var(--color-success)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  error: 'var(--color-danger)',
}

const icon: Record<ToastVariant, string> = {
  success: '✓',
  info: '🔔',
  warning: '!',
  error: '✕',
}

function variantOf(v: ToastVariant | undefined): ToastVariant {
  return v ?? 'info'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        tag="div"
        class="flex flex-col items-center gap-2"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div
          v-for="toast in store.toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-80 max-w-full items-start gap-3 rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-strong)]"
          role="alert"
        >
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            :style="{ backgroundColor: accent[variantOf(toast.variant)] }"
          >
            {{ icon[variantOf(toast.variant)] }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-[var(--color-ink)]">{{ toast.title }}</p>
            <p v-if="toast.body" class="mt-0.5 text-xs leading-5 text-[var(--color-muted)]">
              {{ toast.body }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] focus:outline-none"
            aria-label="닫기"
            @click="store.dismissToast(toast.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
