<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

type QuickLink = {
  routeName: string
  title: string
  caption: string
}

const route = useRoute()
const groupId = computed(() => String(route.params.groupId ?? ''))

const quickLinks: QuickLink[] = [
  {
    routeName: 'group-onboarding',
    title: '온보딩',
    caption: '스터디 준비 정보를 정리합니다.',
  },
  {
    routeName: 'group-curriculum',
    title: '커리큘럼',
    caption: '전체 학습 계획을 확인합니다.',
  },
  {
    routeName: 'group-todo',
    title: 'Todo',
    caption: '이번 주 과제를 관리합니다.',
  },
  {
    routeName: 'group-retrospective',
    title: '회고',
    caption: '주차별 피드백을 확인합니다.',
  },
  {
    routeName: 'group-ai',
    title: 'AI 팀장',
    caption: '학습 흐름을 함께 점검합니다.',
  },
  {
    routeName: 'group-notifications',
    title: '알림',
    caption: '그룹 활동 소식을 확인합니다.',
  },
  {
    routeName: 'group-rules',
    title: '규칙',
    caption: '운영 규칙과 위반 내역을 관리합니다.',
  },
]
</script>

<template>
  <div class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]">
    <div class="flex flex-col gap-2 border-b border-[var(--color-line)] pb-5">
      <p class="text-sm font-semibold text-[var(--color-primary)]">그룹 홈</p>
      <h2 class="text-2xl font-bold text-[var(--color-ink)]">다음 작업</h2>
    </div>

    <div class="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-3">
      <RouterLink
        v-for="link in quickLinks"
        :key="link.routeName"
        :to="{ name: link.routeName, params: { groupId } }"
        class="rounded-lg border border-[var(--color-line)] bg-white p-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-card)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
      >
        <span class="text-base font-bold text-[var(--color-ink)]">{{ link.title }}</span>
        <span class="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
          {{ link.caption }}
        </span>
      </RouterLink>
    </div>
  </div>
</template>

