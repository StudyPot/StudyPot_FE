<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const hourListRef = ref<HTMLElement | null>(null)
const minuteListRef = ref<HTMLElement | null>(null)

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

const parsed = computed(() => {
  const [h = 0, m = 0] = (props.modelValue ?? '00:00').split(':').map(Number)
  const isPm = h >= 12
  const hour12 = h % 12 || 12
  return { isPm, hour12, minute: m }
})

const displayValue = computed(() => {
  const { isPm, hour12, minute } = parsed.value
  return `${isPm ? '오후' : '오전'} ${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
})

function emit24h(isPm: boolean, hour12: number, minute: number): void {
  let h = hour12 % 12
  if (isPm) h += 12
  emit('update:modelValue', `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
}

function setAmPm(isPm: boolean): void {
  emit24h(isPm, parsed.value.hour12, parsed.value.minute)
}

function setHour(h: number): void {
  emit24h(parsed.value.isPm, h, parsed.value.minute)
}

function setMinute(m: number): void {
  emit24h(parsed.value.isPm, parsed.value.hour12, m)
}

function scrollToSelected(): void {
  const ITEM_H = 40
  if (hourListRef.value) {
    hourListRef.value.scrollTop = (parsed.value.hour12 - 1) * ITEM_H - ITEM_H
  }
  if (minuteListRef.value) {
    minuteListRef.value.scrollTop = parsed.value.minute * ITEM_H - ITEM_H
  }
}

function open(): void {
  isOpen.value = true
  // DOM이 렌더된 후 스크롤 이동
  setTimeout(scrollToSelected, 0)
}

function handleOutsideClick(e: MouseEvent): void {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleOutsideClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleOutsideClick))
</script>

<template>
  <div ref="rootRef" class="relative inline-block w-full">
    <button
      type="button"
      class="flex h-10 w-full items-center gap-1 rounded border border-[var(--color-line-strong)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-ink)] transition focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.25)] sm:h-9"
      @click="isOpen ? (isOpen = false) : open()"
    >
      <svg class="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      {{ displayValue }}
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 z-50 mt-1 flex max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-card)] shadow-[var(--shadow-strong)]"
    >
      <!-- AM/PM -->
      <div class="flex w-16 flex-col border-r border-[var(--color-line)]">
        <button
          v-for="(label, idx) in ['오전', '오후']"
          :key="idx"
          type="button"
          class="flex h-10 items-center justify-center text-sm font-medium transition"
          :class="
            (idx === 0 ? !parsed.isPm : parsed.isPm)
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
          "
          @click="setAmPm(idx === 1)"
        >
          {{ label }}
        </button>
      </div>

      <!-- Hours -->
      <div ref="hourListRef" class="flex w-16 flex-col overflow-y-auto border-r border-[var(--color-line)]" style="max-height: 12rem; scroll-behavior: smooth">
        <button
          v-for="h in HOURS"
          :key="h"
          type="button"
          class="flex h-10 shrink-0 items-center justify-center text-sm transition"
          :class="
            parsed.hour12 === h
              ? 'bg-[var(--color-primary)] font-semibold text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
          "
          @click="setHour(h)"
        >
          {{ String(h).padStart(2, '0') }}
        </button>
      </div>

      <!-- Minutes -->
      <div ref="minuteListRef" class="flex w-16 flex-col overflow-y-auto" style="max-height: 12rem; scroll-behavior: smooth">
        <button
          v-for="m in MINUTES"
          :key="m"
          type="button"
          class="flex h-10 shrink-0 items-center justify-center text-sm transition"
          :class="
            parsed.minute === m
              ? 'bg-[var(--color-primary)] font-semibold text-white'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
          "
          @click="setMinute(m)"
        >
          {{ String(m).padStart(2, '0') }}
        </button>
      </div>
    </div>
  </div>
</template>
