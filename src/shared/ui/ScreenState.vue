<script setup lang="ts">
import { computed } from 'vue'

type ScreenStateVariant = 'loading' | 'empty' | 'error' | 'forbidden'

const props = defineProps<{
  variant: ScreenStateVariant
  title: string
  description?: string
  eyebrow?: string
  actionLabel?: string
}>()

const emit = defineEmits<{
  action: []
}>()

const defaultEyebrows: Record<ScreenStateVariant, string> = {
  loading: '로딩',
  empty: '빈 상태',
  error: '오류',
  forbidden: '권한 없음',
}

const toneClasses: Record<ScreenStateVariant, string> = {
  loading: 'border-[rgba(25,195,125,0.22)] bg-[var(--color-card)]',
  empty: 'border-[var(--color-line)] bg-[var(--color-card)]',
  error: 'border-[rgba(237,66,69,0.25)] bg-[rgba(237,66,69,0.1)]',
  forbidden: 'border-[rgba(250,166,26,0.25)] bg-[rgba(250,166,26,0.1)]',
}

const markerClasses: Record<ScreenStateVariant, string> = {
  loading: 'border-[var(--color-primary)] border-t-transparent',
  empty: 'border-[var(--color-line)] bg-[var(--color-active)]',
  error: 'border-[var(--color-danger)] bg-[rgba(237,66,69,0.2)]',
  forbidden: 'border-[rgba(250,166,26,0.5)] bg-[rgba(250,166,26,0.15)]',
}

const eyebrowText = computed(() => props.eyebrow ?? defaultEyebrows[props.variant])
const role = computed(() => (props.variant === 'error' ? 'alert' : 'status'))
const isLoading = computed(() => props.variant === 'loading')
</script>

<template>
  <section
    :class="[
      'rounded-lg border p-6 text-center shadow-[var(--shadow-soft)]',
      toneClasses[variant],
    ]"
    :role="role"
    :aria-busy="isLoading"
  >
    <div
      :class="[
        'mx-auto h-10 w-10 rounded-full border-2',
        markerClasses[variant],
        isLoading ? 'animate-spin' : '',
      ]"
      aria-hidden="true"
    />

    <p class="mt-4 text-sm font-semibold text-[var(--color-primary)]">{{ eyebrowText }}</p>
    <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">{{ title }}</h2>
    <p v-if="description" class="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-muted)]">
      {{ description }}
    </p>

    <div v-if="actionLabel || $slots.actions" class="mt-6 flex flex-wrap justify-center gap-3">
      <button
        v-if="actionLabel"
        type="button"
        class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)]"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
      <slot name="actions" />
    </div>
  </section>
</template>
