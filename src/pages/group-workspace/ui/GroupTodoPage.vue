<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'

import {
  completeTask,
  getCurriculum,
  getMyWeekProgress,
  getCurrentWeek,
  listWeeklyTasks,
  updateMyWeekProgress,
  type Curriculum,
  type CurriculumWeek,
  type CurriculumWeekSummary,
  type CurriculumWeekStatus,
  type MemberWeekProgress,
  type MemberWeekProgressStatus,
  type TaskCompletionStatus,
  type WeeklyTask,
} from '@/entities/curriculum'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const TASK_TYPE_LABEL: Record<string, string> = {
  READING: '읽기',
  PRACTICE: '실습',
  ASSIGNMENT: '과제',
  PROJECT: '프로젝트',
  CUSTOM: '기타',
}

const TASK_TYPE_COLOR: Record<string, string> = {
  READING: 'bg-[rgba(88,101,242,0.15)] text-[#a5b4fc] border-[rgba(88,101,242,0.3)]',
  PRACTICE: 'bg-[rgba(35,165,90,0.15)] text-[#4ade80] border-[rgba(35,165,90,0.3)]',
  ASSIGNMENT: 'bg-[rgba(224,149,58,0.15)] text-[#fbbf24] border-[rgba(224,149,58,0.3)]',
  PROJECT: 'bg-[rgba(139,92,246,0.15)] text-[#c4b5fd] border-[rgba(139,92,246,0.3)]',
  CUSTOM: 'bg-[var(--color-card)] text-[var(--color-muted)] border-[var(--color-line)]',
}

const WEEK_STATUS_LABEL: Record<CurriculumWeekStatus, string> = {
  PENDING: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
}

const PROGRESS_STATUS_LABEL: Record<MemberWeekProgressStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  INCOMPLETE: '미완료',
  FEEDBACK_READY: '피드백 준비됨',
}

const COMPLETION_ACTIONS: { status: TaskCompletionStatus; label: string }[] = [
  { status: 'DONE', label: '완료' },
  { status: 'INCOMPLETE', label: '미완료' },
  { status: 'SKIPPED', label: '스킵' },
]

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupTodoPage must be used inside GroupWorkspacePage.')
const { groupId } = workspaceContext

// ─── 전체 페이지 상태 ───────────────────────────────────────────
type PageState = 'loading' | 'loaded' | 'none' | 'error'
const pageState = ref<PageState>('loading')
const errorMessage = ref('')

// ─── 커리큘럼 주차 목록 ──────────────────────────────────────────
const curriculum = ref<Curriculum | null>(null)
const weekSummaries = computed<CurriculumWeekSummary[]>(() => curriculum.value?.weeks ?? [])

// ─── 선택된 주차 ─────────────────────────────────────────────────
const selectedWeekId = ref<string>('')
const selectedWeek = ref<CurriculumWeek | null>(null)
const currentWeekCache = ref<CurriculumWeek | null>(null)
const isWeekLoading = ref(false)

// ─── 태스크 + 진행 상태 ───────────────────────────────────────────
const tasks = ref<WeeklyTask[]>([])
const progress = ref<MemberWeekProgress | null>(null)
const completionMap = reactive<Record<string, TaskCompletionStatus>>({})
const updatingTaskId = ref<string | null>(null)
const taskError = reactive<Record<string, string>>({})
const isUpdatingProgress = ref(false)
const justCompletedIds = ref<Set<string>>(new Set())

const allTasksDone = computed(
  () => tasks.value.length > 0 && tasks.value.every((t) => completionMap[t.id] === 'DONE'),
)

// ─── 탭 스크롤 ref ────────────────────────────────────────────────
const tabsRef = ref<HTMLElement | null>(null)

// ─────────────────────────────────────────────────────────────────
onMounted(() => {
  void loadInitial()
})

watch(selectedWeekId, async (weekId) => {
  if (!weekId) return
  await loadWeekDetail(weekId)
})

// 초기 로드: 커리큘럼 + 현재 주차 결정
async function loadInitial(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    // 커리큘럼 목록 로드
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

    // 현재 진행 주차를 기본 선택
    const defaultWeekId = currentWeek?.id ?? ''
    selectedWeekId.value = defaultWeekId
    pageState.value = 'loaded'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      pageState.value = 'none'
    } else {
      errorMessage.value = error instanceof ApiError ? error.message : '정보를 불러오지 못했습니다.'
      pageState.value = 'error'
    }
  }
}

// 선택한 주차의 상세 + 태스크 로드
async function loadWeekDetail(weekId: string): Promise<void> {
  isWeekLoading.value = true
  tasks.value = []
  progress.value = null
  selectedWeek.value = null

  // completionMap 초기화
  Object.keys(completionMap).forEach((k) => delete completionMap[k])

  try {
    const weekData = currentWeekCache.value?.id === weekId ? currentWeekCache.value : null
    if (!weekData) {
      isWeekLoading.value = false
      return
    }
    const [fetchedTasks, fetchedProgress] = await Promise.all([
      listWeeklyTasks(weekId),
      getMyWeekProgress(weekId).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }),
    ])

    selectedWeek.value = weekData
    tasks.value = fetchedTasks.sort((a, b) => a.displayOrder - b.displayOrder)
    progress.value = fetchedProgress

    for (const task of fetchedTasks) {
      if (task.completion) {
        completionMap[task.id] = task.completion.status
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '주차 정보를 불러오지 못했습니다.'
  } finally {
    isWeekLoading.value = false
  }
}

function selectWeek(weekId: string): void {
  if (weekId === selectedWeekId.value) return
  selectedWeekId.value = weekId
}

async function handleCompleteTask(taskId: string, status: TaskCompletionStatus): Promise<void> {
  updatingTaskId.value = taskId
  delete taskError[taskId]

  try {
    const result = await completeTask(taskId, { status })
    const prev = completionMap[taskId]
    completionMap[taskId] = result.status

    if (result.status === 'DONE' && prev !== 'DONE') {
      justCompletedIds.value = new Set([...justCompletedIds.value, taskId])
      setTimeout(() => {
        const next = new Set(justCompletedIds.value)
        next.delete(taskId)
        justCompletedIds.value = next
      }, 800)
    }
  } catch (error) {
    taskError[taskId] = error instanceof ApiError ? error.message : '저장에 실패했습니다.'
  } finally {
    updatingTaskId.value = null
  }
}

async function handleUpdateProgress(status: MemberWeekProgressStatus): Promise<void> {
  if (!selectedWeek.value) return
  isUpdatingProgress.value = true
  try {
    progress.value = await updateMyWeekProgress(selectedWeek.value.id, { status })
  } catch {
    // silent
  } finally {
    isUpdatingProgress.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCompletionStatus(task: WeeklyTask): TaskCompletionStatus {
  return completionMap[task.id] ?? 'TODO'
}

function scrollTabs(direction: 'left' | 'right'): void {
  if (!tabsRef.value) return
  tabsRef.value.scrollBy({ left: direction === 'right' ? 200 : -200, behavior: 'smooth' })
}
</script>

<template>
  <div class="grid gap-5">
    <!-- 초기 로딩 -->
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
      <!-- ── 주차 탭 네비게이션 (weeks 데이터가 있을 때만 표시) ── -->
      <section
        v-if="weekSummaries.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-soft)]"
      >
        <div class="border-b border-[var(--color-line)] px-4 py-3">
          <p class="text-xs font-semibold text-[var(--color-primary)]">커리큘럼</p>
          <h2 v-if="curriculum" class="mt-0.5 text-sm font-bold text-[var(--color-ink)]">
            {{ curriculum.title }}
          </h2>
        </div>

        <div class="relative flex items-center">
          <button
            type="button"
            class="absolute left-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-r from-[var(--color-card)] to-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] focus:outline-none"
            aria-label="이전 주차"
            @click="scrollTabs('left')"
          >
            ‹
          </button>

          <div
            ref="tabsRef"
            class="flex gap-0 overflow-x-auto scroll-smooth px-8"
            style="scrollbar-width: none; -ms-overflow-style: none;"
          >
            <button
              v-for="week in weekSummaries"
              :key="week.id"
              type="button"
              :class="[
                'relative flex shrink-0 flex-col items-start px-4 py-3 text-left transition-colors focus:outline-none',
                'border-b-2',
                selectedWeekId === week.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-card)]'
                  : 'border-transparent hover:bg-[var(--color-card)]/60',
              ]"
              @click="selectWeek(week.id)"
            >
              <div class="flex items-center gap-2">
                <span
                  :class="[
                    'text-xs font-bold',
                    selectedWeekId === week.id
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-muted)]',
                  ]"
                >
                  {{ week.weekNumber }}주차
                </span>
                <span
                  :class="[
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    week.status === 'IN_PROGRESS'
                      ? 'bg-[var(--color-primary)] text-white'
                      : week.status === 'COMPLETED'
                        ? 'bg-[rgba(35,165,90,0.2)] text-[var(--color-success)]'
                        : 'bg-[var(--color-card)] text-[var(--color-muted)]',
                  ]"
                >
                  {{ WEEK_STATUS_LABEL[week.status] }}
                </span>
              </div>
              <span
                :class="[
                  'mt-0.5 max-w-[120px] truncate text-xs',
                  selectedWeekId === week.id
                    ? 'font-semibold text-[var(--color-ink)]'
                    : 'text-[var(--color-muted)]',
                ]"
              >
                {{ week.title }}
              </span>
            </button>
          </div>

          <button
            type="button"
            class="absolute right-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-l from-[var(--color-card)] to-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] focus:outline-none"
            aria-label="다음 주차"
            @click="scrollTabs('right')"
          >
            ›
          </button>
        </div>
      </section>

      <!-- weeks 없을 때 커리큘럼 제목만 표시 -->
      <section
        v-else-if="curriculum"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 shadow-[var(--shadow-soft)]"
      >
        <p class="text-xs font-semibold text-[var(--color-primary)]">커리큘럼</p>
        <h2 class="mt-0.5 text-sm font-bold text-[var(--color-ink)]">{{ curriculum.title }}</h2>
      </section>

      <!-- ── 주차 상세 로딩 ────────────────────────────────────── -->
      <ScreenState
        v-if="isWeekLoading"
        variant="loading"
        title="주차 정보를 불러오는 중입니다."
        description="잠시만 기다려 주세요."
      />

      <template v-else-if="selectedWeek">
        <!-- AI 팀장 회고 배너 (모든 태스크 완료 시) -->
        <Transition
          enter-active-class="transition-all duration-500 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
        >
          <section
            v-if="allTasksDone && selectedWeek.status === 'IN_PROGRESS'"
            class="flex items-start gap-4 rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]"
            role="alert"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-lg text-white">
              💬
            </div>
            <div>
              <p class="font-bold text-[var(--color-ink)]">AI 팀장에게 회고가 도착했어요</p>
              <p class="mt-1 text-sm text-[var(--color-muted)]">
                이번 주 할 일을 모두 완료했습니다. AI 팀장이 회고를 보냈습니다.
              </p>
              <RouterLink
                :to="{ name: 'group-ai', params: { groupId } }"
                class="mt-2 inline-flex h-8 items-center rounded-md bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none"
              >
                AI 팀장과 회고하기
              </RouterLink>
            </div>
          </section>
        </Transition>

        <!-- ── 주차 정보 카드 ─────────────────────────────────── -->
        <section
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold text-[var(--color-primary)]">
                  {{ selectedWeek.weekNumber }}주차
                </span>
                <span
                  :class="[
                    'rounded px-2 py-0.5 text-xs font-semibold',
                    selectedWeek.status === 'IN_PROGRESS'
                      ? 'bg-[var(--color-primary)] text-white'
                      : selectedWeek.status === 'COMPLETED'
                        ? 'bg-[rgba(35,165,90,0.2)] text-[var(--color-success)]'
                        : 'bg-[var(--color-card)] text-[var(--color-muted)]',
                  ]"
                >
                  {{ WEEK_STATUS_LABEL[selectedWeek.status] }}
                </span>
              </div>
              <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">{{ selectedWeek.title }}</h2>
              <p
                v-if="selectedWeek.sprintGoal || selectedWeek.focus"
                class="mt-2 text-sm leading-6 text-[var(--color-muted)]"
              >
                {{ selectedWeek.sprintGoal ?? selectedWeek.focus }}
              </p>

              <dl
                v-if="selectedWeek.startsAt || selectedWeek.endsAt"
                class="mt-4 flex flex-wrap gap-4 text-sm"
              >
                <div v-if="selectedWeek.startsAt">
                  <dt class="text-xs text-[var(--color-muted)]">시작</dt>
                  <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">{{ formatDate(selectedWeek.startsAt) }}</dd>
                </div>
                <div v-if="selectedWeek.endsAt">
                  <dt class="text-xs text-[var(--color-muted)]">마감</dt>
                  <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">{{ formatDate(selectedWeek.endsAt) }}</dd>
                </div>
              </dl>
            </div>

            <!-- 내 진행 상태 -->
            <div v-if="progress" class="shrink-0">
              <p class="text-xs text-[var(--color-muted)]">내 진행 상태</p>
              <p class="mt-1 text-sm font-semibold text-[var(--color-ink)]">
                {{ PROGRESS_STATUS_LABEL[progress.status] }}
              </p>
              <div class="mt-2 flex flex-wrap gap-1">
                <button
                  v-for="opt in (['IN_PROGRESS', 'COMPLETED', 'INCOMPLETE'] as MemberWeekProgressStatus[])"
                  :key="opt"
                  type="button"
                  :disabled="isUpdatingProgress || progress.status === opt"
                  :class="[
                    'inline-flex h-7 items-center rounded border px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]',
                    progress.status === opt
                      ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                      : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                  ]"
                  @click="handleUpdateProgress(opt)"
                >
                  {{ PROGRESS_STATUS_LABEL[opt] }}
                </button>
              </div>
            </div>
          </div>

          <!-- 태스크 완료 요약 -->
          <div v-if="tasks.length > 0" class="mt-4">
            <div class="flex items-center justify-between text-xs text-[var(--color-muted)]">
              <span>태스크 완료</span>
              <span class="font-semibold text-[var(--color-ink)]">
                {{ tasks.filter((t) => completionMap[t.id] === 'DONE').length }} / {{ tasks.length }}
              </span>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-card)]">
              <div
                class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                :style="{
                  width: `${(tasks.filter((t) => completionMap[t.id] === 'DONE').length / tasks.length) * 100}%`
                }"
              />
            </div>
          </div>
        </section>

        <!-- ── 태스크 목록 ─────────────────────────────────────── -->
        <section
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <h3 class="text-sm font-bold text-[var(--color-ink)]">
            {{ selectedWeek.weekNumber }}주차 과제 ({{ tasks.length }}개)
          </h3>

          <ul v-if="tasks.length > 0" class="mt-4 grid gap-3">
            <li
              v-for="task in tasks"
              :key="task.id"
              :class="[
                'rounded-lg border p-4 transition-all duration-300',
                getCompletionStatus(task) === 'DONE'
                  ? 'border-[var(--color-line)] bg-[var(--color-panel)]'
                  : 'border-[var(--color-line-strong)] bg-[var(--color-active)]',
                justCompletedIds.has(task.id) ? 'scale-[0.99]' : '',
              ]"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <!-- 배지 행 -->
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      class="rounded border px-2 py-0.5 text-xs font-semibold"
                      :class="TASK_TYPE_COLOR[task.taskType] ?? TASK_TYPE_COLOR.CUSTOM"
                    >
                      {{ TASK_TYPE_LABEL[task.taskType] ?? task.taskType }}
                    </span>
                    <span
                      v-if="task.required"
                      class="rounded border border-[rgba(237,66,69,0.3)] bg-[rgba(237,66,69,0.15)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]"
                    >
                      필수
                    </span>
                    <span
                      :class="[
                        'rounded px-2 py-0.5 text-xs font-semibold',
                        getCompletionStatus(task) === 'DONE'
                          ? 'bg-[rgba(35,165,90,0.2)] text-[var(--color-success)]'
                          : getCompletionStatus(task) === 'INCOMPLETE'
                            ? 'bg-[rgba(237,66,69,0.15)] text-[var(--color-danger)]'
                            : getCompletionStatus(task) === 'SKIPPED'
                              ? 'bg-[var(--color-card)] text-[var(--color-muted)]'
                              : 'bg-[var(--color-card)] text-[var(--color-muted)]',
                      ]"
                    >
                      {{
                        getCompletionStatus(task) === 'DONE' ? '✓ 완료'
                        : getCompletionStatus(task) === 'SKIPPED' ? '스킵'
                        : getCompletionStatus(task) === 'INCOMPLETE' ? '미완료'
                        : '미시작'
                      }}
                    </span>
                  </div>

                  <!-- 제목 -->
                  <p
                    :class="[
                      'mt-2 font-semibold transition-colors duration-300',
                      getCompletionStatus(task) === 'DONE'
                        ? 'text-[var(--color-muted-deep)] line-through'
                        : 'text-[var(--color-ink)]',
                    ]"
                  >
                    {{ task.title }}
                  </p>

                  <p v-if="task.description" class="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                    {{ task.description }}
                  </p>
                  <p v-if="task.dueAt" class="mt-1 text-xs text-[var(--color-muted)]">
                    마감: {{ formatDateTime(task.dueAt) }}
                  </p>
                </div>

                <!-- 액션 버튼 (현재 진행 주차만 활성) -->
                <div
                  v-if="selectedWeek.status !== 'PENDING'"
                  class="flex shrink-0 flex-wrap gap-1 sm:flex-col"
                >
                  <button
                    v-for="action in COMPLETION_ACTIONS"
                    :key="action.status"
                    type="button"
                    :disabled="updatingTaskId === task.id || getCompletionStatus(task) === action.status"
                    :class="[
                      'inline-flex h-8 items-center justify-center rounded border px-3 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50',
                      getCompletionStatus(task) === action.status
                        ? action.status === 'DONE'
                          ? 'border-[var(--color-success)] bg-[rgba(35,165,90,0.2)] text-[var(--color-success)]'
                          : 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                        : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                      action.status === 'DONE' && getCompletionStatus(task) !== 'DONE'
                        ? 'hover:border-[var(--color-success)] hover:bg-[rgba(35,165,90,0.15)] hover:text-[var(--color-success)]'
                        : '',
                    ]"
                    @click="handleCompleteTask(task.id, action.status)"
                  >
                    {{ updatingTaskId === task.id ? '…' : action.label }}
                  </button>
                </div>

                <!-- 예정 주차 안내 -->
                <div v-else class="shrink-0">
                  <span class="rounded border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
                    예정
                  </span>
                </div>
              </div>

              <p v-if="taskError[task.id]" role="alert" class="mt-2 text-xs font-semibold text-[var(--color-danger)]">
                {{ taskError[task.id] }}
              </p>
            </li>
          </ul>

          <p v-else class="mt-4 text-sm text-[var(--color-muted)]">
            이 주차에 등록된 과제가 없어요.
          </p>
        </section>
      </template>

      <!-- 주차 미선택 상태 -->
      <ScreenState
        v-else-if="!isWeekLoading && weekSummaries.length === 0"
        variant="empty"
        title="커리큘럼 주차가 없어요."
        description="스터디가 시작되면 주차별 과제가 나타나요."
      />
    </template>
  </div>
</template>
