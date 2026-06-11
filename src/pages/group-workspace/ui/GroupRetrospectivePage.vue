<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import { getCurrentWeek } from '@/entities/curriculum'
import { getMyRetrospective, requestRetrospective, type Retrospective } from '@/entities/retrospective'
import { ApiError } from '@/shared/api'
import type { JsonValue } from '@/shared/model/json'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupRetrospectivePage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'none' | 'retrospective' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const retrospective = ref<Retrospective | null>(null)
const currentWeekId = ref<string | null>(null)
const isRequesting = ref(false)
const requestError = ref('')

onMounted(() => {
  void loadRetrospective()
})

async function loadRetrospective(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    const week = await getCurrentWeek(groupId.value)
    currentWeekId.value = week.id

    const retro = await getMyRetrospective(week.id)
    retrospective.value = retro
    pageState.value = 'retrospective'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      pageState.value = 'none'
    } else {
      errorMessage.value =
        error instanceof ApiError ? error.message : '회고 정보를 불러오지 못했습니다.'
      pageState.value = 'error'
    }
  }
}

async function handleRequest(): Promise<void> {
  if (!currentWeekId.value) {
    return
  }

  isRequesting.value = true
  requestError.value = ''

  try {
    retrospective.value = await requestRetrospective(currentWeekId.value)
    pageState.value = 'retrospective'
  } catch (error) {
    requestError.value = error instanceof ApiError ? error.message : '회고 요청에 실패했습니다.'
  } finally {
    isRequesting.value = false
  }
}

function renderJsonValue(value: JsonValue, depth = 0): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((v) => renderJsonValue(v, depth + 1)).join('\n')
  }

  return Object.entries(value)
    .map(([k, v]) => `${k}: ${renderJsonValue(v, depth + 1)}`)
    .join('\n')
}

function isStringArray(value: JsonValue): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isString(value: JsonValue): value is string {
  return typeof value === 'string'
}

function isPrimitive(value: JsonValue): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기 중',
  PROCESSING: '생성 중',
  COMPLETED: '완료',
  FAILED: '실패',
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
      @action="loadRetrospective"
    />

    <section
      v-else-if="pageState === 'none'"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">회고</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">아직 회고가 없어요</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        주차가 종료되면 회고를 요청할 수 있어요.
      </p>

      <p v-if="requestError" role="alert" class="mt-4 text-sm font-semibold text-[var(--color-danger)]">
        {{ requestError }}
      </p>

      <button
        v-if="currentWeekId"
        type="button"
        :disabled="isRequesting"
        class="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
        @click="handleRequest"
      >
        {{ isRequesting ? '요청 중…' : '회고 요청' }}
      </button>
    </section>

    <template v-else-if="pageState === 'retrospective' && retrospective">
      <!-- 상태 헤더 -->
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-[var(--color-primary)]">회고</p>
            <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">
              {{ STATUS_LABEL[retrospective.status] ?? retrospective.status }}
            </h2>

            <p
              v-if="retrospective.status === 'PROCESSING'"
              class="mt-3 text-sm leading-6 text-[var(--color-muted)]"
            >
              AI가 회고를 생성하고 있습니다. 잠시 후 새로고침해 주세요.
            </p>
            <p
              v-else-if="retrospective.status === 'FAILED'"
              class="mt-3 text-sm leading-6 text-[var(--color-danger)]"
            >
              회고 생성에 실패했습니다. 다시 요청하거나 잠시 후 시도해 주세요.
            </p>
          </div>

          <button
            v-if="retrospective.status === 'FAILED' && currentWeekId"
            type="button"
            :disabled="isRequesting"
            class="shrink-0 inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)] disabled:opacity-50"
            @click="handleRequest"
          >
            {{ isRequesting ? '요청 중…' : '다시 요청' }}
          </button>
        </div>
      </section>

      <!-- AI 피드백 -->
      <section
        v-if="retrospective.status === 'COMPLETED' && retrospective.aiFeedback"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">AI 피드백</h3>

        <dl class="mt-4 grid gap-5">
          <template v-for="(value, key) in retrospective.aiFeedback" :key="key">
            <div v-if="value !== null && value !== undefined">
              <dt class="text-sm font-semibold text-[var(--color-muted)] capitalize">{{ key }}</dt>
              <dd class="mt-2">
                <p
                  v-if="isPrimitive(value)"
                  class="text-sm leading-6 text-[var(--color-ink)]"
                >
                  {{ value }}
                </p>
                <ul v-else-if="isStringArray(value)" class="grid gap-1.5">
                  <li
                    v-for="(item, i) in value"
                    :key="i"
                    class="flex gap-2 text-sm leading-6 text-[var(--color-ink)]"
                  >
                    <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
                    {{ item }}
                  </li>
                </ul>
                <pre
                  v-else
                  class="rounded-md bg-[var(--color-card)] p-3 text-xs leading-6 text-[var(--color-ink)] whitespace-pre-wrap break-words"
                >{{ renderJsonValue(value) }}</pre>
              </dd>
            </div>
          </template>
        </dl>
      </section>

      <!-- 다음 주 조정 -->
      <section
        v-if="retrospective.status === 'COMPLETED' && retrospective.nextWeekAdjustment"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">다음 주 조정 제안</h3>

        <dl class="mt-4 grid gap-5">
          <template v-for="(value, key) in retrospective.nextWeekAdjustment" :key="key">
            <div v-if="value !== null && value !== undefined">
              <dt class="text-sm font-semibold text-[var(--color-muted)] capitalize">{{ key }}</dt>
              <dd class="mt-2">
                <p
                  v-if="isPrimitive(value)"
                  class="text-sm leading-6 text-[var(--color-ink)]"
                >
                  {{ value }}
                </p>
                <ul v-else-if="isStringArray(value)" class="grid gap-1.5">
                  <li
                    v-for="(item, i) in value"
                    :key="i"
                    class="flex gap-2 text-sm leading-6 text-[var(--color-ink)]"
                  >
                    <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
                    {{ item }}
                  </li>
                </ul>
                <pre
                  v-else
                  class="rounded-md bg-[var(--color-card)] p-3 text-xs leading-6 text-[var(--color-ink)] whitespace-pre-wrap break-words"
                >{{ renderJsonValue(value) }}</pre>
              </dd>
            </div>
          </template>
        </dl>
      </section>
    </template>
  </div>
</template>
