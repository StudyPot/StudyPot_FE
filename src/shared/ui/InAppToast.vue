<script setup lang="ts">
import { useInAppNotificationStore } from '@/features/notification/model/inAppNotificationStore'

const store = useInAppNotificationStore()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        tag="div"
        class="flex flex-col gap-2"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-8"
      >
        <div
          v-for="toast in store.toasts"
          :key="toast.id"
          class="flex w-80 items-start gap-3 rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 shadow-lg"
          role="alert"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm text-white">
            🔔
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-[var(--color-ink)]">{{ toast.title }}</p>
            <p class="mt-0.5 text-xs leading-5 text-[var(--color-muted)]">{{ toast.body }}</p>
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
