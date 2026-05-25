<script setup lang="ts">
import { inject, onMounted, reactive, ref } from 'vue'

import {
  completeTask,
  getCurrentWeek,
  getMyWeekProgress,
  listWeeklyTasks,
  updateMyWeekProgress,
  type CurriculumWeek,
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

if (!workspaceContext) {
  throw new Error('GroupTodoPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'loaded' | 'none' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const currentWeek = ref<CurriculumWeek | null>(null)
const tasks = ref<WeeklyTask[]>([])
const progress = ref<MemberWeekProgress | null>(null)
const completionMap = reactive<Record<string, TaskCompletionStatus>>({})
const updatingTaskId = ref<string | null>(null)
const taskError = reactive<Record<string, string>>({})
const isUpdatingProgress = ref(false)

onMounted(() => {
  void loadAll()
})

async function loadAll(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  currentWeek.value = null
  tasks.value = []
  progress.value = null

  try {
    const week = await getCurrentWeek(groupId.value)
    currentWeek.value = week

    const [fetchedTasks, fetchedProgress] = await Promise.all([
      listWeeklyTasks(week.id),
      getMyWeekProgress(week.id).catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          return null
        }
        throw e
      }),
    ])

    tasks.value = fetchedTasks
    progress.value = fetchedProgress

    for (const task of fetchedTasks) {
      if (task.completion) {
        completionMap[task.id] = task.completion.status
      }
    }

    pageState.value = 'loaded'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      pageState.value = 'none'
    } else {
      errorMessage.value =
        error instanceof ApiError ? error.message : '주차 정보를 불러오지 못했습니다.'
      pageState.value = 'error'
    }
  }
}

async function handleCompleteTask(taskId: string, status: TaskCompletionStatus): Promise<void> {
  updatingTaskId.value = taskId
  delete taskError[taskId]

  try {
    const result = await completeTask(taskId, { status })
    completionMap[taskId] = result.status
  } catch (error) {
    taskError[taskId] = error instanceof ApiError ? error.message : '저장에 실패했습니다.'
  } finally {
    updatingTaskId.value = null
  }
}

async function handleUpdateProgress(status: MemberWeekProgressStatus): Promise<void> {
  if (!currentWeek.value) {
    return
  }

  isUpdatingProgress.value = true

  try {
    progress.value = await updateMyWeekProgress(currentWeek.value.id, { status })
  } catch {
    // 진행 상태 업데이트 실패 시 조용히 무시
  } finally {
    isUpdatingProgress.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(value),
  )
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
</script>

<template>
  <div class="grid gap-5">
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="이번 주 정보를 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="주차 정보를 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadAll"
    />

    <ScreenState
      v-else-if="pageState === 'none'"
      variant="empty"
      eyebrow="Todo"
      title="현재 진행 중인 주차가 없습니다."
      description="스터디가 시작되면 이번 주 과제가 여기에 표시됩니다."
    />

    <template v-else-if="pageState === 'loaded' && currentWeek">
      <!-- 주차 정보 -->
      <section
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-[var(--color-primary)]">
              {{ currentWeek.weekNumber }}주차
            </p>
            <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">{{ currentWeek.title }}</h2>
            <p v-if="currentWeek.sprintGoal" class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              {{ currentWeek.sprintGoal }}
            </p>
          </div>

          <div v-if="progress" class="shrink-0 text-right text-sm">
            <p class="font-semibold text-[var(--color-ink)]">
              {{ PROGRESS_STATUS_LABEL[progress.status] }}
            </p>
            <div class="mt-2 flex flex-wrap justify-end gap-1">
              <button
                v-for="opt in (['IN_PROGRESS', 'COMPLETED', 'INCOMPLETE'] as MemberWeekProgressStatus[])"
                :key="opt"
                type="button"
                :disabled="isUpdatingProgress || progress.status === opt"
                :class="[
                  'inline-flex h-7 items-center rounded border px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]',
                  progress.status === opt
                    ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                ]"
                @click="handleUpdateProgress(opt)"
              >
                {{ PROGRESS_STATUS_LABEL[opt] }}
              </button>
            </div>
          </div>
        </div>

        <dl
          v-if="currentWeek.startsAt || currentWeek.endsAt"
          class="mt-5 grid gap-3 text-sm sm:grid-cols-2"
        >
          <div v-if="currentWeek.startsAt">
            <dt class="text-[var(--color-muted)]">시작일</dt>
            <dd class="mt-1 font-semibold text-[var(--color-ink)]">
              {{ formatDate(currentWeek.startsAt) }}
            </dd>
          </div>
          <div v-if="currentWeek.endsAt">
            <dt class="text-[var(--color-muted)]">종료일</dt>
            <dd class="mt-1 font-semibold text-[var(--color-ink)]">
              {{ formatDate(currentWeek.endsAt) }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- 과제 목록 -->
      <section
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">과제 목록</h3>

        <ul v-if="tasks.length > 0" class="mt-4 grid gap-4">
          <li
            v-for="task in tasks"
            :key="task.id"
            class="rounded-md border border-[var(--color-line)] bg-white p-4"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded border border-[var(--color-line)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]"
                  >
                    {{ TASK_TYPE_LABEL[task.taskType] ?? task.taskType }}
                  </span>
                  <span
                    v-if="task.required"
                    class="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                  >
                    필수
                  </span>
                  <span
                    :class="[
                      'rounded px-2 py-0.5 text-xs font-semibold',
                      getCompletionStatus(task) === 'DONE'
                        ? 'bg-green-100 text-green-700'
                        : getCompletionStatus(task) === 'SKIPPED'
                          ? 'bg-[var(--color-card)] text-[var(--color-muted)]'
                          : getCompletionStatus(task) === 'INCOMPLETE'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-[var(--color-card)] text-[var(--color-muted)]',
                    ]"
                  >
                    {{
                      getCompletionStatus(task) === 'DONE'
                        ? '완료'
                        : getCompletionStatus(task) === 'SKIPPED'
                          ? '스킵'
                          : getCompletionStatus(task) === 'INCOMPLETE'
                            ? '미완료'
                            : '미시작'
                    }}
                  </span>
                </div>

                <p class="mt-2 font-semibold text-[var(--color-ink)]">{{ task.title }}</p>
                <p
                  v-if="task.description"
                  class="mt-1 text-sm leading-6 text-[var(--color-muted)]"
                >
                  {{ task.description }}
                </p>
                <p v-if="task.dueAt" class="mt-1 text-xs text-[var(--color-muted)]">
                  마감: {{ formatDateTime(task.dueAt) }}
                </p>
              </div>

              <div class="flex shrink-0 flex-wrap gap-1 sm:flex-col">
                <button
                  v-for="action in COMPLETION_ACTIONS"
                  :key="action.status"
                  type="button"
                  :disabled="updatingTaskId === task.id || getCompletionStatus(task) === action.status"
                  :class="[
                    'inline-flex h-8 items-center justify-center rounded border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50',
                    getCompletionStatus(task) === action.status
                      ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                      : 'border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                  ]"
                  @click="handleCompleteTask(task.id, action.status)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>

            <p v-if="taskError[task.id]" role="alert" class="mt-2 text-xs font-semibold text-red-700">
              {{ taskError[task.id] }}
            </p>
          </li>
        </ul>

        <p v-else class="mt-4 text-sm text-[var(--color-muted)]">과제가 없습니다.</p>
      </section>
    </template>
  </div>
</template>
