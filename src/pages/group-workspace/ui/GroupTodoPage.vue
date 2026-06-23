<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'

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

const toastStore = useInAppNotificationStore()

type PageState = 'loading' | 'loaded' | 'none' | 'error'
const pageState = ref<PageState>('loading')
const errorMessage = ref('')

const curriculum = ref<Curriculum | null>(null)
const currentWeekCache = ref<CurriculumWeek | null>(null)

// 이동 가능한 주차(생성된 주차 = PENDING 이 아닌 주차), 주차 번호 순
const navigableWeeks = computed<CurriculumWeekSummary[]>(() =>
  (curriculum.value?.weeks ?? [])
    .filter((w) => w.status !== 'PENDING')
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber),
)

const selectedWeekId = ref<string>('')
const selectedWeek = ref<CurriculumWeek | null>(null)
const isWeekLoading = ref(false)

const tasks = ref<WeeklyTask[]>([])
const progress = ref<MemberWeekProgress | null>(null)
const completionMap = reactive<Record<string, TaskCompletionStatus>>({})
const updatingTaskId = ref<string | null>(null)
const taskError = reactive<Record<string, string>>({})

// ── 주차 네비게이션 ────────────────────────────────────────────
const selectedIndex = computed(() =>
  navigableWeeks.value.findIndex((w) => w.id === selectedWeekId.value),
)
const canPrev = computed(() => selectedIndex.value > 0)
const canNext = computed(
  () => selectedIndex.value >= 0 && selectedIndex.value < navigableWeeks.value.length - 1,
)

function goPrev(): void {
  if (canPrev.value) selectWeek(navigableWeeks.value[selectedIndex.value - 1]!.id)
}
function goNext(): void {
  if (canNext.value) selectWeek(navigableWeeks.value[selectedIndex.value + 1]!.id)
}

// ── 진행률 (스킵 제외) ─────────────────────────────────────────
const doneCount = computed(() => tasks.value.filter((t) => completionMap[t.id] === 'DONE').length)
const countableTotal = computed(
  () => tasks.value.filter((t) => completionMap[t.id] !== 'SKIPPED').length,
)
const progressPercent = computed(() =>
  countableTotal.value > 0 ? Math.round((doneCount.value / countableTotal.value) * 100) : 0,
)

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
  if (weekId) await loadWeekDetail(weekId)
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
    const weeks = navigableWeeks.value
    selectedWeekId.value = currentWeek?.id ?? weeks[weeks.length - 1]?.id ?? ''
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
</script>

<template>
  <div class="mx-auto max-w-3xl">
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
      <!-- ── 주차 헤더 (주차 네비 + 완료 카운트 + 진행바) ── -->
      <section
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <!-- 이전 주차 (주차 제목 줄에 맞춰 상단 정렬) -->
            <button
              type="button"
              :disabled="!canPrev"
              class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-30"
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

            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-extrabold text-[var(--color-ink)]">
                  {{ selectedWeek?.weekNumber ?? '-' }}주차
                </h1>
                <!-- 다음 주차: 이동 가능 → 화살표 / 마지막·미생성 → 잠금 -->
                <button
                  v-if="canNext"
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
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
                <span
                  v-else
                  class="flex h-7 w-7 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-active)] text-[var(--color-muted)]"
                  title="다음 주차는 아직 잠겨 있어요"
                  aria-label="다음 주차 잠김"
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
                </span>
              </div>
              <p v-if="weekRangeLabel" class="mt-0.5 text-sm text-[var(--color-muted)]">
                {{ weekRangeLabel }}
              </p>
            </div>
          </div>

          <div class="shrink-0 text-right">
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

      <!-- 주차 상세 로딩 -->
      <ScreenState
        v-if="isWeekLoading"
        variant="loading"
        title="주차 정보를 불러오는 중입니다."
        class="mt-5"
      />

      <template v-else>
        <!-- 안내 배너 -->
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
              :disabled="updatingTaskId === task.id"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition disabled:opacity-50"
              :class="
                statusOf(task) === 'DONE'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : statusOf(task) === 'SKIPPED'
                    ? 'border-[var(--color-line-strong)] bg-[var(--color-active)] text-[var(--color-muted)]'
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
            </button>

            <!-- 제목 + 메타 -->
            <div class="min-w-0 flex-1">
              <p
                class="truncate font-semibold"
                :class="
                  statusOf(task) === 'DONE'
                    ? 'text-[var(--color-faint)] line-through'
                    : statusOf(task) === 'SKIPPED'
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
  </div>
</template>
