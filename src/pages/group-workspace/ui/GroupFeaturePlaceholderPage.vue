<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const title = computed(() => String(route.meta.workspaceTitle ?? '그룹 기능'))
const summary = computed(() => String(route.meta.workspaceSummary ?? '준비 중입니다.'))
</script>

<template>
  <div class="rounded-lg border border-[var(--color-line)] bg-white/85 p-6 shadow-[var(--shadow-soft)]">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold text-[var(--color-primary)]">그룹 기능</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">{{ title }}</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">{{ summary }}</p>
    </div>

    <div class="mt-8 rounded-lg border border-dashed border-[var(--color-line)] bg-white/70 p-8">
      <p class="text-base font-semibold text-[var(--color-ink)]">준비 중</p>
      <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        이 경로는 그룹 내부 화면 흐름에 포함되어 있습니다.
      </p>
    </div>
  </div>
</template>

