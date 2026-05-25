<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import {
  getCurriculum,
  startStudy,
  type Curriculum,
  type CurriculumWeekStatus,
} from '@/entities/curriculum'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const WEEK_STATUS_LABEL: Record<CurriculumWeekStatus, string> = {
  PENDING: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
}

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupCurriculumPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'curriculum' | 'none' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const curriculum = ref<Curriculum | null>(null)
const isStarting = ref(false)
const startError = ref('')

onMounted(() => {
  void loadCurriculum()
})

async function loadCurriculum(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    curriculum.value = await getCurriculum(groupId.value)
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
      class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">커리큘럼</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">아직 커리큘럼이 없습니다</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        온보딩이 완료되면 스터디를 시작해 커리큘럼을 생성할 수 있습니다.
      </p>

      <p v-if="startError" role="alert" class="mt-4 text-sm font-semibold text-red-700">
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
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
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
        v-if="curriculum.weeks && curriculum.weeks.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">주차 목록</h3>

        <ul class="mt-4 grid gap-3">
          <li
            v-for="week in curriculum.weeks"
            :key="week.id"
            class="flex items-center justify-between rounded-md border border-[var(--color-line)] bg-white px-4 py-3 text-sm"
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
                    ? 'border-[var(--color-line)] bg-white text-[var(--color-muted)]'
                    : 'border-[var(--color-line)] bg-white text-[var(--color-muted)]',
              ]"
            >
              {{ WEEK_STATUS_LABEL[week.status] }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
