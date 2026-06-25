<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'

import { getCurriculum, listWeeklyTasks } from '@/entities/curriculum'
import {
  getMyRetrospective,
  getRetrospectiveOverview,
  submitRetrospective,
  type RetrospectiveAnswer,
  type RetrospectiveWeekOverview,
} from '@/entities/retrospective'
import { useInAppNotificationStore } from '@/features/notification'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) {
  throw new Error('GroupRetrospectivePage must be used inside GroupWorkspacePage.')
}
const { groupId, group } = workspaceContext
const toastStore = useInAppNotificationStore()

// 완료(또는 보관)된 스터디는 회고가 읽기전용이다. 미제출 주차는 '미제출'로 표시하고 작성/제출을 막는다.
const isCompleted = computed(
  () => group.value?.status === 'COMPLETED' || group.value?.status === 'ARCHIVED',
)

type PageState = 'loading' | 'empty' | 'ready' | 'error'

// 5점 리커트 라벨 (1 그렇지 않다 … 5 그렇다)
const LIKERT_LABELS = ['그렇지 않다', '약간 그렇지 않다', '보통', '약간 그렇다', '그렇다']
const LIKERT_SIZES = ['h-14 w-14', 'h-11 w-11', 'h-9 w-9', 'h-11 w-11', 'h-14 w-14'] as const

// 제출 답변(읽기) 라벨 칩 색
function likertChipClass(score: number | null): string {
  switch (score) {
    case 5:
      return 'bg-[var(--color-primary)] text-white'
    case 4:
      return 'bg-[var(--color-tint-50)] text-[var(--color-primary-text)]'
    case 3:
      return 'bg-[var(--color-active)] text-[var(--color-muted)]'
    case 2:
      return 'bg-[rgba(255,176,32,0.18)] text-[#9a6a00]'
    case 1:
      return 'bg-[rgba(255,82,71,0.15)] text-[var(--color-danger)]'
    default:
      return 'bg-[var(--color-active)] text-[var(--color-muted)]'
  }
}

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const weeks = ref<RetrospectiveWeekOverview[]>([])
const totalWeeks = ref(0)
const selectedWeekId = ref<string | null>(null)

// 커리큘럼은 주차마다 점진 생성되므로 overview 에는 생성된 주차만 온다.
// 전체 계획 주차(totalWeeks)까지 아직 생성되지 않은 미래 주차를 잠금 슬롯으로 함께 보여준다.
const displayWeeks = computed<RetrospectiveWeekOverview[]>(() => {
  const byNumber = new Map(weeks.value.map((w) => [w.weekNumber, w]))
  const count = Math.max(totalWeeks.value, weeks.value.length)
  return Array.from({ length: count }, (_, i) => {
    const weekNumber = i + 1
    return (
      byNumber.get(weekNumber) ?? {
        weekId: `placeholder-${weekNumber}`,
        weekNumber,
        status: 'PENDING',
        unlocked: false,
        answered: false,
        reportPosted: false,
        questions: [],
      }
    )
  })
})

const scoreAnswers = reactive<Record<string, number>>({})
const textAnswers = reactive<Record<string, string>>({})
const submittedAnswers = ref<RetrospectiveAnswer[] | null>(null)
const taskProgress = ref<{ done: number; total: number } | null>(null)
const isSubmitting = ref(false)
const submitError = ref('')

const selectedWeek = computed<RetrospectiveWeekOverview | null>(
  () => displayWeeks.value.find((w) => w.weekId === selectedWeekId.value) ?? null,
)

const questionMode = computed<'interactive' | 'readonly' | 'locked' | 'missed'>(() => {
  const w = selectedWeek.value
  if (!w) return 'locked'
  if (w.answered) return 'readonly'
  // 완료된 스터디인데 제출 안 했으면 '미제출'(작성 불가)
  if (isCompleted.value) return 'missed'
  if (!w.unlocked) return 'locked'
  return 'interactive'
})

const likertQuestionCount = computed(
  () => selectedWeek.value?.questions.filter((q) => q.type === 'LIKERT_5').length ?? 0,
)

onMounted(() => void loadOverview())

// 주차 리포트가 게시되면(주차 종료 전 전원 회고 완료 포함) LEADER_REPORT_POSTED 알림이 온다.
// 그때 overview 의 reportPosted 가 갱신되도록 주차 목록만 다시 불러와 '보러 가기'가 즉시 뜨게 한다.
watch(
  () => toastStore.lastEvent,
  (event) => {
    if (!event || event.notificationType !== 'LEADER_REPORT_POSTED') return
    const eventGroupId =
      event.groupId ??
      (event.payload?.groupId as string | undefined) ??
      event.relatedResourceIds?.groupId
    if (eventGroupId === groupId.value) void refreshWeeks()
  },
)

async function refreshWeeks(): Promise<void> {
  try {
    const overview = await getRetrospectiveOverview(groupId.value)
    weeks.value = [...overview].sort((a, b) => a.weekNumber - b.weekNumber)
  } catch {
    // 갱신 실패는 무시(다음 진입 시 재조회)
  }
}

async function loadOverview(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    const [overview, curriculum] = await Promise.all([
      getRetrospectiveOverview(groupId.value),
      getCurriculum(groupId.value).catch(() => null),
    ])
    weeks.value = [...overview].sort((a, b) => a.weekNumber - b.weekNumber)
    totalWeeks.value = curriculum?.totalWeeks ?? weeks.value.length
    if (weeks.value.length === 0) {
      pageState.value = 'empty'
      return
    }
    await selectWeek(defaultWeek())
    pageState.value = 'ready'
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '회고 정보를 불러오지 못했습니다.'
    pageState.value = 'error'
  }
}

// 현재(진행 중) 주차 우선, 없으면 마지막 열린 주차, 그것도 없으면 첫 주차.
function defaultWeek(): RetrospectiveWeekOverview {
  const inProgress = weeks.value.find((w) => w.status === 'IN_PROGRESS')
  if (inProgress) return inProgress
  const lastUnlocked = [...weeks.value].reverse().find((w) => w.unlocked)
  return lastUnlocked ?? weeks.value[0]!
}

async function selectWeek(week: RetrospectiveWeekOverview): Promise<void> {
  selectedWeekId.value = week.weekId
  submitError.value = ''
  Object.keys(scoreAnswers).forEach((k) => delete scoreAnswers[k])
  Object.keys(textAnswers).forEach((k) => delete textAnswers[k])
  submittedAnswers.value = null
  taskProgress.value = null

  if (week.answered) {
    await loadSubmitted(week.weekId)
  } else if (!week.unlocked) {
    await loadTaskProgress(week.weekId)
  }
}

async function loadSubmitted(weekId: string): Promise<void> {
  try {
    const retro = await getMyRetrospective(weekId)
    submittedAnswers.value = (retro.answers ?? []) as RetrospectiveAnswer[]
  } catch {
    submittedAnswers.value = []
  }
}

async function loadTaskProgress(weekId: string): Promise<void> {
  try {
    const tasks = await listWeeklyTasks(weekId)
    const countable = tasks.filter((t) => t.completion?.status !== 'SKIPPED')
    const done = countable.filter((t) => t.completion?.status === 'DONE').length
    taskProgress.value = { done, total: countable.length }
  } catch {
    taskProgress.value = null
  }
}

function submittedScore(questionId: string): number | null {
  const found = (submittedAnswers.value ?? []).find((a) => a.questionId === questionId)
  return found?.score ?? null
}

function submittedText(questionId: string): string {
  const found = (submittedAnswers.value ?? []).find((a) => a.questionId === questionId)
  return found?.text ?? '-'
}

function scoreOf(questionId: string): number | null {
  return questionMode.value === 'readonly'
    ? submittedScore(questionId)
    : (scoreAnswers[questionId] ?? null)
}

function setScore(questionId: string, value: number): void {
  if (questionMode.value !== 'interactive') return
  scoreAnswers[questionId] = value
}

const canSubmit = computed(() => questionMode.value === 'interactive')

async function handleSubmit(): Promise<void> {
  const week = selectedWeek.value
  if (!week) return

  const answers: RetrospectiveAnswer[] = week.questions.map((q) =>
    q.type === 'LIKERT_5'
      ? { questionId: q.id, score: scoreAnswers[q.id] ?? null }
      : { questionId: q.id, text: (textAnswers[q.id] ?? '').trim() || null },
  )

  const unanswered = week.questions.some((q) =>
    q.type === 'LIKERT_5' ? scoreAnswers[q.id] == null : !(textAnswers[q.id] ?? '').trim(),
  )
  if (unanswered) {
    submitError.value = '모든 질문에 답해 주세요.'
    return
  }

  isSubmitting.value = true
  submitError.value = ''
  try {
    await submitRetrospective(week.weekId, answers)
    week.answered = true
    submittedAnswers.value = answers
    toastStore.pushToast(
      '회고를 제출했어요',
      `${week.weekNumber}주차 회고가 저장되었습니다.`,
      'success',
    )
  } catch (error) {
    submitError.value = error instanceof ApiError ? error.message : '회고 제출에 실패했습니다.'
    toastStore.pushToast('회고 제출 실패', submitError.value, 'error')
  } finally {
    isSubmitting.value = false
  }
}

// 칩 상태/스타일 — 잠긴(미시작/미생성) 주차도 클릭은 되고, 안에서 잠금 안내를 보여준다.

function chipClasses(week: RetrospectiveWeekOverview): string {
  const selected = week.weekId === selectedWeekId.value
  // 완료된 스터디에서 미제출 주차는 흐리게(작성 불가) 표시
  if (isCompleted.value && !week.answered) {
    return selected
      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-faint)]'
  }
  if (!week.unlocked) {
    const dashed = week.weekId.startsWith('placeholder-') ? 'border-dashed ' : ''
    return selected
      ? `${dashed}border-[var(--color-primary)] bg-[var(--color-primary)] text-white`
      : `${dashed}border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-faint)] hover:border-[var(--color-line-strong)]`
  }
  if (week.answered) {
    return selected
      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
      : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]'
  }
  return selected
    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
    : 'border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-primary)]'
}
</script>

<template>
  <div class="grid gap-4">
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="회고를 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="회고를 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadOverview"
    />

    <ScreenState
      v-else-if="pageState === 'empty'"
      variant="empty"
      title="아직 커리큘럼이 없어요"
      description="스터디가 시작되면 주차별 회고를 작성할 수 있어요."
    />

    <template v-else-if="pageState === 'ready'">
      <!-- 주차별 회고 (칩) -->
      <section
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-bold text-[var(--color-ink)]">주차별 회고</h2>
          <p class="text-xs text-[var(--color-muted)]">할 일을 모두 끝낸 주차만 열려요</p>
        </div>

        <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="week in displayWeeks"
            :key="week.weekId"
            type="button"
            class="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-input)] border text-sm font-bold transition"
            :class="chipClasses(week)"
            @click="selectWeek(week)"
          >
            <svg
              v-if="week.answered"
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
              v-else-if="isCompleted"
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            <svg
              v-else-if="!week.unlocked"
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
            <span>{{ week.weekNumber }}주</span>
          </button>
        </div>
      </section>

      <!-- 미제출 안내 (완료된 스터디에서 작성하지 않은 주차) -->
      <div
        v-if="questionMode === 'missed'"
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <p class="font-bold text-[var(--color-ink)]">이 주차 회고를 작성하지 않았어요</p>
        <p class="text-sm text-[var(--color-muted)]">
          스터디가 완료되어 더 이상 회고를 작성할 수 없어요.
        </p>
      </div>

      <!-- 잠김 안내 (아직 시작/미완료로 잠긴 주차에만. 제출완료(readonly)·미제출(missed)·리포트 게시 후엔 안 뜸) -->
      <div
        v-if="questionMode === 'locked'"
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
        <p class="font-bold text-[var(--color-ink)]">아직 시작되지 않은 주차에요</p>
        <p v-if="selectedWeek?.status === 'PENDING'" class="text-sm text-[var(--color-muted)]">
          이 주차는 이전 주차가 끝나면 순서대로 공개돼요.
        </p>
        <template v-else>
          <p class="text-sm text-[var(--color-muted)]">
            이번 주 할 일을 모두 완료하면 회고가 열려요.<template v-if="taskProgress">
              ({{ taskProgress.done }}/{{ taskProgress.total }} 완료)</template
            >
          </p>
          <RouterLink
            :to="{ name: 'group-todo', params: { groupId } }"
            class="mt-1 inline-flex h-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 text-sm font-bold text-white transition hover:bg-[var(--color-primary-deep)]"
          >
            할 일 하러 가기
          </RouterLink>
        </template>
      </div>

      <!-- AI 주간 리포트가 아직 발행 전: 대기 안내 (제출은 했지만 주차 미종료/리포트 미게시) -->
      <div
        v-if="selectedWeek && selectedWeek.answered && !selectedWeek.reportPosted"
        class="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-active)] text-[var(--color-muted)]"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <span>
          <span class="block font-bold text-[var(--color-ink)]">회고 제출 완료</span>
          <span class="block text-sm text-[var(--color-muted)]">
            팀원 모두 회고를 마치거나 주차가 끝나면 AI 주간 리포트가 생성돼요. 조금만 기다려 주세요.
          </span>
        </span>
      </div>

      <!-- AI 주간 리포트 발행 완료 → 보러 가기 -->
      <RouterLink
        v-if="selectedWeek && selectedWeek.reportPosted"
        :to="{ name: 'group-board', params: { groupId } }"
        class="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-tint-200)] bg-[var(--color-tint-50)] p-4 transition hover:brightness-[0.98]"
      >
        <span class="flex items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 15l-1.6-5L6 8.4l4.4-1.6L12 2z" />
            </svg>
          </span>
          <span>
            <span class="block font-bold text-[var(--color-ink)]">
              {{ selectedWeek.weekNumber }}주차 AI 주간 리포트가 발행됐어요
            </span>
            <span class="block text-sm text-[var(--color-muted)]">
              게시판 · 팀장 리포트에서 전체 리포트를 확인하세요
            </span>
          </span>
        </span>
        <svg
          class="h-5 w-5 shrink-0 text-[var(--color-primary)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </RouterLink>

      <!-- 질문 리스트 -->
      <section
        v-if="selectedWeek && selectedWeek.questions.length > 0 && questionMode !== 'missed'"
        class="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        :class="questionMode === 'locked' ? 'opacity-60' : ''"
      >
        <div class="mb-3">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-bold text-[var(--color-ink)]">
              <template v-if="questionMode === 'readonly'"
                >{{ selectedWeek.weekNumber }}주차 내 회고</template
              >
              <template v-else-if="questionMode === 'interactive'"
                >{{ selectedWeek.weekNumber }}주차 회고 작성</template
              >
              <template v-else>AI가 미리 만든 회고 질문</template>
            </h3>
            <span
              v-if="questionMode === 'readonly'"
              class="inline-flex h-6 items-center rounded-[var(--radius-chip)] bg-[var(--color-tint-50)] px-2.5 text-xs font-bold text-[var(--color-primary-text)]"
            >
              제출 완료
            </span>
            <p v-else class="text-xs text-[var(--color-muted)]">
              {{ likertQuestionCount }}문항 · 5점 척도
            </p>
          </div>
          <p v-if="questionMode === 'readonly'" class="mt-1 text-sm text-[var(--color-muted)]">
            내가 제출한 답변이에요. 팀 집계는 AI 주간 리포트에 반영됩니다.
          </p>
        </div>

        <ul
          class="divide-y divide-[var(--color-line)]"
          :class="
            questionMode === 'locked'
              ? 'pointer-events-none max-h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,black_30%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_30%,transparent)]'
              : ''
          "
        >
          <li v-for="(question, qi) in selectedWeek.questions" :key="question.id" class="py-3.5">
            <!-- 리커트 -->
            <div
              v-if="question.type === 'LIKERT_5'"
              class="flex flex-col gap-3"
            >
              <p class="flex min-w-0 items-start gap-2.5 text-base font-semibold text-[var(--color-ink)]">
                <span
                  class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel)] text-[11px] font-bold text-[var(--color-muted)]"
                >
                  {{ qi + 1 }}
                </span>
                <span>{{ question.text }}</span>
              </p>
              <!-- 제출 완료: 답변 라벨 칩 -->
              <span
                v-if="questionMode === 'readonly'"
                class="ml-7 w-fit rounded-[var(--radius-chip)] px-3 py-1 text-xs font-bold"
                :class="likertChipClass(scoreOf(question.id))"
              >
                {{ scoreOf(question.id) ? LIKERT_LABELS[scoreOf(question.id)! - 1] : '-' }}
              </span>
              <!-- 작성/미리보기: 5점 척도 -->
              <div v-else class="flex items-center gap-4 pl-7">
                <span class="shrink-0 text-sm text-[var(--color-muted)]">{{ LIKERT_LABELS[0] }}</span>
                <div class="flex items-center gap-4">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    :disabled="questionMode !== 'interactive'"
                    class="shrink-0 rounded-full border-2 border-[var(--color-primary)] transition disabled:cursor-default"
                    :class="[
                      LIKERT_SIZES[n - 1],
                      scoreOf(question.id) === n
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-transparent hover:bg-[var(--color-tint-50)]'
                    ]"
                    :title="LIKERT_LABELS[n - 1]"
                    :aria-label="`${qi + 1}번 ${LIKERT_LABELS[n - 1]}`"
                    @click="setScore(question.id, n)"
                  />
                </div>
                <span class="shrink-0 text-sm text-[var(--color-muted)]">{{ LIKERT_LABELS[4] }}</span>
              </div>
            </div>

            <!-- 자유서술 -->
            <div v-else>
              <p class="flex items-start gap-2.5 text-base font-semibold text-[var(--color-ink)]">
                <span
                  class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel)] text-[11px] font-bold text-[var(--color-muted)]"
                >
                  {{ qi + 1 }}
                </span>
                <span>{{ question.text }}</span>
              </p>
              <textarea
                v-if="questionMode === 'interactive'"
                v-model="textAnswers[question.id]"
                rows="3"
                placeholder="자유롭게 작성해 주세요."
                class="mt-2 w-full rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-input)] p-3 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              <p
                v-else-if="questionMode === 'readonly'"
                class="mt-2 pl-7 text-sm leading-6 text-[var(--color-body)]"
              >
                {{ submittedText(question.id) }}
              </p>
            </div>
          </li>
        </ul>

        <template v-if="canSubmit">
          <p
            v-if="submitError"
            role="alert"
            class="mt-4 text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ submitError }}
          </p>
          <button
            type="button"
            :disabled="isSubmitting"
            class="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] px-6 text-sm font-bold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
            @click="handleSubmit"
          >
            {{ isSubmitting ? '제출 중…' : '회고 제출' }}
          </button>
        </template>
      </section>
    </template>
  </div>
</template>
