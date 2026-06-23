<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  min?: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const _today = new Date()
const todayStr = toDateStr(_today)

const viewYear = ref(_today.getFullYear())
const viewMonth = ref(_today.getMonth())

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const displayValue = computed(() => {
  if (!props.modelValue) return '날짜 선택'
  const d = new Date(props.modelValue + 'T00:00:00')
  if (isNaN(d.getTime())) return '날짜 선택'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
})

const calendarDays = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Array<{ dateStr: string } | null> = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    })
  }
  return cells
})

function isDisabled(dateStr: string): boolean {
  return !!props.min && dateStr < props.min
}

function prevMonth(): void {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth(): void {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function selectDay(dateStr: string): void {
  if (isDisabled(dateStr)) return
  emit('update:modelValue', dateStr)
  isOpen.value = false
}

function open(): void {
  if (props.modelValue) {
    const d = new Date(props.modelValue + 'T00:00:00')
    if (!isNaN(d.getTime())) {
      viewYear.value = d.getFullYear()
      viewMonth.value = d.getMonth()
    }
  } else {
    viewYear.value = _today.getFullYear()
    viewMonth.value = _today.getMonth()
  }
  isOpen.value = true
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
      class="flex h-11 w-full items-center gap-2 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-input)] px-3 text-sm transition focus:outline-none focus:ring-4 focus:ring-[rgba(88,101,242,0.12)]"
      :class="modelValue ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'"
      @click="isOpen ? (isOpen = false) : open()"
    >
      <svg class="h-4 w-4 shrink-0 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      {{ displayValue }}
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-card)] shadow-[var(--shadow-strong)]"
    >
      <!-- 헤더: 년/월 + 이전/다음 -->
      <div class="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
          @click="prevMonth"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span class="text-sm font-semibold text-[var(--color-ink)]">
          {{ viewYear }}년 {{ MONTH_NAMES[viewMonth] }}
        </span>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
          @click="nextMonth"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <!-- 요일 헤더 -->
      <div class="grid grid-cols-7 px-2 pt-2">
        <span
          v-for="day in DAY_LABELS"
          :key="day"
          class="flex h-8 items-center justify-center text-xs font-semibold"
          :class="day === '일' ? 'text-[var(--color-danger)]' : day === '토' ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'"
        >
          {{ day }}
        </span>
      </div>

      <!-- 날짜 그리드 -->
      <div class="grid grid-cols-7 gap-y-0.5 px-2 pb-3">
        <template v-for="(cell, i) in calendarDays" :key="i">
          <div v-if="!cell" />
          <button
            v-else
            type="button"
            class="flex h-8 w-full items-center justify-center rounded-md text-sm transition"
            :class="[
              cell.dateStr === modelValue
                ? 'bg-[var(--color-primary)] font-semibold text-white'
                : cell.dateStr === todayStr
                  ? 'border border-[var(--color-primary)] font-semibold text-[var(--color-primary)]'
                  : isDisabled(cell.dateStr)
                    ? 'cursor-not-allowed text-[var(--color-muted-deep)] opacity-40'
                    : 'text-[var(--color-ink)] hover:bg-[var(--color-hover)]',
            ]"
            :disabled="isDisabled(cell.dateStr)"
            @click="selectDay(cell.dateStr)"
          >
            {{ Number(cell.dateStr.split('-')[2]) }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
