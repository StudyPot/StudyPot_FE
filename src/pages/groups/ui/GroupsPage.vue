<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { listGroups, type StudyGroup, type StudyGroupStatus } from '@/entities/group'
import { LogoutButton } from '@/features/auth/logout'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

const groups = ref<StudyGroup[]>([])
const isLoading = ref(true)
const errorMessage = ref('')

const hasGroups = computed(() => groups.value.length > 0)

onMounted(() => {
  void loadGroups()
})

async function loadGroups(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    groups.value = await listGroups()
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹 목록을 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

function getStatusLabel(status: StudyGroupStatus): string {
  const statusLabels: Record<StudyGroupStatus, string> = {
    DRAFT: '준비 중',
    ONBOARDING: '온보딩',
    ACTIVE: '진행 중',
    COMPLETED: '완료',
    ARCHIVED: '보관됨',
  }

  return statusLabels[status]
}

function getPrimaryRouteName(status: StudyGroupStatus): string {
  const routeNames: Record<StudyGroupStatus, string> = {
    DRAFT: 'group-overview',
    ONBOARDING: 'group-onboarding',
    ACTIVE: 'group-todo',
    COMPLETED: 'group-retrospective',
    ARCHIVED: 'group-overview',
  }

  return routeNames[status]
}

function getPrimaryActionLabel(status: StudyGroupStatus): string {
  const labels: Record<StudyGroupStatus, string> = {
    DRAFT: '그룹 홈',
    ONBOARDING: '온보딩',
    ACTIVE: '이번 주 Todo',
    COMPLETED: '회고',
    ARCHIVED: '그룹 홈',
  }

  return labels[status]
}

function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-6xl px-6 py-10">
    <header
      class="flex flex-col gap-4 border-b border-[var(--color-line)] pb-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm font-semibold text-[var(--color-primary)]">StudyPot</p>
        <h1 class="mt-2 text-3xl font-bold text-[var(--color-ink)]">스터디 그룹</h1>
        <p class="mt-2 text-sm text-[var(--color-muted)]">
          참여 중인 스터디를 확인하고 다음 학습 흐름으로 이동하세요.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
          @click="loadGroups"
        >
          새로고침
        </button>
        <LogoutButton />
      </div>
    </header>

    <ScreenState
      v-if="isLoading"
      class="mt-8"
      variant="loading"
      title="그룹을 불러오는 중입니다."
      description="참여 중인 스터디 그룹과 다음 이동 경로를 확인하고 있습니다."
    />

    <ScreenState
      v-else-if="errorMessage"
      class="mt-8"
      variant="error"
      title="목록을 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadGroups"
    />

    <ScreenState
      v-else-if="!hasGroups"
      class="mt-8"
      variant="empty"
      title="아직 참여 중인 그룹이 없습니다."
      description="그룹 생성과 초대 코드 참여가 연결되면 이곳에서 바로 시작할 수 있습니다."
    />

    <section v-else class="grid gap-4 py-8 sm:grid-cols-2">
      <RouterLink
        v-for="group in groups"
        :key="group.id"
        :to="{ name: getPrimaryRouteName(group.status), params: { groupId: group.id } }"
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)] hover:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
      >
        <article>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-[var(--color-primary)]">{{ group.topic }}</p>
              <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">{{ group.name }}</h2>
            </div>
            <span
              class="shrink-0 rounded-full bg-[var(--color-card)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-deep)]"
            >
              {{ getStatusLabel(group.status) }}
            </span>
          </div>

          <dl class="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-[var(--color-muted)]">기간</dt>
              <dd class="mt-1 font-semibold text-[var(--color-ink)]">
                {{ formatDateRange(group.startsAt, group.endsAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-[var(--color-muted)]">정원</dt>
              <dd class="mt-1 font-semibold text-[var(--color-ink)]">{{ group.maxMembers }}명</dd>
            </div>
          </dl>

          <div class="mt-5 flex flex-wrap gap-2">
            <span
              v-for="keyword in group.detailKeywords"
              :key="keyword"
              class="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
            >
              {{ keyword }}
            </span>
          </div>

          <div class="mt-5 flex items-center justify-between gap-3">
            <p class="break-all text-xs text-[var(--color-muted)]">초대 코드 {{ group.inviteCode }}</p>
            <span class="text-sm font-semibold text-[var(--color-primary)]">
              {{ getPrimaryActionLabel(group.status) }}
            </span>
          </div>
        </article>
      </RouterLink>
    </section>
  </main>
</template>
