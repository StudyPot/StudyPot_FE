<script setup lang="ts">

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import { useRouter } from 'vue-router'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend)

import {
  deleteGroup,
  getGroupOverviewPrimaryEntry,
  getGroupStatusLabel,
  type GroupEntryAction,
  type StudyGroup,
} from '@/entities/group'
import { getGroupMembersActivity, startStudy, type MemberActivityRow } from '@/entities/curriculum'
import { getMyOnboarding } from '@/entities/onboarding'
import { useSessionStore } from '@/features/auth/session'
import { useGroupListStore } from '@/entities/group'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'
import GroupEditModal from './GroupEditModal.vue'

type QuickLink = {
  routeName: string
  title: string
  caption: string
}

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupOverviewPage must be used inside GroupWorkspacePage.')
}

const { groupId, group, isGroupLoading, groupErrorMessage, reloadGroup, reloadMembers, members } =
  workspaceContext

const isReadyToStart = computed(() => group.value?.status === 'READY_TO_START')

const canStartStudy = computed(() => {
  if (!group.value) return false
  const active = members.value.filter((m) => m.status !== 'LEFT')
  const allSubmitted = active.every((m) => m.onboardingStatus === 'SUBMITTED')
  const isFull = active.length >= group.value.maxMembers
  return allSubmitted && isFull
})
const router = useRouter()
const copyStatusMessage = ref('')
const onboardingSubmitted = ref(false)
const isStartingStudy = ref(false)
const startStudyError = ref('')
const showStartModal = ref(false)
const startProgress = ref(0)

const showEditModal = ref(false)
const showDeleteDialog = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')

const sessionStore = useSessionStore()
const groupListStore = useGroupListStore()

const isOwner = computed(() => {
  const myUserId = sessionStore.user?.id
  if (!myUserId) {
    return false
  }
  return members.value.some(
    (member) => member.userId === myUserId && member.permission === 'OWNER',
  )
})

function handleGroupUpdated(updated: StudyGroup): void {
  group.value = updated
  showEditModal.value = false
}

async function handleDeleteGroup(): Promise<void> {
  deleteError.value = ''
  isDeleting.value = true
  try {
    await deleteGroup(groupId.value)
    groupListStore.removeGroup(groupId.value)
    await router.replace({ name: 'groups' })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        deleteError.value = '그룹을 찾을 수 없어요. 이미 삭제되었을 수 있어요.'
      } else {
        deleteError.value = error.message
      }
    } else {
      deleteError.value = '그룹 삭제에 실패했어요. 다시 시도해 주세요.'
    }
  } finally {
    isDeleting.value = false
  }
}

let progressTimer: ReturnType<typeof setInterval> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

function startProgressAnimation(): void {
  startProgress.value = 0
  progressTimer = setInterval(() => {
    startProgress.value = Math.min(startProgress.value + 10, 99)
  }, 3000)
  timeoutTimer = setTimeout(() => {
    clearProgressTimers()
    startProgress.value = 99
  }, 30000)
}

function clearProgressTimers(): void {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
  if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null }
}

onUnmounted(() => { clearProgressTimers() })

// 워크스페이스(부모)는 온보딩↔개요 이동 시 재마운트되지 않아 members가 stale 해진다.
// 개요가 보일 때마다 멤버 목록만 다시 불러 온보딩 현황(본인 포함)이 최신으로 표시되게 한다.
onMounted(() => { void reloadMembers?.() })

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

const onboardingProgress = computed(() => {
  if (!group.value) return null
  const active = members.value.filter((m) => m.status !== 'LEFT')
  const submitted = active.filter((m) => m.onboardingStatus === 'SUBMITTED').length
  // 분모는 정원(maxMembers) 기준으로 표시한다. (가입 인원이 아닌 그룹 정원)
  const total = group.value.maxMembers
  return { submitted, total }
})

const activityRows = ref<MemberActivityRow[]>([])

watch(
  () => group.value?.status,
  (status) => {
    if (status === 'ACTIVE') void loadGroupActivity()
    else activityRows.value = []
  },
  { immediate: true },
)

async function loadGroupActivity(): Promise<void> {
  try {
    activityRows.value = await getGroupMembersActivity(groupId.value)
  } catch {
    activityRows.value = []
  }
}

const activityDays = computed(() => {
  const dates = new Set<string>()
  for (const row of activityRows.value) {
    for (const d of row.dailyActivity) dates.add(d.date)
  }
  return Array.from(dates).sort().slice(-14)
})

const MEMBER_COLORS = [
  { border: 'rgba(180,190,254,1)',  background: 'rgba(180,190,254,0.15)' },
  { border: 'rgba(252,165,165,1)',  background: 'rgba(252,165,165,0.15)' },
  { border: 'rgba(110,231,183,1)',  background: 'rgba(110,231,183,0.15)' },
  { border: 'rgba(253,213,130,1)',  background: 'rgba(253,213,130,0.15)' },
  { border: 'rgba(216,180,254,1)',  background: 'rgba(216,180,254,0.15)' },
  { border: 'rgba(147,223,200,1)',  background: 'rgba(147,223,200,0.15)' },
]

const chartRef = ref<{ chart: ChartJS } | null>(null)
const hiddenDatasets = ref<boolean[]>([])

watch(
  () => activityRows.value,
  (rows) => { hiddenDatasets.value = rows.map(() => false) },
  { immediate: true },
)

function toggleDataset(index: number): void {
  const chart = chartRef.value?.chart
  if (!chart) return
  const meta = chart.getDatasetMeta(index)
  meta.hidden = !meta.hidden
  hiddenDatasets.value = hiddenDatasets.value.map((h, i) => (i === index ? !h : h))
  chart.update()
}

const combinedChartData = computed(() => ({
  labels: activityDays.value.map((d) => {
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }),
  datasets: activityRows.value.map((row, i) => {
    const color = MEMBER_COLORS[i % MEMBER_COLORS.length]!
    return {
      label: row.memberNickname,
      data: activityDays.value.map((day) => row.dailyActivity.find((d) => d.date === day)?.count ?? 0),
      borderColor: color.border,
      backgroundColor: color.background,
      fill: true,
      tension: 0.4,
      borderWidth: 1.5,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: color.border,
      pointBorderWidth: 1.5,
      pointRadius: 3,
      pointHoverRadius: 5,
    }
  }),
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
          ` ${ctx.dataset.label ?? ''}: ${ctx.parsed.y ?? 0}건`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: 'rgba(148,155,164,0.8)', font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1, color: 'rgba(148,155,164,0.8)', font: { size: 11 } },
      grid: { color: 'rgba(148,155,164,0.08)' },
    },
  },
}

const quickLinks: QuickLink[] = [
  { routeName: 'group-todo', title: '커리큘럼 · Todo', caption: '주차별 커리큘럼과 이번 주 과제를 관리합니다.' },
  { routeName: 'group-ai', title: 'AI 팀장', caption: '학습 흐름을 함께 점검합니다.' },
  { routeName: 'group-board', title: '게시판', caption: '공지와 토론을 나눕니다.' },
  { routeName: 'group-review', title: '스터디 회고', caption: '이번 스터디를 돌아보며 별점과 소감을 남겨보세요.' },
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
  showStartModal.value = true
  startProgressAnimation()

  try {
    await startStudy(groupId.value)
    clearProgressTimers()
    startProgress.value = 100
    // 시작 직후 공유 group 상태와 좌측 사이드바 그룹 목록을 함께 갱신해
    // 새로고침 없이 상태 태그/점이 ACTIVE(초록)로 바뀌도록 한다.
    await Promise.all([reloadGroup(), groupListStore.loadGroups()])
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
    showStartModal.value = false
    await router.push({ name: 'group-todo', params: { groupId: groupId.value } })
  } catch (error) {
    clearProgressTimers()
    showStartModal.value = false
    startStudyError.value = error instanceof ApiError ? error.message : '스터디 시작에 실패했습니다.'
  } finally {
    isStartingStudy.value = false
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
      <!-- 스터디 시작하기 배너 -->
      <section
        v-if="isReadyToStart && isOwner && canStartStudy"
        class="rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-bold text-[var(--color-primary)]">🎉 모든 멤버가 온보딩을 완료했습니다!</p>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              이제 스터디를 시작할 수 있습니다. AI가 커리큘럼을 생성합니다.
            </p>
            <p v-if="startStudyError" role="alert" class="mt-2 text-sm font-semibold text-[var(--color-danger)]">
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

      <section
        v-else-if="isReadyToStart && !isOwner && canStartStudy"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-bold text-[var(--color-primary)]">🎉 모든 멤버가 온보딩을 완료했습니다!</p>
        <p class="mt-1 text-sm text-[var(--color-muted)]">
          관리자가 스터디를 시작하면 커리큘럼이 생성됩니다. 잠시만 기다려 주세요.
        </p>
      </section>

      <!-- 온보딩 진행 현황 -->
      <section
        v-else-if="group.status === 'ONBOARDING' && onboardingProgress"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
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
                ? 'bg-[rgba(35,165,90,0.2)] text-[var(--color-success)]'
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
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-[var(--color-primary)]">그룹 홈</p>
            <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">{{ group.name }}</h2>
            <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              {{ primaryEntry.summary }}
            </p>
          </div>

          <!-- 오너 전용 관리 버튼 -->
          <div v-if="isOwner" class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
              @click="showEditModal = true"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              편집
            </button>
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1.5 rounded-md border border-[rgba(237,66,69,0.4)] bg-[rgba(237,66,69,0.06)] px-3 text-xs font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(237,66,69,0.12)] focus:outline-none focus:ring-4 focus:ring-[rgba(237,66,69,0.14)]"
              @click="showDeleteDialog = true"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              삭제
            </button>
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
            class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
            @click="copyInviteCode"
          >
            초대 코드 복사
          </button>
          <span v-if="copyStatusMessage" role="status" class="text-xs font-semibold text-[var(--color-primary-deep)]">
            {{ copyStatusMessage }}
          </span>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <span
            v-for="keyword in group.detailKeywords"
            :key="keyword"
            class="rounded-md border border-[var(--color-line)] bg-[var(--color-active)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
          >
            {{ keyword }}
          </span>
        </div>
      </section>

      <!-- 활동 대시보드 -->
      <section
        v-if="group.status === 'ACTIVE' && activityRows.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-semibold text-[var(--color-primary)]">활동 현황</p>
            <h3 class="mt-1 text-base font-bold text-[var(--color-ink)]">팀원별 일별 학습 활동</h3>
          </div>

          <!-- 커스텀 범례 (우측 상단, 리스트 형식) -->
          <div class="flex flex-col gap-2">
            <p class="text-[10px] font-bold text-[var(--color-muted)]">그래프 활성화</p>
            <button
              v-for="(row, i) in activityRows"
              :key="row.memberNickname"
              type="button"
              class="flex cursor-pointer items-center gap-2 transition-transform duration-150 hover:scale-105"
              @click="toggleDataset(i)"
            >
              <span
                class="inline-block h-3 w-3 shrink-0 rounded-full border-[1.5px] transition-colors duration-150"
                :style="{
                  borderColor: MEMBER_COLORS[i % MEMBER_COLORS.length]!.border,
                  backgroundColor: hiddenDatasets[i] ? 'transparent' : MEMBER_COLORS[i % MEMBER_COLORS.length]!.border,
                }"
              />
              <span
                class="text-xs font-semibold transition-opacity duration-150"
                :style="{ color: MEMBER_COLORS[i % MEMBER_COLORS.length]!.border }"
                :class="{ 'opacity-40': hiddenDatasets[i] }"
              >{{ row.memberNickname }}</span>
            </button>
          </div>
        </div>

        <div class="mt-3 h-96">
          <Line ref="chartRef" :data="combinedChartData" :options="chartOptions" />
        </div>
      </section>

      <!-- 퀵 링크 -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="그룹 내부 기능">
        <RouterLink
          v-for="link in quickLinks"
          :key="link.routeName"
          :to="{ name: link.routeName, params: { groupId } }"
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-card)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
        >
          <span class="text-base font-bold text-[var(--color-ink)]">{{ link.title }}</span>
          <span class="mt-2 block text-sm leading-6 text-[var(--color-muted)]">{{ link.caption }}</span>
        </RouterLink>
      </section>
    </template>
  </div>

  <!-- 그룹 편집 모달 -->
  <Teleport to="body">
    <GroupEditModal
      v-if="showEditModal && group"
      :group="group"
      @close="showEditModal = false"
      @updated="handleGroupUpdated"
    />
  </Teleport>

  <!-- 그룹 삭제 확인 다이얼로그 -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDeleteDialog"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showDeleteDialog = false" />
        <div class="relative w-full max-w-sm rounded-xl bg-[var(--color-card)] p-6 shadow-2xl">
          <div class="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(237,66,69,0.12)] text-[var(--color-danger)]">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 id="delete-dialog-title" class="mt-4 text-lg font-bold text-[var(--color-ink)]">
            그룹을 삭제하시겠습니까?
          </h2>
          <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            이 작업은 되돌릴 수 없습니다. 그룹과 관련된 모든 데이터가 영구적으로 삭제됩니다.
          </p>

          <p
            v-if="deleteError"
            role="alert"
            class="mt-3 rounded-lg border border-[rgba(237,66,69,0.3)] bg-[rgba(237,66,69,0.08)] px-3 py-2.5 text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ deleteError }}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              type="button"
              class="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
              :disabled="isDeleting"
              @click="showDeleteDialog = false"
            >
              취소
            </button>
            <button
              type="button"
              class="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-danger)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isDeleting"
              @click="handleDeleteGroup"
            >
              {{ isDeleting ? '삭제 중…' : '삭제' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 스터디 시작 프로그레스 모달 -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showStartModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-modal-title"
      >
        <!-- 배경 오버레이 -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <!-- 모달 카드 -->
        <div class="relative w-full max-w-sm rounded-2xl bg-[var(--color-card)] p-8 shadow-2xl text-center mx-4">
          <div class="orbit-spinner mx-auto mb-5" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="orbit-arm" :style="`--i: ${i - 1}`">
              <div class="orbit-dot" />
            </div>
          </div>

          <h2 id="start-modal-title" class="text-xl font-bold text-[var(--color-ink)]">
            스터디 생성 중
          </h2>
          <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            AI가 커리큘럼을 만들고 있어요.<br>잠시만 기다려 주세요.
          </p>

          <!-- 프로그레스 바 -->
          <div class="mt-7">
            <div class="mb-2 flex items-center justify-between text-xs font-semibold">
              <span class="text-[var(--color-muted)]">진행률</span>
              <span class="text-[var(--color-primary-deep)]">{{ startProgress }}%</span>
            </div>
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-card)]">
              <div
                class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700 ease-out"
                :style="{ width: `${startProgress}%` }"
              />
            </div>
          </div>

          <p
            v-if="startProgress >= 99 && startProgress < 100"
            class="mt-0 text-xs text-[var(--color-muted)]"
          >
          </p>
          <p
            v-else-if="startProgress === 100"
            class="mt-4 text-xs font-semibold text-[var(--color-primary)]"
          >
            완료! 이동합니다...
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.orbit-spinner {
  position: relative;
  width: 64px;
  height: 64px;
}

.orbit-arm {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 0;
  transform-origin: 0 50%;
  animation: orbit 1.4s linear infinite;
  animation-delay: calc(var(--i) * -0.233s);
}

.orbit-dot {
  position: absolute;
  right: -5px;
  top: -5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-primary);
  opacity: calc(0.2 + var(--i) * 0.16);
}

@keyframes orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
