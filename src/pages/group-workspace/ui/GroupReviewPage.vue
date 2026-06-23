<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import { getMyGroupMemberProfile } from '@/entities/group'
import {
  createReview,
  getMyReview,
  updateMyReview,
  type RetroAnswers,
  type RetroQuestion,
  type Review,
} from '@/entities/review'
import questionsData from '@/entities/review/model/questions.json'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupReviewPage must be used inside GroupWorkspacePage.')
const { groupId } = workspaceContext

const QUESTIONS = questionsData.questions as RetroQuestion[]

type PageState = 'loading' | 'ready' | 'error'
type FormMode = 'view' | 'write' | 'edit'

const pageState = ref<PageState>('loading')
const pageError = ref('')
const formMode = ref<FormMode>('write')
const hasPendingTodos = ref(false)

const myReview = ref<Review | null>(null)
const answers = ref<RetroAnswers>({})
const isSubmitting = ref(false)
const submitError = ref('')
const validationErrors = ref<Record<string, string>>({})

onMounted(() => void loadPage())

async function loadPage(): Promise<void> {
  pageState.value = 'loading'
  pageError.value = ''

  try {
    const [profile] = await Promise.allSettled([getMyGroupMemberProfile(groupId.value)])
    if (profile.status === 'fulfilled') {
      hasPendingTodos.value = profile.value.taskCompletion.incompleteCount > 0
    }
  } catch {
    // 프로필 로드 실패 시 todo 체크 건너뜀
  }

  try {
    myReview.value = await getMyReview(groupId.value)
    formMode.value = 'view'
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      myReview.value = null
      formMode.value = 'write'
    } else {
      pageError.value = err instanceof ApiError ? err.message : '회고 정보를 불러오지 못했습니다.'
      pageState.value = 'error'
      return
    }
  }

  pageState.value = 'ready'
}

function startEdit(): void {
  if (!myReview.value) return
  answers.value = { ...myReview.value.answers }
  submitError.value = ''
  validationErrors.value = {}
  formMode.value = 'edit'
}

function cancelEdit(): void {
  formMode.value = 'view'
  submitError.value = ''
  validationErrors.value = {}
}

function validate(): boolean {
  const errors: Record<string, string> = {}
  for (const q of QUESTIONS) {
    if (!q.required) continue
    const val = answers.value[q.id]
    if (val === undefined || val === '' || (q.type === 'scale' && val === 0)) {
      errors[q.id] = '필수 항목입니다.'
    }
  }
  validationErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit(): Promise<void> {
  if (!validate()) return

  isSubmitting.value = true
  submitError.value = ''

  try {
    const request = { answers: answers.value }

    if (formMode.value === 'edit' && myReview.value) {
      myReview.value = await updateMyReview(groupId.value, request)
    } else {
      myReview.value = await createReview(groupId.value, request)
    }

    formMode.value = 'view'
    answers.value = {}
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      submitError.value = '이미 회고를 작성했습니다.'
      void loadPage()
    } else {
      submitError.value =
        error instanceof ApiError ? error.message : '저장에 실패했습니다. 다시 시도해 주세요.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
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
      :description="pageError"
      action-label="다시 시도"
      @action="loadPage"
    />

    <template v-else-if="pageState === 'ready'">
      <!-- Todo 미완료 차단 메시지 -->
      <section
        v-if="hasPendingTodos"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-10 text-center shadow-[var(--shadow-soft)]"
      >
        <p class="text-3xl">📝</p>
        <p class="mt-4 text-base font-bold text-[var(--color-ink)]">아직 완료하지 않은 Todo가 있어요</p>
        <p class="mt-2 text-sm text-[var(--color-muted)]">이번 주 할 일을 모두 완료한 뒤 회고를 작성할 수 있어요.</p>
        <RouterLink
          :to="{ name: 'group-todo', params: { groupId } }"
          class="mt-5 inline-flex h-9 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
        >
          Todo 완료하러 가기
        </RouterLink>
      </section>

      <section
        v-else
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-soft)]"
      >
        <!-- 헤더 -->
        <div class="flex items-start justify-between border-b border-[var(--color-line)] px-6 py-5">
          <div>
            <p class="text-sm font-semibold text-[var(--color-primary)]">스터디 회고</p>
            <h2 class="mt-0.5 text-xl font-bold text-[var(--color-ink)]">내 회고</h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              이번 주차를 돌아보고 솔직한 회고를 남겨보세요.
            </p>
          </div>
          <button
            v-if="formMode === 'view'"
            type="button"
            class="shrink-0 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            @click="startEdit"
          >
            수정
          </button>
        </div>

        <!-- 뷰 모드 -->
        <div v-if="formMode === 'view' && myReview" class="divide-y divide-[var(--color-line)]">
          <div v-for="q in QUESTIONS" :key="q.id" class="px-6 py-5">
            <p class="text-sm font-semibold text-[var(--color-ink)]">{{ q.label }}</p>

            <!-- scale 답변 표시 (뷰) -->
            <template v-if="q.type === 'scale'">
              <div class="mt-3 flex flex-col gap-1.5">
                <div class="flex items-center gap-4">
                  <div
                    v-for="(size, idx) in ['h-9 w-9', 'h-7 w-7', 'h-6 w-6', 'h-7 w-7', 'h-9 w-9']"
                    :key="idx"
                    class="flex w-9 justify-center"
                  >
                    <span
                      class="rounded-full border-2"
                      :class="[
                        size,
                        myReview.answers[q.id] === idx + 1
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                          : 'border-[var(--color-line-strong)] bg-[var(--color-card)]'
                      ]"
                    />
                  </div>
                </div>
                <div class="flex gap-4">
                  <span
                    v-for="idx in 5"
                    :key="idx"
                    class="flex w-9 justify-center text-[10px] text-[var(--color-muted)]"
                  >{{ idx }}</span>
                </div>
              </div>
            </template>

            <!-- text 답변 표시 -->
            <template v-else-if="q.type === 'text'">
              <p
                v-if="myReview.answers[q.id]"
                class="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-ink)]"
              >
                {{ myReview.answers[q.id] }}
              </p>
              <p v-else class="mt-2 text-sm text-[var(--color-muted-deep)]">작성하지 않음</p>
            </template>
          </div>

          <div class="px-6 py-4">
            <p class="text-xs text-[var(--color-muted)]">{{ formatDate(myReview.createdAt) }} 작성</p>
          </div>
        </div>

        <!-- 작성 / 수정 폼 -->
        <form v-else class="divide-y divide-[var(--color-line)]" @submit.prevent="handleSubmit">
          <div v-for="q in QUESTIONS" :key="q.id" class="px-6 py-5">
            <label class="block text-sm font-semibold text-[var(--color-ink)]">
              {{ q.label }}
              <span v-if="q.required" class="ml-0.5 text-[var(--color-danger)]">*</span>
            </label>

            <!-- scale 선택 -->
            <template v-if="q.type === 'scale'">
              <div class="mt-3 flex flex-col gap-1.5">
                <div class="flex items-center gap-4">
                  <div
                    v-for="(size, idx) in ['h-9 w-9', 'h-7 w-7', 'h-6 w-6', 'h-7 w-7', 'h-9 w-9']"
                    :key="idx"
                    class="flex w-9 justify-center"
                  >
                    <button
                      type="button"
                      class="rounded-full border-2 transition-colors focus:outline-none"
                      :class="[
                        size,
                        answers[q.id] === idx + 1
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                          : 'border-[var(--color-line-strong)] bg-[var(--color-card)] hover:border-[var(--color-primary)]'
                      ]"
                      @click="answers[q.id] = idx + 1"
                    />
                  </div>
                </div>
                <div class="flex gap-4">
                  <span
                    v-for="idx in 5"
                    :key="idx"
                    class="flex w-9 justify-center text-[10px] text-[var(--color-muted)]"
                  >{{ idx }}</span>
                </div>
              </div>
              <p
                v-if="validationErrors[q.id]"
                class="mt-1.5 text-xs font-semibold text-[var(--color-danger)]"
              >
                {{ validationErrors[q.id] }}
              </p>
            </template>

            <!-- text 입력 -->
            <template v-else-if="q.type === 'text'">
              <textarea
                v-model="(answers[q.id] as string)"
                :placeholder="'placeholder' in q ? q.placeholder : ''"
                rows="3"
                maxlength="500"
                class="mt-2 w-full resize-none rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
              />
              <p
                v-if="validationErrors[q.id]"
                class="mt-1 text-xs font-semibold text-[var(--color-danger)]"
              >
                {{ validationErrors[q.id] }}
              </p>
            </template>
          </div>

          <!-- 제출 -->
          <div class="flex items-center justify-end gap-3 px-6 py-5">
            <p
              v-if="submitError"
              role="alert"
              class="flex-1 text-sm font-semibold text-[var(--color-danger)]"
            >
              {{ submitError }}
            </p>
            <button
              v-if="formMode === 'edit'"
              type="button"
              class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] px-5 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              @click="cancelEdit"
            >
              취소
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
            >
              {{ isSubmitting ? '저장 중…' : formMode === 'edit' ? '수정 완료' : '회고 작성' }}
            </button>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>
