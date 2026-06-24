<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  completeTask,
  getCurriculum,
  getCurrentWeek,
  getWeek,
  getMyWeekProgress,
  listWeeklyTasks,
  type Curriculum,
  type CurriculumWeek,
  type CurriculumWeekSummary,
  type MemberWeekProgress,
  type TaskCompletionStatus,
  type WeeklyTask,
} from '@/entities/curriculum'
import { useInAppNotificationStore } from '@/features/notification'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupTodoPage must be used inside GroupWorkspacePage.')
const { groupId } = workspaceContext

const router = useRouter()
const toastStore = useInAppNotificationStore()

type PageState = 'loading' | 'loaded' | 'none' | 'error'
const pageState = ref<PageState>('loading')
const errorMessage = ref('')

const curriculum = ref<Curriculum | null>(null)
const currentWeekCache = ref<CurriculumWeek | null>(null)

// 전체 주차(PENDING 포함), 주차 번호 순
const allCurriculumWeeks = computed<CurriculumWeekSummary[]>(() =>
  [...(curriculum.value?.weeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber),
)

// 커리큘럼은 주차마다 점진 생성되지만(생성된 주차만 실제 데이터 존재), 전체 계획 주차 수(totalWeeks)는
// 미리 알 수 있다. 아직 생성되지 않은 미래 주차는 잠금 슬롯으로 함께 보여준다.
const totalWeeks = computed(() =>
  Math.max(curriculum.value?.totalWeeks ?? 0, allCurriculumWeeks.value.length),
)
const displayWeeks = computed<{ weekNumber: number; week: CurriculumWeekSummary | null }[]>(() => {
  const byNumber = new Map(allCurriculumWeeks.value.map((w) => [w.weekNumber, w]))
  return Array.from({ length: totalWeeks.value }, (_, i) => ({
    weekNumber: i + 1,
    week: byNumber.get(i + 1) ?? null,
  }))
})

const selectedWeekId = ref<string>('')
const selectedWeek = ref<CurriculumWeek | null>(null)
const isWeekLoading = ref(false)

const tasks = ref<WeeklyTask[]>([])
const progress = ref<MemberWeekProgress | null>(null)
const completionMap = reactive<Record<string, TaskCompletionStatus>>({})
const updatingTaskId = ref<string | null>(null)
const taskError = reactive<Record<string, string>>({})

// ── 주차 네비게이션 (PENDING 포함 전체 주차 기준) ───────────────
const selectedIndex = computed(() =>
  allCurriculumWeeks.value.findIndex((w) => w.id === selectedWeekId.value),
)
const canPrev = computed(() => selectedIndex.value > 0)
const canNext = computed(
  () => selectedIndex.value >= 0 && selectedIndex.value < allCurriculumWeeks.value.length - 1,
)

const selectedWeekSummary = computed(() =>
  allCurriculumWeeks.value.find((w) => w.id === selectedWeekId.value),
)
const isSelectedWeekPending = computed(() => selectedWeekSummary.value?.status === 'PENDING')
// 종료(COMPLETED)된 주차는 완료/되돌리기/건너뛰기를 잠근다(미완료는 서버에서 확정됨).
const isSelectedWeekCompleted = computed(() => selectedWeekSummary.value?.status === 'COMPLETED')

function goPrev(): void {
  if (canPrev.value) selectWeek(allCurriculumWeeks.value[selectedIndex.value - 1]!.id)
}
function goNext(): void {
  if (canNext.value) selectWeek(allCurriculumWeeks.value[selectedIndex.value + 1]!.id)
}

// ── 진행률 (스킵 제외) ─────────────────────────────────────────
const doneCount = computed(() => tasks.value.filter((t) => completionMap[t.id] === 'DONE').length)
const countableTotal = computed(
  () => tasks.value.filter((t) => completionMap[t.id] !== 'SKIPPED').length,
)
const progressPercent = computed(() =>
  countableTotal.value > 0 ? Math.round((doneCount.value / countableTotal.value) * 100) : 0,
)
const allDone = computed(() => countableTotal.value > 0 && doneCount.value === countableTotal.value)

function goToRetrospective(): void {
  void router.push({ name: 'group-retrospective', params: { groupId: groupId.value } })
}

const sortedTasks = computed(() =>
  [...tasks.value].sort((a, b) => {
    const rank = (id: string) =>
      completionMap[id] === 'DONE' ? 1 : completionMap[id] === 'SKIPPED' ? 2 : 0
    const diff = rank(a.id) - rank(b.id)
    return diff !== 0 ? diff : a.displayOrder - b.displayOrder
  }),
)

onMounted(() => void loadInitial())

watch(selectedWeekId, async (weekId) => {
  if (!weekId) return
  if (isSelectedWeekPending.value) {
    selectedWeek.value = null
    tasks.value = []
    Object.keys(completionMap).forEach((k) => delete completionMap[k])
  } else {
    await loadWeekDetail(weekId)
  }
})

async function loadInitial(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    const [curriculumData, currentWeek] = await Promise.all([
      getCurriculum(groupId.value).catch(() => null),
      getCurrentWeek(groupId.value).catch(() => null),
    ])
    if (!currentWeek && !curriculumData) {
      pageState.value = 'none'
      return
    }
    curriculum.value = curriculumData
    currentWeekCache.value = currentWeek
    const fallbackWeek = allCurriculumWeeks.value.filter((w) => w.status !== 'PENDING').pop()
    selectedWeekId.value = currentWeek?.id ?? fallbackWeek?.id ?? ''
    pageState.value = 'loaded'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) pageState.value = 'none'
    else {
      errorMessage.value = error instanceof ApiError ? error.message : '정보를 불러오지 못했습니다.'
      pageState.value = 'error'
    }
  }
}

async function loadWeekDetail(weekId: string): Promise<void> {
  isWeekLoading.value = true
  tasks.value = []
  progress.value = null
  selectedWeek.value = null
  Object.keys(completionMap).forEach((k) => delete completionMap[k])

  try {
    const [weekData, fetchedTasks, fetchedProgress] = await Promise.all([
      currentWeekCache.value?.id === weekId
        ? Promise.resolve(currentWeekCache.value)
        : getWeek(weekId).catch(() => null),
      listWeeklyTasks(weekId),
      getMyWeekProgress(weekId).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }),
    ])
    selectedWeek.value = weekData
    tasks.value = fetchedTasks
    progress.value = fetchedProgress
    for (const task of fetchedTasks) {
      if (task.completion) completionMap[task.id] = task.completion.status
    }
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '주차 정보를 불러오지 못했습니다.'
  } finally {
    isWeekLoading.value = false
  }
}

function selectWeek(weekId: string): void {
  if (weekId !== selectedWeekId.value) selectedWeekId.value = weekId
}

function statusOf(task: WeeklyTask): TaskCompletionStatus {
  return completionMap[task.id] ?? 'TODO'
}

async function setStatus(taskId: string, status: TaskCompletionStatus): Promise<void> {
  if (updatingTaskId.value) return
  if (isSelectedWeekCompleted.value) {
    toastStore.pushToast('종료된 주차예요', '이미 끝난 주차의 할 일은 변경할 수 없어요.', 'info')
    return
  }
  updatingTaskId.value = taskId
  delete taskError[taskId]
  try {
    const result = await completeTask(taskId, { status })
    completionMap[taskId] = result.status
    if (result.status === 'DONE') toastStore.pushToast('할 일을 완료했어요', '', 'success')
    else if (result.status === 'SKIPPED') toastStore.pushToast('할 일을 건너뛰었어요', '', 'info')
    else toastStore.pushToast('되돌렸어요', '', 'info')
  } catch (error) {
    taskError[taskId] = error instanceof ApiError ? error.message : '저장에 실패했습니다.'
    toastStore.pushToast('저장 실패', taskError[taskId], 'error')
  } finally {
    updatingTaskId.value = null
  }
}

// 체크박스 클릭: 완료 ↔ 미완료 토글, 스킵은 되돌리기(미완료)로
function toggleCheck(task: WeeklyTask): void {
  const s = statusOf(task)
  if (s === 'DONE') void setStatus(task.id, 'TODO')
  else void setStatus(task.id, 'DONE')
}

const weekRangeLabel = computed(() => {
  const w = selectedWeek.value
  if (!w?.startsAt || !w?.endsAt) return ''
  return `${formatDate(w.startsAt)} - ${formatDate(w.endsAt)}`
})

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value))
}

function weekChipClass(week: CurriculumWeekSummary): string {
  if (week.id === selectedWeekId.value) {
    return 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
  }
  if (week.status === 'PENDING') {
    return 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-faint)] hover:border-[var(--color-line-strong)]'
  }
  return 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]'
}
</script>

<template>
  <div>
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="커리큘럼을 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="정보를 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadInitial"
    />

    <ScreenState
      v-else-if="pageState === 'none'"
      variant="empty"
      eyebrow="학습"
      title="현재 진행 중인 커리큘럼이 없어요."
      description="스터디가 시작되면 커리큘럼과 이번 주 과제가 여기에 나타나요."
    />

    <template v-else-if="pageState === 'loaded'">
      <!-- ── 주차 탭 ── -->
      <section class="rounded-[var(--radius-card)] bg-[var(--color-card)] p-5">
        <div class="grid grid-cols-5 gap-2 sm:grid-cols-10">
          <template v-for="slot in displayWeeks" :key="slot.weekNumber">
            <!-- 생성된 주차: 선택 가능 -->
            <button
              v-if="slot.week"
              type="button"
              class="flex h-16 flex-col items-center justify-center gap-1 rounded-[var(--radius-input)] border text-sm font-bold transition"
              :class="weekChipClass(slot.week)"
              @click="selectWeek(slot.week.id)"
            >
              <svg
                v-if="slot.week.status === 'COMPLETED'"
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <svg
                v-else-if="slot.week.status === 'PENDING'"
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{{ slot.weekNumber }}주</span>
            </button>
            <!-- 아직 생성되지 않은 미래 주차: 잠금 -->
            <div
              v-else
              class="flex h-16 cursor-not-allowed flex-col items-center justify-center gap-1 rounded-[var(--radius-input)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-faint)]"
              :title="`${slot.weekNumber}주차는 아직 공개되지 않았어요`"
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
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{{ slot.weekNumber }}주</span>
            </div>
          </template>
        </div>
      </section>

      <!-- ── 주차 헤더 (이전 버튼 | 카드 | 다음 버튼) ── -->
      <div class="flex items-center gap-3">
        <!-- 이전 주차 버튼 -->
        <button
          type="button"
          :disabled="!canPrev"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-ink)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="이전 주차"
          @click="goPrev"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <!-- 주차 정보 카드 -->
        <section
          class="min-w-0 flex-1 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-xl font-extrabold text-[var(--color-ink)]">
                {{ selectedWeekSummary?.weekNumber ?? selectedWeek?.weekNumber ?? '-' }}주차
              </h1>
              <p v-if="weekRangeLabel" class="mt-0.5 text-sm text-[var(--color-muted)]">
                {{ weekRangeLabel }}
              </p>
              <p v-else-if="isSelectedWeekPending" class="mt-0.5 text-sm text-[var(--color-muted)]">
                아직 시작 전이에요
              </p>
            </div>
            <div v-if="!isSelectedWeekPending" class="shrink-0 text-right">
              <p class="text-2xl font-extrabold leading-none">
                <span class="text-[var(--color-primary-text)]">{{ doneCount }}</span>
                <span class="text-[var(--color-faint)]">/{{ countableTotal }}</span>
              </p>
              <p class="mt-1 text-xs text-[var(--color-muted)]">완료</p>
            </div>
          </div>

          <div
            class="mt-4 h-2 w-full overflow-hidden rounded-[var(--radius-chip)] bg-[var(--color-active)]"
          >
            <div
              class="h-full rounded-[var(--radius-chip)] bg-[var(--color-primary)] transition-[width] duration-500"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </section>

        <!-- 다음 주차: 이동 가능 → 화살표 / PENDING 주차 있음 → 자물쇠 / 없음 → 공백 -->
        <button
          v-if="canNext"
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-ink)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--color-hover)]"
          aria-label="다음 주차"
          @click="goNext"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <div v-else class="h-9 w-9 shrink-0" />
      </div>

      <!-- 주차 상세 로딩 -->
      <ScreenState
        v-if="isWeekLoading"
        variant="loading"
        title="주차 정보를 불러오는 중입니다."
        class="mt-5"
      />

      <template v-else>
        <!-- PENDING 주차: 잠금 안내 -->
        <div
          v-if="isSelectedWeekPending"
          class="mt-8 flex flex-col items-center gap-3 py-10 text-center"
        >
          <div
            class="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-active)] text-[var(--color-muted)]"
          >
            <svg
              class="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p class="font-semibold text-[var(--color-ink)]">아직 시작되지 않은 주차예요</p>
          <p class="text-sm text-[var(--color-muted)]">해당 주차가 시작되면 커리큘럼이 공개돼요.</p>
        </div>

        <!-- 일반 주차 콘텐츠 -->
        <template v-else>
        <div
          class="mt-4 flex items-center gap-2.5 rounded-[var(--radius-input)] bg-[var(--color-tint-50)] px-4 py-3 text-sm text-[var(--color-primary-text)]"
        >
          <svg
            class="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          할 일을 완료하면 학습 인증이 자동으로 기록돼요.
        </div>

        <!-- 전체 완료 시 회고 유도 배너 -->
        <div
          v-if="allDone"
          class="mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-primary)] bg-[var(--color-tint-50)] px-5 py-4"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <p class="font-bold text-[var(--color-ink)]">이번 주 할 일을 모두 마쳤어요!</p>
              <p class="mt-0.5 text-sm text-[var(--color-muted)]">회고를 작성하고 한 주를 마무리해 보세요.</p>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            @click="goToRetrospective"
          >
            회고하러 가기
          </button>
        </div>

        <!-- ── 태스크 목록 ── -->
        <ul v-if="tasks.length > 0" class="mt-4 grid gap-2.5">
          <li
            v-for="task in sortedTasks"
            :key="task.id"
            class="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3.5 shadow-[var(--shadow-soft)] transition"
            :class="statusOf(task) === 'SKIPPED' ? 'opacity-70' : ''"
          >
            <!-- 체크박스 -->
            <button
              type="button"
              :disabled="updatingTaskId === task.id || isSelectedWeekCompleted"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="
                statusOf(task) === 'DONE'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : statusOf(task) === 'SKIPPED'
                    ? 'border-[var(--color-line-strong)] bg-[var(--color-active)] text-[var(--color-muted)]'
                    : statusOf(task) === 'INCOMPLETE'
                      ? 'border-[var(--color-danger)] bg-[rgba(255,82,71,0.12)] text-[var(--color-danger)]'
                      : 'border-[var(--color-line-strong)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]'
              "
              :aria-label="statusOf(task) === 'DONE' ? '완료 취소' : '완료'"
              @click="toggleCheck(task)"
            >
              <svg
                v-if="statusOf(task) === 'DONE'"
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <svg
                v-else-if="statusOf(task) === 'SKIPPED'"
                class="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
              >
                <path d="M5 12h14" />
              </svg>
              <svg
                v-else-if="statusOf(task) === 'INCOMPLETE'"
                class="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
                stroke-linecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <!-- 제목 + 메타 -->
            <div class="min-w-0 flex-1">
              <p
                class="truncate font-semibold"
                :class="
                  statusOf(task) === 'DONE'
                    ? 'text-[var(--color-faint)] line-through'
                    : statusOf(task) === 'SKIPPED' || statusOf(task) === 'INCOMPLETE'
                      ? 'text-[var(--color-muted)]'
                      : 'text-[var(--color-ink)]'
                "
              >
                {{ task.title }}
              </p>
              <p
                v-if="statusOf(task) === 'SKIPPED'"
                class="mt-0.5 text-xs text-[var(--color-muted)]"
              >
                이번 주 건너뜀
              </p>
            </div>

            <!-- 우측 액션 -->
            <div class="flex shrink-0 items-center gap-2">
              <template v-if="statusOf(task) === 'DONE'">
                <span class="text-xs font-semibold text-[var(--color-muted)]">완료</span>
              </template>
              <template v-else-if="statusOf(task) === 'SKIPPED'">
                <button
                  v-if="!isSelectedWeekCompleted"
                  type="button"
                  :disabled="updatingTaskId === task.id"
                  class="text-xs font-bold text-[var(--color-primary-text)] transition hover:underline disabled:opacity-50"
                  @click="setStatus(task.id, 'TODO')"
                >
                  되돌리기
                </button>
                <span
                  class="rounded-[var(--radius-chip)] bg-[var(--color-active)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-muted)]"
                >
                  건너뜀
                </span>
              </template>
              <template v-else-if="isSelectedWeekCompleted">
                <span
                  class="rounded-[var(--radius-chip)] bg-[rgba(255,82,71,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger)]"
                >
                  미완료
                </span>
              </template>
              <template v-else>
                <button
                  type="button"
                  :disabled="updatingTaskId === task.id"
                  class="rounded-[var(--radius-chip)] bg-[var(--color-active)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)] disabled:opacity-50"
                  @click="setStatus(task.id, 'SKIPPED')"
                >
                  건너뛰기
                </button>
              </template>
            </div>
          </li>
        </ul>

        <p v-else class="mt-6 text-center text-sm text-[var(--color-muted)]">
          이 주차에 등록된 과제가 없어요.
        </p>
        </template>
      </template>
    </template>
  </div>
</template>
