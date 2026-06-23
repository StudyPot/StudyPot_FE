<script setup lang="ts" generic="T extends string">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: T
  options: readonly { value: T; label: string }[]
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const isOpen = ref(false)
const rootRef = ref<HTMLDivElement | null>(null)

const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
)

function toggle(): void {
  isOpen.value = !isOpen.value
}

function select(value: T): void {
  emit('update:modelValue', value)
  isOpen.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') isOpen.value = false
}

function onClickOutside(e: MouseEvent): void {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      class="flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-panel)] pl-3 pr-2.5 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
      @click="toggle"
    >
      {{ selectedLabel }}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        class="shrink-0 text-[var(--color-muted)] transition-transform duration-150"
        :class="{ 'rotate-180': isOpen }"
      >
        <path
          d="M2 4l4 4 4-4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <ul
      v-if="isOpen"
      role="listbox"
      class="absolute right-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-md border border-[var(--color-line-strong)] bg-[var(--color-panel)] shadow-[var(--shadow-strong)]"
    >
      <li
        v-for="opt in options"
        :key="opt.value"
        role="option"
        :aria-selected="modelValue === opt.value"
        class="cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-semibold transition-colors"
        :class="
          modelValue === opt.value
            ? 'bg-[var(--color-active)] text-[var(--color-ink)]'
            : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
        "
        @click="select(opt.value)"
      >
        {{ opt.label }}
      </li>
    </ul>
  </div>
</template>
