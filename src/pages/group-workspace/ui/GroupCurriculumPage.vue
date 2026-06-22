<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import {
  getCurriculum,
  getWeek,
  listCurriculumWeeks,
  listWeeklyTasks,
  startStudy,
  type Curriculum,
  type CurriculumWeek,
  type CurriculumWeekStatus,
  type WeeklyTask,
  type WeeklyTaskType,
} from '@/entities/curriculum'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const WEEK_STATUS_LABEL: Record<CurriculumWeekStatus, string> = {
  PENDING: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
}

const TASK_TYPE_LABEL: Record<WeeklyTaskType, string> = {
  READING: '읽기',
  PRACTICE: '실습',
  ASSIGNMENT: '과제',
  PROJECT: '프로젝트',
  CUSTOM: '기타',
}

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupCurriculumPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'curriculum' | 'none' | 'error'
type WeekDetailState = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const curriculum = ref<Curriculum | null>(null)
const weeks = ref<CurriculumWeek[]>([])
const isStarting = ref(false)
const startError = ref('')

const selectedWeekId = ref<string | null>(null)
const weekDetail = ref<CurriculumWeek | null>(null)
const weekTasks = ref<WeeklyTask[]>([])
const weekDetailState = ref<WeekDetailState>('idle')
const weekDetailError = ref('')

onMounted(() => {
  void loadCurriculum()
})

async function loadCurriculum(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    const [curr, weekList] = await Promise.all([
      getCurriculum(groupId.value),
      listCurriculumWeeks(groupId.value).catch(() => [] as CurriculumWeek[]),
    ])
    curriculum.value = curr
    weeks.value = weekList
    pageState.value = 'curriculum'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      pageState.value = 'none'
    } else {
      errorMessage.value =
        error instanceof ApiError ? error.message : '커리큘럼을 불러오지 못했습니다.'
      pageState.value = 'error'
    }
  }
}

async function handleStartStudy(): Promise<void> {
  isStarting.value = true
  startError.value = ''

  try {
    curriculum.value = await startStudy(groupId.value)
    pageState.value = 'curriculum'
  } catch (error) {
    startError.value = error instanceof ApiError ? error.message : '스터디 시작에 실패했습니다.'
  } finally {
    isStarting.value = false
  }
}

async function selectWeek(weekId: string): Promise<void> {
  if (selectedWeekId.value === weekId) {
    selectedWeekId.value = null
    weekDetailState.value = 'idle'
    weekDetail.value = null
    weekTasks.value = []
    return
  }

  selectedWeekId.value = weekId
  await loadWeekDetail(weekId)
}

async function loadWeekDetail(weekId: string): Promise<void> {
  weekDetailState.value = 'loading'
  weekDetailError.value = ''
  weekDetail.value = null
  weekTasks.value = []

  try {
    const [week, tasks] = await Promise.all([getWeek(weekId), listWeeklyTasks(weekId)])
    weekDetail.value = week
    weekTasks.value = tasks
    weekDetailState.value = 'loaded'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      weekDetailState.value = 'not-found'
    } else {
      weekDetailError.value =
        error instanceof ApiError ? error.message : '주차 정보를 불러오지 못했습니다.'
      weekDetailState.value = 'error'
    }
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(value),
  )
}
</script>

<template>
  <div class="grid gap-5">
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="커리큘럼을 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="커리큘럼을 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadCurriculum"
    />

    <section
      v-else-if="pageState === 'none'"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">커리큘럼</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">아직 커리큘럼이 없어요</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        온보딩이 완료되면 스터디를 시작해 커리큘럼을 생성할 수 있어요.
      </p>

      <p v-if="startError" role="alert" class="mt-4 text-sm font-semibold text-[var(--color-danger)]">
        {{ startError }}
      </p>

      <button
        type="button"
        :disabled="isStarting"
        class="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
        @click="handleStartStudy"
      >
        {{ isStarting ? '생성 중…' : '스터디 시작' }}
      </button>
    </section>

    <template v-else-if="pageState === 'curriculum' && curriculum">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">커리큘럼</p>
        <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">{{ curriculum.title }}</h2>

        <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-[var(--color-muted)]">총 주차</dt>
            <dd class="mt-1 font-semibold text-[var(--color-ink)]">{{ curriculum.totalWeeks }}주</dd>
          </div>
          <div>
            <dt class="text-[var(--color-muted)]">상태</dt>
            <dd class="mt-1 font-semibold text-[var(--color-ink)]">
              {{
                curriculum.status === 'ACTIVE'
                  ? '진행 중'
                  : curriculum.status === 'COMPLETED'
                    ? '완료'
                    : '준비 중'
              }}
            </dd>
          </div>
        </dl>
      </section>

      <section
        v-if="weeks.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">주차 목록</h3>

        <ul class="mt-4 grid gap-3">
          <li
            v-for="week in weeks"
            :key="week.id"
            class="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)]"
          >
            <button
              type="button"
              :aria-expanded="selectedWeekId === week.id"
              :aria-controls="`week-detail-${week.id}`"
              class="flex w-full items-center justify-between px-4 py-3 text-sm text-left"
              @click="selectWeek(week.id)"
            >
              <div class="min-w-0">
                <span class="font-semibold text-[var(--color-muted)]">{{ week.weekNumber }}주차</span>
                <span class="ml-2 font-semibold text-[var(--color-ink)]">{{ week.title }}</span>
              </div>
              <span
                :class="[
                  'ml-4 shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold',
                  week.status === 'IN_PROGRESS'
                    ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                    : week.status === 'COMPLETED'
                      ? 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)]'
                      : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)]',
                ]"
              >
                {{ WEEK_STATUS_LABEL[week.status] }}
              </span>
            </button>

            <div
              v-if="selectedWeekId === week.id"
              :id="`week-detail-${week.id}`"
              class="border-t border-[var(--color-line)] px-4 pb-4 pt-3"
            >
              <p
                v-if="weekDetailState === 'loading'"
                class="text-sm text-[var(--color-muted)]"
                role="status"
              >
                주차 상세 정보를 불러오는 중입니다…
              </p>

              <p
                v-else-if="weekDetailState === 'not-found'"
                role="alert"
                class="text-sm font-semibold text-[var(--color-danger)]"
              >
                해당 주차 정보를 찾을 수 없어요. (404)
              </p>

              <div v-else-if="weekDetailState === 'error'" class="flex items-center gap-3">
                <p role="alert" class="text-sm text-[var(--color-danger)]">
                  {{ weekDetailError || '주차 정보를 불러오지 못했습니다.' }}
                </p>
                <button
                  type="button"
                  class="text-xs font-semibold text-[var(--color-primary)] underline"
                  @click="loadWeekDetail(week.id)"
                >
                  다시 시도
                </button>
              </div>

              <template v-else-if="weekDetailState === 'loaded' && weekDetail">
                <dl class="grid gap-2 text-sm sm:grid-cols-3">
                  <div v-if="weekDetail.sprintGoal">
                    <dt class="text-[var(--color-muted)]">스프린트 목표</dt>
                    <dd class="mt-0.5 font-medium text-[var(--color-ink)]">{{ weekDetail.sprintGoal }}</dd>
                  </div>
                  <div v-if="weekDetail.startsAt">
                    <dt class="text-[var(--color-muted)]">시작일</dt>
                    <dd class="mt-0.5 font-medium text-[var(--color-ink)]">{{ formatDate(weekDetail.startsAt) }}</dd>
                  </div>
                  <div v-if="weekDetail.endsAt">
                    <dt class="text-[var(--color-muted)]">종료일</dt>
                    <dd class="mt-0.5 font-medium text-[var(--color-ink)]">{{ formatDate(weekDetail.endsAt) }}</dd>
                  </div>
                </dl>

                <div v-if="weekTasks.length > 0" class="mt-4">
                  <h4 class="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">과제 목록</h4>
                  <ul class="mt-2 grid gap-2">
                    <li
                      v-for="task in weekTasks"
                      :key="task.id"
                      class="flex items-start gap-3 rounded-md bg-[var(--color-bg)] px-3 py-2.5 text-sm"
                    >
                      <span
                        class="shrink-0 rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]"
                      >
                        {{ TASK_TYPE_LABEL[task.taskType] }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="font-medium text-[var(--color-ink)]">{{ task.title }}</p>
                        <p v-if="task.description" class="mt-0.5 text-xs text-[var(--color-muted)]">
                          {{ task.description }}
                        </p>
                      </div>
                      <span
                        v-if="task.required"
                        class="shrink-0 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-xs font-semibold text-white"
                      >
                        필수
                      </span>
                    </li>
                  </ul>
                </div>

                <p v-else class="mt-3 text-sm text-[var(--color-muted)]">등록된 과제가 없어요.</p>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
