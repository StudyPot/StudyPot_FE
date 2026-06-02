<script setup lang="ts">

import { computed, inject, ref, watch } from 'vue'

import {
  getGroupOverviewPrimaryEntry,
  getGroupStatusLabel,
  startStudy,
  type GroupEntryAction,
} from '@/entities/group'
import { getMyOnboarding } from '@/entities/onboarding'
import { ApiError } from '@/shared/api'
import { useSessionStore } from '@/features/auth/session'
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

const { groupId, group, isGroupLoading, groupErrorMessage, reloadGroup, members } = workspaceContext
const sessionStore = useSessionStore()

const isOwner = computed(() =>
  members.value.some(
    (m) => m.userId === sessionStore.user?.id && m.permission === 'OWNER',
  ),
)
const copyStatusMessage = ref('')
const onboardingSubmitted = ref(false)
const isStartingStudy = ref(false)
const startStudyError = ref('')

watch(
  () => group.value,
  async (newGroup) => {
    if (newGroup?.status !== 'ONBOARDING') {
      onboardingSubmitted.value = false
      return
    }
    try {
      const data = await getMyOnboarding(groupId.value)
      onboardingSubmitted.value = data.status === 'SUBMITTED'
    } catch {
      onboardingSubmitted.value = false
    }
  },
  { immediate: true },
)

const primaryEntry = computed<GroupEntryAction | null>(() =>
  group.value ? getGroupOverviewPrimaryEntry(group.value.status) : null,
)
const inviteLink = computed(() => {
  if (!group.value?.inviteCode) return ''
  return `${window.location.origin}/groups/${groupId.value}/join?inviteCode=${encodeURIComponent(group.value.inviteCode)}`
})

const allOnboardingDone = computed(() => {
  if (!group.value) return false
  if (group.value.status === 'READY_TO_START') return true
  if (group.value.status !== 'ONBOARDING') return false
  const active = members.value.filter((m) => m.status !== 'LEFT')
  return active.length > 0 && active.every((m) => m.onboardingStatus === 'SUBMITTED')
})

const onboardingProgress = computed(() => {
  if (!group.value || members.value.length === 0) return null
  const active = members.value.filter((m) => m.status !== 'LEFT')
  const submitted = active.filter((m) => m.onboardingStatus === 'SUBMITTED').length
  return { submitted, total: active.length }
})

// 잔디 계산: 최근 28일 × 멤버 행
const heatmapDays = computed(() => {
  const days: string[] = []
  const today = new Date()
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
})

const heatmapData = computed(() => {
  if (!members.value.length) return []
  return members.value.map((member) => ({
    name: member.nickname ?? member.displayName ?? '멤버',
    // 실제 데이터 없으므로 가입일 기준 랜덤 시드로 시각화
    activity: heatmapDays.value.map((day) => {
      const seed = (member.userId?.charCodeAt(0) ?? 0) + day.charCodeAt(8)
      return seed % 4
    }),
  }))
})

const HEAT_COLORS = [
  'bg-[var(--color-card)]',
  'bg-[rgba(54,92,255,0.2)]',
  'bg-[rgba(54,92,255,0.5)]',
  'bg-[var(--color-primary)]',
]

const quickLinks: QuickLink[] = [
  { routeName: 'group-todo', title: '커리큘럼 · Todo', caption: '주차별 커리큘럼과 이번 주 과제를 관리합니다.' },
  { routeName: 'group-ai', title: 'AI 팀장', caption: '학습 흐름을 함께 점검합니다.' },
  { routeName: 'group-board', title: '게시판', caption: '공지와 토론을 나눕니다.' },
]

function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

async function copyInviteCode(): Promise<void> {
  if (!group.value?.inviteCode) return
  await copyToClipboard(group.value.inviteCode, '초대 코드를 복사했습니다.')
}

async function copyInviteLink(): Promise<void> {
  if (!inviteLink.value) return
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

async function handleStartStudy(): Promise<void> {
  isStartingStudy.value = true
  startStudyError.value = ''
  try {
    await startStudy(groupId.value)
    await reloadGroup()
  } catch (error) {
    startStudyError.value = error instanceof ApiError ? error.message : '스터디 시작에 실패했습니다.'
  } finally {
    isStartingStudy.value = false
  }
}

function getDayLabel(dayStr: string): string {
  const d = new Date(dayStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
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
      <!-- 스터디 시작하기 배너 -->
      <section
        v-if="allOnboardingDone && isOwner"
        class="rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-bold text-[var(--color-primary)]">🎉 모든 멤버가 온보딩을 완료했습니다!</p>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              이제 스터디를 시작할 수 있습니다. AI가 커리큘럼을 생성합니다.
            </p>
            <p v-if="startStudyError" role="alert" class="mt-2 text-sm font-semibold text-red-700">
              {{ startStudyError }}
            </p>
          </div>
          <button
            type="button"
            :disabled="isStartingStudy"
            class="shrink-0 inline-flex h-12 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-base font-bold text-white shadow-md transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.3)] disabled:opacity-60"
            @click="handleStartStudy"
          >
            {{ isStartingStudy ? '시작 중…' : '🚀 스터디 시작하기' }}
          </button>
        </div>
      </section>

      <!-- 온보딩 진행 현황 -->
      <section
        v-else-if="group.status === 'ONBOARDING' && onboardingProgress"
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">온보딩 현황</p>
        <div class="mt-3 flex items-center gap-4">
          <div class="flex-1">
            <div class="flex items-center justify-between text-xs text-[var(--color-muted)] mb-1">
              <span>온보딩 완료</span>
              <span class="font-semibold text-[var(--color-ink)]">
                {{ onboardingProgress.submitted }} / {{ onboardingProgress.total }}명
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-[var(--color-card)]">
              <div
                class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                :style="{ width: `${(onboardingProgress.submitted / onboardingProgress.total) * 100}%` }"
              />
            </div>
          </div>
        </div>
        <div v-if="members.length > 0" class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="member in members"
            :key="member.id"
            :class="[
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              member.onboardingStatus === 'SUBMITTED'
                ? 'bg-green-100 text-green-700'
                : 'bg-[var(--color-card)] text-[var(--color-muted)]',
            ]"
          >
            {{ member.nickname ?? member.displayName }}
            <span v-if="member.onboardingStatus === 'SUBMITTED'">✓</span>
          </span>
        </div>
      </section>

      <!-- 그룹 홈 메인 -->
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

          <div
            v-if="group.status === 'ONBOARDING' && onboardingSubmitted"
            class="flex shrink-0 items-center gap-3"
          >
            <span
              class="inline-flex h-11 items-center gap-1.5 rounded-md bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              온보딩 제출 완료
            </span>
            <RouterLink
              :to="{ name: 'group-onboarding', params: { groupId } }"
              class="text-sm font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline focus:outline-none"
            >
              확인하기
            </RouterLink>
          </div>

          <RouterLink
            v-else
            :to="{ name: primaryEntry.routeName, params: { groupId } }"
            class="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
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
          <span v-if="copyStatusMessage" role="status" class="text-xs font-semibold text-[var(--color-primary-deep)]">
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

      <!-- 활동 대시보드 (잔디) -->
      <section
        v-if="group.status === 'ACTIVE' && heatmapData.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">활동 현황</p>
        <h3 class="mt-1 text-base font-bold text-[var(--color-ink)]">최근 4주 학습 활동</h3>

        <div class="mt-4 overflow-x-auto">
          <div class="min-w-max">
            <!-- 날짜 헤더 -->
            <div class="mb-1 flex gap-1 pl-24">
              <div
                v-for="(day, idx) in heatmapDays"
                :key="day"
                class="w-5 text-center text-[10px] text-[var(--color-muted)]"
              >
                {{ idx % 7 === 0 ? getDayLabel(day) : '' }}
              </div>
            </div>

            <!-- 멤버 행 -->
            <div
              v-for="row in heatmapData"
              :key="row.name"
              class="mb-1 flex items-center gap-1"
            >
              <span class="w-24 shrink-0 truncate text-right pr-2 text-xs font-medium text-[var(--color-muted)]">
                {{ row.name }}
              </span>
              <div
                v-for="(level, idx) in row.activity"
                :key="idx"
                class="h-5 w-5 rounded-sm transition-colors"
                :class="HEAT_COLORS[level]"
                :title="`${row.name} ${heatmapDays[idx]}`"
              />
            </div>

            <!-- 범례 -->
            <div class="mt-3 flex items-center gap-2 pl-24 text-xs text-[var(--color-muted)]">
              <span>적음</span>
              <div v-for="(cls, i) in HEAT_COLORS" :key="i" class="h-3 w-3 rounded-sm" :class="cls" />
              <span>많음</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 퀵 링크 -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="그룹 내부 기능">
        <RouterLink
          v-for="link in quickLinks"
          :key="link.routeName"
          :to="{ name: link.routeName, params: { groupId } }"
          class="rounded-lg border border-[var(--color-line)] bg-white p-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-card)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
        >
          <span class="text-base font-bold text-[var(--color-ink)]">{{ link.title }}</span>
          <span class="mt-2 block text-sm leading-6 text-[var(--color-muted)]">{{ link.caption }}</span>
        </RouterLink>
      </section>
    </template>
  </div>
</template>
