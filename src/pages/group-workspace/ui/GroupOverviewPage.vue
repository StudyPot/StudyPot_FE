<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  deleteGroup,
  getGroupCategoryColor,
  getGroupStatusLabel,
  getStudyRecommendations,
  type StudyAiSuggestion,
  type StudyGroup,
  type StudyPopularTopic,
} from '@/entities/group'
import {
  getGroupMembersActivity,
  getRecentActivity,
  startStudy,
  type MemberActivityRow,
  type RecentActivityItem,
} from '@/entities/curriculum'
import { useSessionStore } from '@/features/auth/session'
import { useInAppNotificationStore } from '@/features/notification'
import { useGroupListStore } from '@/entities/group'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'
import GroupEditModal from './GroupEditModal.vue'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupOverviewPage must be used inside GroupWorkspacePage.')

const { groupId, group, isGroupLoading, groupErrorMessage, reloadGroup, reloadMembers, members } =
  workspaceContext

const router = useRouter()
const sessionStore = useSessionStore()
const groupListStore = useGroupListStore()
const toastStore = useInAppNotificationStore()

const isActive = computed(() => group.value?.status === 'ACTIVE')
const isCompleted = computed(
  () => group.value?.status === 'COMPLETED' || group.value?.status === 'ARCHIVED',
)

const aiSuggestions = ref<StudyAiSuggestion[]>([])
const popularTopics = ref<StudyPopularTopic[]>([])
const recommendationsLoaded = ref(false)
const hasRecommendations = computed(
  () => aiSuggestions.value.length > 0 || popularTopics.value.length > 0,
)

async function loadRecommendations(): Promise<void> {
  if (recommendationsLoaded.value) return
  recommendationsLoaded.value = true
  try {
    const res = await getStudyRecommendations(groupId.value)
    aiSuggestions.value = res.aiSuggestions ?? []
    popularTopics.value = res.popularTopics ?? []
  } catch {
    // 추천은 부가 정보라 실패해도 화면을 막지 않는다.
    aiSuggestions.value = []
    popularTopics.value = []
  }
}

function startStudyWithTopic(topic: string): void {
  void router.push({ name: 'group-create', query: { topic } })
}

const myUserId = computed(() => sessionStore.user?.id ?? null)
const myMemberId = computed(
  () => members.value.find((m) => m.userId === myUserId.value)?.id ?? null,
)
const isOwner = computed(() =>
  members.value.some((m) => m.userId === myUserId.value && m.permission === 'OWNER'),
)

const activeMembers = computed(() => members.value.filter((m) => m.status !== 'LEFT'))

// ── 시작 전: 온보딩 현황 ─────────────────────────────────────────
const onboardingDone = computed(
  () => activeMembers.value.filter((m) => m.onboardingStatus === 'SUBMITTED').length,
)
// 정원과 실제 멤버 수 중 큰 값(데이터 불일치 시 음수 방지)
const onboardingTotal = computed(() =>
  Math.max(group.value?.maxMembers ?? 0, activeMembers.value.length),
)
const onboardingWaiting = computed(() => Math.max(0, onboardingTotal.value - onboardingDone.value))
const onboardingPct = computed(() =>
  onboardingTotal.value > 0 ? Math.round((onboardingDone.value / onboardingTotal.value) * 100) : 0,
)
const canStartStudy = computed(
  () =>
    activeMembers.value.length > 0 &&
    activeMembers.value.length >= (group.value?.maxMembers ?? 0) &&
    activeMembers.value.every((m) => m.onboardingStatus === 'SUBMITTED'),
)

// ── 활성: 활동 데이터 ────────────────────────────────────────────
const activityRows = ref<MemberActivityRow[]>([])
// 진행률은 BE가 계산한 group.progressPercent를 단일 출처로 사용(메인 그룹 목록과 일치, FE 재계산 제거).
const curriculumPct = computed(() =>
  Math.max(0, Math.min(100, Math.round(group.value?.progressPercent ?? 0))),
)
const barView = ref<'team' | 'me'>('team')

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
function shiftIso(iso: string, delta: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}
function countMapFor(memberId: string): Map<string, number> {
  const row = activityRows.value.find((r) => r.memberId === memberId)
  const map = new Map<string, number>()
  if (row) for (const d of row.dailyActivity) map.set(d.date, d.count)
  return map
}
function rangeCount(memberId: string, startOffset: number, len: number): number {
  const map = countMapFor(memberId)
  const today = todayIso()
  let sum = 0
  for (let i = 0; i < len; i += 1) sum += map.get(shiftIso(today, -(startOffset + i))) ?? 0
  return sum
}
function memberWeekCount(memberId: string): number {
  return rangeCount(memberId, 0, 7)
}
function memberActiveDays(memberId: string): number {
  const map = countMapFor(memberId)
  const today = todayIso()
  let days = 0
  for (let i = 0; i < 7; i += 1) if ((map.get(shiftIso(today, -i)) ?? 0) > 0) days += 1
  return days
}

const weeklyTotal = computed(() =>
  activityRows.value.reduce((s, r) => s + memberWeekCount(r.memberId), 0),
)
const lastWeekTotal = computed(() =>
  activityRows.value.reduce((s, r) => s + rangeCount(r.memberId, 7, 7), 0),
)
const weekDelta = computed(() => weeklyTotal.value - lastWeekTotal.value)

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']
function weekdayLabel(iso?: string): string {
  if (!iso) return ''
  return WEEKDAY_KO[new Date(iso).getDay()] ?? ''
}
// 최근 7일(today-6 … today) — 주중에도 항상 채워지도록 롤링 윈도우 사용
const weekDates = computed(() =>
  Array.from({ length: 7 }, (_, i) => shiftIso(todayIso(), -(6 - i))),
)
// 누적막대용 일자별 TODO/게시글 분리 집계 (todoCount/postCount 없으면 count로 폴백).
function dayRows(scope: 'team' | 'me'): MemberActivityRow[] {
  if (scope === 'team') return activityRows.value
  return activityRows.value.filter((r) => r.memberId === myMemberId.value)
}
function dayTodoOn(date: string, scope: 'team' | 'me'): number {
  return dayRows(scope).reduce((s, r) => {
    const d = r.dailyActivity.find((x) => x.date === date)
    return s + (d?.todoCount ?? d?.count ?? 0)
  }, 0)
}
function dayPostOn(date: string, scope: 'team' | 'me'): number {
  return dayRows(scope).reduce((s, r) => {
    const d = r.dailyActivity.find((x) => x.date === date)
    return s + (d?.postCount ?? 0)
  }, 0)
}
type BarPart = { todo: number; post: number; total: number }
const barParts = computed<BarPart[]>(() =>
  weekDates.value.map((d) => {
    const todo = dayTodoOn(d, barView.value)
    const post = dayPostOn(d, barView.value)
    return { todo, post, total: todo + post }
  }),
)
// Y축 천장은 항상 '팀 전체' max로 고정 → '나'로 토글하면 팀 대비 비율만큼 막대가 줄어 보인다.
const barScale = computed(() =>
  Math.max(1, ...weekDates.value.map((d) => dayTodoOn(d, 'team') + dayPostOn(d, 'team'))),
)
// 현재 뷰에서 가장 높은 막대(강조용)
const maxBar = computed(() => Math.max(1, ...barParts.value.map((p) => p.total)))

type Participation = { memberId: string; nickname: string; pct: number }
const participation = computed<Participation[]>(() => {
  const total = weeklyTotal.value

  const rows = activityRows.value.map((r) => {
    const count = memberWeekCount(r.memberId)
    const exact = total > 0 ? (count / total) * 100 : 0
    return {
      memberId: r.memberId,
      nickname: r.memberNickname,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    }
  })

  if (total > 0) {
    const floorSum = rows.reduce((s, r) => s + r.floor, 0)
    const toDistribute = 100 - floorSum
    rows
      .slice()
      .sort((a, b) => b.remainder - a.remainder)
      .slice(0, toDistribute)
      .forEach((r) => { r.floor += 1 })
  }

  return rows
    .map((r) => ({ memberId: r.memberId, nickname: r.nickname, pct: r.floor }))
    .sort((a, b) => b.pct - a.pct)
})

type Mvp = { memberId: string; nickname: string; count: number; streak: number } | null
const mvp = computed<Mvp>(() => {
  if (activityRows.value.length === 0) return null
  let best = activityRows.value[0]!
  let bestCount = memberWeekCount(best.memberId)
  for (const r of activityRows.value) {
    const c = memberWeekCount(r.memberId)
    if (c > bestCount) {
      best = r
      bestCount = c
    }
  }
  // 연속일: 가장 최근 활동일부터 거꾸로 이어진 일수
  const map = countMapFor(best.memberId)
  let cursor = todayIso()
  if ((map.get(cursor) ?? 0) === 0) cursor = shiftIso(cursor, -1)
  let streak = 0
  while ((map.get(cursor) ?? 0) > 0) {
    streak += 1
    cursor = shiftIso(cursor, -1)
  }
  return { memberId: best.memberId, nickname: best.memberNickname, count: bestCount, streak }
})

type RecentItem = { memberId: string; nickname: string; date: string; taskTitle?: string }
// 활동 피드(BE: 완료한 과제 제목 포함). 미제공 시 활동 데이터로 폴백.
const recentFeed = ref<RecentActivityItem[]>([])
const recentActivity = computed<RecentItem[]>(() => {
  if (recentFeed.value.length > 0) {
    return recentFeed.value.slice(0, 4).map((i) => ({
      memberId: i.memberId,
      nickname: i.memberNickname,
      date: i.completedAt,
      taskTitle: i.taskTitle,
    }))
  }
  const items: RecentItem[] = []
  for (const r of activityRows.value) {
    let latest: string | null = null
    for (const d of r.dailyActivity) {
      if (d.count > 0 && (latest === null || d.date > latest)) latest = d.date
    }
    if (latest) items.push({ memberId: r.memberId, nickname: r.memberNickname, date: latest })
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4)
})

// ── 진행률 링(SVG) ───────────────────────────────────────────────
const RING_R = 40
const RING_C = 2 * Math.PI * RING_R
const ringOffset = computed(() => RING_C * (1 - curriculumPct.value / 100))

// ── 편집 / 삭제 / 시작 모달 ─────────────────────────────────────
const showEditModal = ref(false)
const showDeleteDialog = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')

const showStartModal = ref(false)
const isStartingStudy = ref(false)
const startStudyError = ref('')
const startProgress = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

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
    deleteError.value =
      error instanceof ApiError ? error.message : '그룹 삭제에 실패했어요. 다시 시도해 주세요.'
  } finally {
    isDeleting.value = false
  }
}

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
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (timeoutTimer) {
    clearTimeout(timeoutTimer)
    timeoutTimer = null
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
    await Promise.all([reloadGroup(), groupListStore.loadGroups()])
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
    showStartModal.value = false
    toastStore.pushToast('스터디를 시작했어요', '1주차 커리큘럼이 곧 준비됩니다.', 'success')
    await router.push({ name: 'group-todo', params: { groupId: groupId.value } })
  } catch (error) {
    clearProgressTimers()
    showStartModal.value = false
    startStudyError.value =
      error instanceof ApiError ? error.message : '스터디 시작에 실패했습니다.'
    toastStore.pushToast('스터디 시작 실패', startStudyError.value, 'error')
  } finally {
    isStartingStudy.value = false
  }
}

onMounted(() => {
  void reloadMembers?.()
})

watch(
  () => group.value?.status,
  (status) => {
    if (status === 'ACTIVE') void loadDashboard()
    else activityRows.value = []
    if (status === 'COMPLETED' || status === 'ARCHIVED') void loadRecommendations()
  },
  { immediate: true },
)

async function loadDashboard(): Promise<void> {
  // 진행률(curriculumPct)은 group.progressPercent 기반 computed라 별도 조회 불필요.
  // 활동 데이터(차트) + 최근 활동 피드(완료 과제 제목)를 함께 로드. 피드 미제공 시 폴백.
  const [activity, feed] = await Promise.allSettled([
    getGroupMembersActivity(groupId.value),
    getRecentActivity(groupId.value),
  ])
  activityRows.value = activity.status === 'fulfilled' ? activity.value : []
  recentFeed.value = feed.status === 'fulfilled' ? feed.value : []
}

function formatRelative(date: string): string {
  const today = todayIso()
  if (date === today) return '오늘'
  if (date === shiftIso(today, -1)) return '어제'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(date))
}
</script>

<template>
  <div class="grid gap-4">
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

    <!-- ════════ 활성: 대시보드 ════════ -->
    <template v-else-if="group && isActive">
      <!-- 헤더 -->
      <div class="flex items-center justify-between gap-3">
        <div>
          <p
            v-if="group.startsAt && group.endsAt"
            class="mt-1.5 inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-[var(--color-active)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {{ group.startsAt.replace(/-/g, '.') }} ~ {{ group.endsAt.replace(/-/g, '.') }}
          </p>
          <h1 class="text-2xl font-extrabold text-[var(--color-ink)]">{{ group.name }}</h1>
          <p class="mt-0.5 text-sm text-[var(--color-muted)]">이번 주 학습 현황을 확인하세요.</p>
        </div>
        <div v-if="isOwner" class="flex shrink-0 gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
            @click="showEditModal = true"
          >
            편집
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-button)] border border-[rgba(255,82,71,0.4)] bg-[rgba(255,82,71,0.06)] px-3 text-xs font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(255,82,71,0.12)]"
            @click="showDeleteDialog = true"
          >
            삭제
          </button>
        </div>
      </div>

      <!-- Row1: 통계 카드 3개 -->
      <div class="grid gap-4 sm:grid-cols-3">
        <!-- 이번 주 그룹 활동 -->
        <div
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm text-[var(--color-muted)]">이번 주 그룹 활동</p>
          <p class="mt-1 text-4xl font-extrabold text-[var(--color-ink)]">
            {{ weeklyTotal
            }}<span class="ml-1 text-lg font-bold text-[var(--color-muted)]">회</span>
          </p>
          <span
            class="mt-3 inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-[var(--color-tint-50)] px-2.5 py-1 text-xs font-bold text-[var(--color-primary-text)]"
          >
            <template v-if="weekDelta > 0">▲ {{ weekDelta }} · 지난주 대비</template>
            <template v-else-if="weekDelta < 0">▼ {{ -weekDelta }} · 지난주 대비</template>
            <template v-else>지난주와 동일</template>
          </span>
        </div>

        <!-- 커리큘럼 진행률 -->
        <div
          class="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <svg viewBox="0 0 100 100" class="h-28 w-28 -rotate-90">
            <circle
              cx="50"
              cy="50"
              :r="RING_R"
              fill="none"
              stroke="var(--color-active)"
              stroke-width="10"
            />
            <circle
              cx="50"
              cy="50"
              :r="RING_R"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="10"
              stroke-linecap="round"
              :stroke-dasharray="RING_C"
              :stroke-dashoffset="ringOffset"
              style="transition: stroke-dashoffset 0.6s ease"
            />
            <text
              x="50"
              y="50"
              transform="rotate(90 50 50)"
              text-anchor="middle"
              dominant-baseline="central"
              class="fill-[var(--color-ink)] text-[22px] font-extrabold"
            >
              {{ curriculumPct }}%
            </text>
          </svg>
          <p class="mt-2 text-sm text-[var(--color-muted)]">커리큘럼 진행률</p>
        </div>

        <!-- 이번 주 MVP -->
        <div
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm text-[var(--color-muted)]">이번 주 MVP</p>
          <div v-if="mvp" class="mt-3 flex items-center gap-3">
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              :style="{ backgroundColor: getGroupCategoryColor(mvp.memberId) }"
            >
              {{ mvp.nickname.slice(0, 1).toUpperCase() }}
            </span>
            <div class="min-w-0">
              <p class="truncate font-bold text-[var(--color-ink)]">{{ mvp.nickname }}</p>
              <p class="text-xs text-[var(--color-muted)]">
                활동 {{ mvp.count }}회 · 연속 {{ mvp.streak }}일
              </p>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-[var(--color-muted)]">아직 활동 기록이 없어요.</p>
        </div>
      </div>

      <!-- Row2: 주간 학습 활동 | 멤버별 참여도 -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- 주간 학습 활동 -->
        <section
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)] lg:col-span-2"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-[var(--color-ink)]">주간 학습 활동</h2>
            <div class="flex gap-1 rounded-[var(--radius-chip)] bg-[var(--color-active)] p-0.5">
              <button
                type="button"
                class="rounded-[var(--radius-chip)] px-3 py-1 text-xs font-bold transition"
                :class="
                  barView === 'team'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-muted)]'
                "
                @click="barView = 'team'"
              >
                팀 전체
              </button>
              <button
                type="button"
                class="rounded-[var(--radius-chip)] px-3 py-1 text-xs font-bold transition"
                :class="
                  barView === 'me'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-muted)]'
                "
                @click="barView = 'me'"
              >
                나
              </button>
            </div>
          </div>

          <div class="mt-5 flex h-44 items-stretch justify-between gap-2">
            <div
              v-for="(part, i) in barParts"
              :key="i"
              class="group flex flex-1 flex-col items-center gap-2"
            >
              <div class="relative flex w-full flex-1 items-end justify-center">
                <!-- hover 시 막대 위 개수 라벨 (TODO·게시글 분리) -->
                <span
                  class="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-chip)] bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  :style="{ bottom: `calc(${Math.max(6, (part.total / barScale) * 100)}% + 4px)` }"
                  >TODO {{ part.todo }} · 글 {{ part.post }}</span
                >
                <!-- 누적막대: TODO(진한 그린) 위에 게시글(블루) 쌓기 -->
                <div
                  class="flex w-full max-w-[44px] flex-col-reverse overflow-hidden rounded-t-lg transition-all duration-500"
                  :style="{ height: `${Math.max(6, (part.total / barScale) * 100)}%` }"
                >
                  <div
                    class="w-full bg-[var(--color-primary)]"
                    :style="{ flexBasis: part.total > 0 ? `${(part.todo / part.total) * 100}%` : '100%' }"
                  />
                  <div
                    class="w-full bg-[var(--color-info)]"
                    :style="{ flexBasis: part.total > 0 ? `${(part.post / part.total) * 100}%` : '0%' }"
                  />
                </div>
              </div>
              <span
                class="text-xs"
                :class="
                  part.total === maxBar && part.total > 0
                    ? 'font-bold text-[var(--color-ink)]'
                    : 'text-[var(--color-muted)]'
                "
              >
                {{ weekdayLabel(weekDates[i]) }}
              </span>
            </div>
          </div>
        </section>

        <!-- 멤버별 참여도 -->
        <section
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 class="text-base font-bold text-[var(--color-ink)]">멤버별 참여도</h2>
          <ul class="mt-4 grid gap-3.5">
            <li v-for="p in participation" :key="p.memberId" class="flex items-center gap-2.5">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                :style="{ backgroundColor: getGroupCategoryColor(p.memberId) }"
              >
                {{ p.nickname.slice(0, 1).toUpperCase() }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between">
                  <span class="truncate text-sm font-semibold text-[var(--color-ink)]">{{
                    p.nickname
                  }}</span>
                  <span class="text-xs font-bold text-[var(--color-ink)]">{{ p.pct }}%</span>
                </div>
                <div
                  class="mt-1 h-1.5 w-full overflow-hidden rounded-[var(--radius-chip)] bg-[var(--color-active)]"
                >
                  <div
                    class="h-full rounded-[var(--radius-chip)] bg-[var(--color-primary)]"
                    :style="{ width: `${p.pct}%` }"
                  />
                </div>
              </div>
            </li>
            <li v-if="participation.length === 0" class="text-sm text-[var(--color-muted)]">
              아직 참여 기록이 없어요.
            </li>
          </ul>
        </section>
      </div>

      <!-- Row3: 최근 활동 | 바로가기 + CTA -->
      <div class="grid gap-4 lg:grid-cols-3">
        <section
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)] lg:col-span-2"
        >
          <h2 class="text-base font-bold text-[var(--color-ink)]">최근 활동</h2>
          <ul v-if="recentActivity.length" class="mt-4 grid gap-1">
            <li
              v-for="item in recentActivity"
              :key="item.memberId"
              class="flex items-center gap-3 py-2"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                :style="{ backgroundColor: getGroupCategoryColor(item.memberId) }"
              >
                {{ item.nickname.slice(0, 1).toUpperCase() }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-[var(--color-ink)]">
                  <template v-if="item.taskTitle">
                    {{ item.nickname }}님이 «{{ item.taskTitle }}» 완료
                  </template>
                  <template v-else>{{ item.nickname }}님이 학습했어요</template>
                </p>
                <p class="text-xs text-[var(--color-muted)]">{{ formatRelative(item.date) }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-[var(--color-muted)]">아직 표시할 활동이 없어요.</p>
        </section>

        <div class="grid content-start gap-4">
          <RouterLink
            :to="{ name: 'group-todo', params: { groupId } }"
            class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]"
          >
            <p class="font-bold text-[var(--color-ink)]">커리큘럼 · Todo</p>
            <p class="mt-1 text-sm text-[var(--color-muted)]">주차별 과제를 확인하고 체크하세요.</p>
          </RouterLink>
          <RouterLink
            :to="{ name: 'group-ai', params: { groupId } }"
            class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]"
          >
            <p class="font-bold text-[var(--color-ink)]">AI 팀장</p>
            <p class="mt-1 text-sm text-[var(--color-muted)]">학습 흐름을 점검하기</p>
          </RouterLink>
          <RouterLink
            :to="{ name: 'group-todo', params: { groupId } }"
            class="flex h-14 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-primary)] text-sm font-bold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--color-primary-deep)]"
          >
            오늘 할 일 하러 가기
          </RouterLink>
        </div>
      </div>
    </template>

    <!-- ════════ 완료: 수료 화면 ════════ -->
    <template v-else-if="group && isCompleted">
      <section
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-6 text-center shadow-[var(--shadow-soft)]"
      >
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
          aria-hidden="true"
        >
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 class="mt-4 text-2xl font-extrabold text-[var(--color-ink)]">스터디를 완주했어요 🎉</h1>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          <b class="text-[var(--color-ink)]">{{ group.name }}</b> 스터디가 마무리됐어요. 그동안의 회고와 팀장 리포트를 돌아보세요.
        </p>
        <p v-if="group.startsAt && group.endsAt" class="mt-1 text-xs text-[var(--color-muted)]">
          {{ group.startsAt }} ~ {{ group.endsAt }}
        </p>
        <div class="mx-auto mt-6 grid max-w-md gap-2">
          <RouterLink
            :to="{ name: 'group-retrospective', params: { groupId } }"
            class="flex h-12 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] text-sm font-bold text-white transition hover:bg-[var(--color-primary-deep)]"
          >
            회고 돌아보기
          </RouterLink>
          <RouterLink
            :to="{ name: 'group-board', params: { groupId } }"
            class="flex h-12 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)]"
          >
            팀장 리포트 보기
          </RouterLink>
          <RouterLink
            :to="{ name: 'group-curriculum', params: { groupId } }"
            class="flex h-12 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)]"
          >
            커리큘럼 다시 보기
          </RouterLink>
        </div>
      </section>

      <!-- 다음 스터디 추천 -->
      <section
        v-if="hasRecommendations"
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 class="text-lg font-extrabold text-[var(--color-ink)]">다음 스터디는 어때요?</h2>
        <p class="mt-1 text-sm text-[var(--color-muted)]">
          추천을 누르면 주제가 채워진 채로 새 스터디 만들기 화면으로 이동해요.
        </p>

        <div v-if="aiSuggestions.length" class="mt-5">
          <p class="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">AI 맞춤 추천</p>
          <ul class="mt-2 grid gap-2">
            <li v-for="(s, i) in aiSuggestions" :key="`ai-${i}`">
              <button
                type="button"
                class="group flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-bg)]"
                @click="startStudyWithTopic(s.title)"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-bold text-[var(--color-ink)]">{{ s.title }}</span>
                  <span v-if="s.reason" class="mt-0.5 block text-xs leading-5 text-[var(--color-muted)]">{{ s.reason }}</span>
                </span>
                <span class="shrink-0 text-xs font-bold text-[var(--color-primary)] group-hover:underline">만들기 →</span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="popularTopics.length" class="mt-5">
          <p class="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">다른 그룹 인기 주제</p>
          <ul class="mt-2 grid gap-2">
            <li v-for="(t, i) in popularTopics" :key="`pop-${i}`">
              <button
                type="button"
                class="group flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-bg)]"
                @click="startStudyWithTopic(t.topic)"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-bold text-[var(--color-ink)]">{{ t.topic }}</span>
                  <span class="mt-0.5 block truncate text-xs text-[var(--color-muted)]">{{ t.groupName }} · 멤버 {{ t.memberCount }}명</span>
                </span>
                <span class="shrink-0 text-xs font-bold text-[var(--color-primary)] group-hover:underline">만들기 →</span>
              </button>
            </li>
          </ul>
        </div>
      </section>
    </template>

    <!-- ════════ 시작 전: 온보딩 준비 ════════ -->
    <template v-else-if="group">
      <!-- 헤더 카드 -->
      <section
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <span
              class="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-[rgba(255,176,32,0.15)] px-2.5 py-1 text-xs font-bold text-[#9a6a00]"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
              {{ getGroupStatusLabel(group.status) }}
            </span>
            <h1 class="mt-3 text-2xl font-extrabold text-[var(--color-ink)]">
              스터디 시작 준비 중이에요
            </h1>
            <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              멤버들이 온보딩(목표·가능한 시간·숙련도)을 작성하고 있어요. 모두 완료되면 방장이
              스터디를 시작하고, AI가 첫 주 커리큘럼을 만들어요.
            </p>
          </div>
          <button
            v-if="isOwner"
            type="button"
            :disabled="!canStartStudy || isStartingStudy"
            class="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-5 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--color-primary-deep)] disabled:cursor-not-allowed disabled:opacity-40"
            @click="handleStartStudy"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            스터디 시작하기
          </button>
        </div>

        <div class="mt-5">
          <div class="mb-1.5 flex items-center justify-between text-sm">
            <span class="text-[var(--color-muted)]">온보딩 완료</span>
            <span class="font-bold text-[var(--color-ink)]"
              >{{ onboardingDone }} / {{ onboardingTotal }}</span
            >
          </div>
          <div
            class="h-2 w-full overflow-hidden rounded-[var(--radius-chip)] bg-[var(--color-active)]"
          >
            <div
              class="h-full rounded-[var(--radius-chip)] bg-[var(--color-warning)] transition-all duration-500"
              :style="{ width: `${onboardingPct}%` }"
            />
          </div>
        </div>
      </section>

      <!-- 통계 카드 -->
      <div class="grid gap-4 sm:grid-cols-3">
        <div
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm text-[var(--color-muted)]">온보딩 완료</p>
          <p class="mt-1 text-2xl font-extrabold text-[var(--color-primary-text)]">
            {{ onboardingDone
            }}<span class="ml-0.5 text-base font-bold text-[var(--color-muted)]">명</span>
          </p>
        </div>
        <div
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm text-[var(--color-muted)]">작성 대기</p>
          <p class="mt-1 text-2xl font-extrabold text-[#9a6a00]">
            {{ onboardingWaiting
            }}<span class="ml-0.5 text-base font-bold text-[var(--color-muted)]">명</span>
          </p>
        </div>
        <div
          class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm text-[var(--color-muted)]">정원</p>
          <p class="mt-1 text-2xl font-extrabold text-[var(--color-ink)]">
            {{ onboardingTotal
            }}<span class="ml-0.5 text-base font-bold text-[var(--color-muted)]">명</span>
          </p>
        </div>
      </div>

      <!-- 멤버 온보딩 현황 -->
      <section
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 class="text-base font-bold text-[var(--color-ink)]">멤버 온보딩 현황</h2>
        <ul class="mt-4 divide-y divide-[var(--color-line)]">
          <li
            v-for="member in activeMembers"
            :key="member.id"
            class="flex items-center justify-between gap-3 py-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                :style="{ backgroundColor: getGroupCategoryColor(member.id) }"
              >
                {{ (member.nickname ?? member.displayName ?? '?').slice(0, 1).toUpperCase() }}
              </span>
              <span class="flex items-center gap-1.5">
                <span class="truncate font-bold text-[var(--color-ink)]">{{
                  member.nickname ?? member.displayName
                }}</span>
                <span
                  v-if="member.userId === myUserId"
                  class="rounded-[var(--radius-chip)] bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white"
                  >나</span
                >
                <span
                  v-if="member.permission === 'OWNER'"
                  class="rounded-[var(--radius-chip)] bg-[var(--color-tint-50)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-primary-text)]"
                  >방장</span
                >
              </span>
            </div>
            <span
              class="shrink-0 rounded-[var(--radius-chip)] px-2.5 py-1 text-xs font-semibold"
              :class="
                member.onboardingStatus === 'SUBMITTED'
                  ? 'bg-[var(--color-tint-50)] text-[var(--color-primary-text)]'
                  : 'bg-[var(--color-active)] text-[var(--color-muted)]'
              "
            >
              {{ member.onboardingStatus === 'SUBMITTED' ? '제출 완료' : '미제출' }}
            </span>
          </li>
        </ul>
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

  <!-- 그룹 삭제 확인 -->
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
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="showDeleteDialog = false"
        />
        <div
          class="relative w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-strong)]"
        >
          <h2 class="text-lg font-bold text-[var(--color-ink)]">그룹을 삭제하시겠습니까?</h2>
          <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            이 작업은 되돌릴 수 없습니다. 그룹과 관련된 모든 데이터가 영구적으로 삭제됩니다.
          </p>
          <p
            v-if="deleteError"
            role="alert"
            class="mt-3 text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ deleteError }}
          </p>
          <div class="mt-5 flex gap-3">
            <button
              type="button"
              :disabled="isDeleting"
              class="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] disabled:opacity-50"
              @click="showDeleteDialog = false"
            >
              취소
            </button>
            <button
              type="button"
              :disabled="isDeleting"
              class="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-danger)] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              @click="handleDeleteGroup"
            >
              {{ isDeleting ? '삭제 중…' : '삭제' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 스터디 시작 프로그레스 -->
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
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          class="relative w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--color-card)] p-8 text-center shadow-[var(--shadow-strong)]"
        >
          <div class="orbit-spinner mx-auto mb-5" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="orbit-arm" :style="`--i: ${i - 1}`">
              <div class="orbit-dot" />
            </div>
          </div>
          <h2 class="text-xl font-bold text-[var(--color-ink)]">스터디 생성 중</h2>
          <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            AI가 커리큘럼을 만들고 있어요.<br />잠시만 기다려 주세요.
          </p>
          <div class="mt-7">
            <div class="mb-2 flex items-center justify-between text-xs font-semibold">
              <span class="text-[var(--color-muted)]">진행률</span>
              <span class="text-[var(--color-primary-text)]">{{ startProgress }}%</span>
            </div>
            <div
              class="h-2.5 w-full overflow-hidden rounded-[var(--radius-chip)] bg-[var(--color-active)]"
            >
              <div
                class="h-full rounded-[var(--radius-chip)] bg-[var(--color-primary)] transition-all duration-700 ease-out"
                :style="{ width: `${startProgress}%` }"
              />
            </div>
          </div>
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
