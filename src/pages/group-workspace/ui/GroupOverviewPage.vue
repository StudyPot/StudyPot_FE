<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import {
  getGroupOverviewPrimaryEntry,
  getGroupStatusLabel,
  type GroupEntryAction,
} from '@/entities/group'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

type QuickLink = {
  routeName: string
  title: string
  caption: string
}

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupOverviewPage must be used inside GroupWorkspacePage.')
}

const { groupId, group, isGroupLoading, groupErrorMessage, reloadGroup } = workspaceContext
const copyStatusMessage = ref('')
const primaryEntry = computed<GroupEntryAction | null>(() =>
  group.value ? getGroupOverviewPrimaryEntry(group.value.status) : null,
)
const inviteLink = computed(() => {
  if (!group.value?.inviteCode) {
    return ''
  }

  return `${window.location.origin}/groups/${groupId.value}/join?inviteCode=${encodeURIComponent(
    group.value.inviteCode,
  )}`
})

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

function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

async function copyInviteCode(): Promise<void> {
  if (!group.value?.inviteCode) {
    return
  }

  await copyToClipboard(group.value.inviteCode, '초대 코드를 복사했습니다.')
}

async function copyInviteLink(): Promise<void> {
  if (!inviteLink.value) {
    return
  }

  await copyToClipboard(inviteLink.value, '초대 링크를 복사했습니다.')
}

async function copyToClipboard(value: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    copyStatusMessage.value = successMessage
  } catch {
    copyStatusMessage.value = '복사하지 못했습니다.'
  }
}
</script>

<template>
  <div class="grid gap-5">
    <ScreenState
      v-if="isGroupLoading"
      variant="loading"
      title="그룹 홈을 준비하는 중입니다."
      description="그룹 상태와 다음 작업을 확인하고 있습니다."
    />

    <ScreenState
      v-else-if="groupErrorMessage"
      variant="error"
      title="그룹 홈을 불러오지 못했습니다."
      :description="groupErrorMessage"
      action-label="다시 시도"
      @action="reloadGroup"
    />

    <template v-else-if="group && primaryEntry">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-[var(--color-primary)]">그룹 홈</p>
            <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">{{ group.name }}</h2>
            <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              {{ primaryEntry.summary }}
            </p>
          </div>

          <RouterLink
            :to="{ name: primaryEntry.routeName, params: { groupId } }"
            class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
          >
            {{ primaryEntry.label }}
          </RouterLink>
        </div>

        <dl class="mt-6 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt class="text-[var(--color-muted)]">상태</dt>
            <dd class="mt-1 font-semibold text-[var(--color-ink)]">
              {{ getGroupStatusLabel(group.status) }}
            </dd>
          </div>
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
          <div>
            <dt class="text-[var(--color-muted)]">초대 코드</dt>
            <dd class="mt-1 font-semibold text-[var(--color-ink)]">{{ group.inviteCode }}</dd>
          </div>
        </dl>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
            @click="copyInviteCode"
          >
            코드 복사
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
            @click="copyInviteLink"
          >
            링크 복사
          </button>
          <span
            v-if="copyStatusMessage"
            role="status"
            class="text-xs font-semibold text-[var(--color-primary-deep)]"
          >
            {{ copyStatusMessage }}
          </span>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <span
            v-for="keyword in group.detailKeywords"
            :key="keyword"
            class="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
          >
            {{ keyword }}
          </span>
        </div>
      </section>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="그룹 내부 기능">
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
      </section>
    </template>
  </div>
</template>
