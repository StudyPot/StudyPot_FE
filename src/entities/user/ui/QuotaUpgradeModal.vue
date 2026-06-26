<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  plan: string
  limit: number
  current: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isPremium = computed(() => props.plan.toUpperCase() === 'PREMIUM')
const planLabel = computed(() => (isPremium.value ? '프리미엄' : '무료'))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-7 shadow-[var(--shadow-strong)]"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(25,195,125,0.12)] text-2xl"
          aria-hidden="true"
        >
          🚀
        </div>
        <h2 id="quota-modal-title" class="mt-4 text-xl font-bold text-[var(--color-ink)]">
          스터디 개수 한도에 도달했어요
        </h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          현재 <strong class="font-semibold text-[var(--color-ink)]">{{ planLabel }}</strong> 플랜은
          동시에 운영 중인 스터디를 최대
          <strong class="font-semibold text-[var(--color-ink)]">{{ limit }}개</strong>까지 만들 수
          있어요. 지금 {{ current }}개를 운영 중이에요.
        </p>

        <div
          class="mt-4 rounded-[var(--radius-input)] border border-[var(--color-line)] bg-[var(--color-active)] px-4 py-3 text-xs leading-5 text-[var(--color-muted)]"
        >
          <p>완료했거나 보관한 스터디는 개수에 포함되지 않아요.</p>
          <p class="mt-1">
            <template v-if="isPremium"
              >기존 스터디를 마무리하면 새 스터디를 만들 수 있어요.</template
            >
            <template v-else
              >기존 스터디를 마무리하거나 프리미엄으로 전환하면 더 많은 스터디를 운영할 수 있어요.
              프리미엄 전환은 운영자에게 문의해 주세요.</template
            >
          </p>
        </div>

        <button
          type="button"
          class="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)]"
          @click="emit('close')"
        >
          확인
        </button>
      </div>
    </div>
  </Teleport>
</template>
