<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { LogoutButton } from '@/features/auth/logout'
import { useSessionStore } from '@/features/auth/session'

type WorkspaceNavItem = {
  routeName: string
  label: string
  detail: string
}

const route = useRoute()
const sessionStore = useSessionStore()

const groupId = computed(() => String(route.params.groupId ?? ''))
const shortGroupId = computed(() => groupId.value.slice(-8).toUpperCase())

const navItems: WorkspaceNavItem[] = [
  {
    routeName: 'group-overview',
    label: '홈',
    detail: '그룹 흐름',
  },
  {
    routeName: 'group-onboarding',
    label: '온보딩',
    detail: '준비도',
  },
  {
    routeName: 'group-curriculum',
    label: '커리큘럼',
    detail: '학습 계획',
  },
  {
    routeName: 'group-todo',
    label: 'Todo',
    detail: '이번 주',
  },
  {
    routeName: 'group-retrospective',
    label: '회고',
    detail: '피드백',
  },
  {
    routeName: 'group-ai',
    label: 'AI 팀장',
    detail: '대화',
  },
  {
    routeName: 'group-notifications',
    label: '알림',
    detail: '활동',
  },
  {
    routeName: 'group-rules',
    label: '규칙',
    detail: '운영',
  },
]
</script>

<template>
  <main class="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <header
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <RouterLink
              :to="{ name: 'groups' }"
              class="inline-flex h-9 items-center rounded-md border border-[var(--color-line)] bg-white px-3 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
            >
              그룹 목록
            </RouterLink>
            <div class="mt-4">
              <p class="text-sm font-semibold text-[var(--color-primary)]">StudyPot</p>
              <h1 class="mt-1 text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
                그룹 워크스페이스
              </h1>
              <p class="mt-2 break-all text-sm text-[var(--color-muted)]">
                {{ shortGroupId || groupId }}
              </p>
            </div>
          </div>

          <div
            v-if="sessionStore.user"
            class="grid gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-sm"
          >
            <div>
              <p class="font-semibold text-[var(--color-ink)]">{{ sessionStore.user.nickname }}</p>
              <p class="mt-1 text-[var(--color-muted)]">{{ sessionStore.user.email }}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div class="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          class="rounded-lg border border-[var(--color-line)] bg-white/85 p-3 shadow-[var(--shadow-soft)]"
        >
          <nav class="grid gap-1" aria-label="그룹 기능">
            <RouterLink
              v-for="item in navItems"
              :key="item.routeName"
              :to="{ name: item.routeName, params: { groupId } }"
              class="grid min-h-14 rounded-md px-3 py-2 text-sm transition hover:bg-[var(--color-card)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
              active-class="bg-[var(--color-card)] text-[var(--color-primary-deep)]"
            >
              <span class="font-semibold">{{ item.label }}</span>
              <span class="text-xs text-[var(--color-muted)]">{{ item.detail }}</span>
            </RouterLink>
          </nav>
        </aside>

        <section class="min-w-0">
          <RouterView />
        </section>
      </div>
    </div>
  </main>
</template>

