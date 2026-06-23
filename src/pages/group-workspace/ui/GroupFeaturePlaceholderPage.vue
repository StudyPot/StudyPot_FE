<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { ScreenState } from '@/shared/ui'

const route = useRoute()

const groupId = computed(() => String(route.params.groupId ?? ''))
const title = computed(() => String(route.meta.workspaceTitle ?? '그룹 기능'))
const summary = computed(() => String(route.meta.workspaceSummary ?? '준비 중입니다.'))
</script>

<template>
  <ScreenState variant="empty" eyebrow="그룹 기능" :title="title" :description="summary">
    <template #actions>
      <RouterLink
        :to="{ name: 'group-overview', params: { groupId } }"
        class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25, 195, 125,0.16)]"
      >
        그룹 홈
      </RouterLink>
    </template>
  </ScreenState>
</template>
