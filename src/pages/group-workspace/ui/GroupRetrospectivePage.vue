<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'

import {
  getMyRetrospective,
  getRetrospectiveOverview,
  submitRetrospective,
  type RetrospectiveAnswer,
  type RetrospectiveWeekOverview,
} from '@/entities/retrospective'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupRetrospectivePage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'empty' | 'ready' | 'error'

// 리커트 5점 척도 (5=매우 그렇다 … 1=매우 아니다)
const LIKERT_OPTIONS = [
  { score: 5, label: '매우 그렇다' },
  { score: 4, label: '그렇다' },
  { score: 3, label: '보통' },
  { score: 2, label: '아니다' },
  { score: 1, label: '매우 아니다' },
]

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const weeks = ref<RetrospectiveWeekOverview[]>([])
const selectedWeekId = ref<string | null>(null)

// 작성 폼 상태: questionId -> score(리커트) | text(서술)
const scoreAnswers = ref<Record<string, number>>({})
const textAnswers = ref<Record<string, string>>({})
const submittedAnswers = ref<RetrospectiveAnswer[] | null>(null)
const isSubmitting = ref(false)
const submitError = ref('')

const selectedWeek = computed<RetrospectiveWeekOverview | null>(
  () => weeks.value.find((week) => week.weekId === selectedWeekId.value) ?? null,
)

onMounted(() => {
  void loadOverview()
})

async function loadOverview(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    const overview = await getRetrospectiveOverview(groupId.value)
    weeks.value = [...overview].sort((a, b) => a.weekNumber - b.weekNumber)
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

// 열려있고 미작성인 가장 최근 주차 우선, 없으면 열린 마지막 주차, 그것도 없으면 첫 주차.
function defaultWeek(): RetrospectiveWeekOverview {
  const openUnanswered = [...weeks.value].reverse().find((week) => week.unlocked && !week.answered)
  if (openUnanswered) return openUnanswered
  const openLatest = [...weeks.value].reverse().find((week) => week.unlocked)
  return openLatest ?? weeks.value[0]!
}

async function selectWeek(week: RetrospectiveWeekOverview): Promise<void> {
  selectedWeekId.value = week.weekId
  submitError.value = ''
  scoreAnswers.value = {}
  textAnswers.value = {}
  submittedAnswers.value = null
  if (week.answered) {
    await loadSubmitted(week.weekId)
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

function answerText(questionId: string): string {
  const found = (submittedAnswers.value ?? []).find((answer) => answer.questionId === questionId)
  if (!found) return '-'
  if (found.score != null) {
    return (
      LIKERT_OPTIONS.find((option) => option.score === found.score)?.label ?? String(found.score)
    )
  }
  return found.text ?? '-'
}

const canSubmit = computed(
  () => !!selectedWeek.value && selectedWeek.value.unlocked && !selectedWeek.value.answered,
)

async function handleSubmit(): Promise<void> {
  const week = selectedWeek.value
  if (!week) return

  const answers: RetrospectiveAnswer[] = week.questions.map((question) =>
    question.type === 'LIKERT_5'
      ? { questionId: question.id, score: scoreAnswers.value[question.id] ?? null }
      : { questionId: question.id, text: (textAnswers.value[question.id] ?? '').trim() || null },
  )

  const unanswered = week.questions.some((question) =>
    question.type === 'LIKERT_5'
      ? scoreAnswers.value[question.id] == null
      : !(textAnswers.value[question.id] ?? '').trim(),
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
  } catch (error) {
    submitError.value = error instanceof ApiError ? error.message : '회고 제출에 실패했습니다.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="grid gap-5">
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
      <!-- 주차 선택 (잠긴 주차는 비활성) -->
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">회고</p>
        <h2 class="mt-1 text-xl font-bold text-[var(--color-ink)]">주차별 회고</h2>
        <p class="mt-1 text-sm text-[var(--color-muted)]">
          그 주차의 TODO를 모두 완료하면 회고가 열려요.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="week in weeks"
            :key="week.weekId"
            type="button"
            :disabled="!week.unlocked"
            :title="week.unlocked ? '' : 'TODO를 모두 완료하면 열려요'"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="
              week.weekId === selectedWeekId
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            "
            @click="week.unlocked && selectWeek(week)"
          >
            {{ week.weekNumber }}주차
            <span v-if="!week.unlocked" aria-hidden="true">🔒</span>
            <span
              v-else-if="week.answered"
              class="h-1.5 w-1.5 rounded-full"
              :class="week.weekId === selectedWeekId ? 'bg-white' : 'bg-[var(--color-success)]'"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      <!-- 잠김 -->
      <section
        v-if="selectedWeek && !selectedWeek.unlocked"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 class="text-lg font-bold text-[var(--color-ink)]">🔒 아직 잠겨 있어요</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {{ selectedWeek.weekNumber }}주차의 TODO를 모두 완료하면 회고를 작성할 수 있어요.
        </p>
      </section>

      <!-- 작성 폼 (열림 + 미작성) -->
      <section
        v-else-if="selectedWeek && canSubmit"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 class="text-lg font-bold text-[var(--color-ink)]">
          {{ selectedWeek.weekNumber }}주차 회고 작성
        </h2>
        <p class="mt-1 text-sm text-[var(--color-muted)]">아래 질문에 솔직하게 답해 주세요.</p>

        <div class="mt-5 grid gap-6">
          <div v-for="(question, qi) in selectedWeek.questions" :key="question.id">
            <p class="text-sm font-semibold text-[var(--color-ink)]">
              {{ qi + 1 }}. {{ question.text }}
            </p>

            <div v-if="question.type === 'LIKERT_5'" class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="option in LIKERT_OPTIONS"
                :key="option.score"
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm transition"
                :class="
                  scoreAnswers[question.id] === option.score
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-primary)]'
                "
                @click="scoreAnswers[question.id] = option.score"
              >
                {{ option.label }}
              </button>
            </div>

            <textarea
              v-else
              v-model="textAnswers[question.id]"
              rows="3"
              placeholder="자유롭게 작성해 주세요."
              class="mt-3 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-input)] p-3 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>

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
          class="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
          @click="handleSubmit"
        >
          {{ isSubmitting ? '제출 중…' : '회고 제출' }}
        </button>
      </section>

      <!-- 작성 완료 (읽기 전용) -->
      <section
        v-else-if="selectedWeek"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 class="text-lg font-bold text-[var(--color-ink)]">
          {{ selectedWeek.weekNumber }}주차 회고 (제출 완료)
        </h2>
        <dl class="mt-4 grid gap-5">
          <div v-for="(question, qi) in selectedWeek.questions" :key="question.id">
            <dt class="text-sm font-semibold text-[var(--color-muted)]">
              {{ qi + 1 }}. {{ question.text }}
            </dt>
            <dd class="mt-1 text-sm leading-6 text-[var(--color-ink)]">
              {{ answerText(question.id) }}
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
