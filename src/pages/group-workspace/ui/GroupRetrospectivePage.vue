<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { listCurriculumWeeks, type CurriculumWeek } from '@/entities/curriculum'
import {
  getMyRetrospective,
  listMyRetrospectives,
  requestRetrospective,
  type Retrospective,
} from '@/entities/retrospective'
import { ApiError } from '@/shared/api'
import type { JsonValue } from '@/shared/model/json'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupRetrospectivePage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext
const router = useRouter()

type PageState = 'loading' | 'empty' | 'ready' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const weeks = ref<CurriculumWeek[]>([])
const retrospectives = ref<Retrospective[]>([])
const selectedWeekId = ref<string | null>(null)
const isRequesting = ref(false)
const requestError = ref('')

const selectedWeek = computed<CurriculumWeek | null>(
  () => weeks.value.find((week) => week.id === selectedWeekId.value) ?? null,
)

const selectedRetrospective = computed<Retrospective | null>(
  () => retrospectives.value.find((retro) => retro.weekId === selectedWeekId.value) ?? null,
)

// PENDING(아직 시작 전) 주차는 회고를 요청할 수 없다.
const canRequest = computed(
  () =>
    !!selectedWeek.value && selectedWeek.value.status !== 'PENDING' && !selectedRetrospective.value,
)

function hasRetrospective(weekId: string): boolean {
  return retrospectives.value.some((retro) => retro.weekId === weekId)
}

onMounted(() => {
  void loadAll()
})

async function loadAll(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    const [weekList, retroList] = await Promise.all([
      listCurriculumWeeks(groupId.value),
      listMyRetrospectives(groupId.value),
    ])
    weeks.value = [...weekList].sort((a, b) => a.weekNumber - b.weekNumber)
    retrospectives.value = retroList

    if (weeks.value.length === 0) {
      pageState.value = 'empty'
      return
    }

    selectedWeekId.value = defaultWeekId()
    pageState.value = 'ready'
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '회고 정보를 불러오지 못했습니다.'
    pageState.value = 'error'
  }
}

// 진행 중 주차 우선, 없으면 회고가 있는 가장 최근 주차, 그것도 없으면 마지막 주차.
function defaultWeekId(): string {
  const inProgress = weeks.value.find((week) => week.status === 'IN_PROGRESS')
  if (inProgress) return inProgress.id
  const latestWithRetro = [...weeks.value].reverse().find((week) => hasRetrospective(week.id))
  if (latestWithRetro) return latestWithRetro.id
  const lastWeek = weeks.value[weeks.value.length - 1]
  return lastWeek ? lastWeek.id : ''
}

function selectWeek(weekId: string): void {
  selectedWeekId.value = weekId
  requestError.value = ''
}

async function handleRequest(): Promise<void> {
  const weekId = selectedWeekId.value
  if (!weekId) return

  isRequesting.value = true
  requestError.value = ''

  try {
    const created = await requestRetrospective(weekId)
    upsertRetrospective(created, weekId)
  } catch (error) {
    requestError.value = error instanceof ApiError ? error.message : '회고 요청에 실패했습니다.'
  } finally {
    isRequesting.value = false
  }
}

async function refreshSelected(): Promise<void> {
  const weekId = selectedWeekId.value
  if (!weekId) return
  try {
    const latest = await getMyRetrospective(weekId)
    upsertRetrospective(latest, weekId)
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      requestError.value =
        error instanceof ApiError ? error.message : '회고를 새로고침하지 못했습니다.'
    }
  }
}

function upsertRetrospective(retro: Retrospective, weekId: string): void {
  const withWeek: Retrospective = { ...retro, weekId: retro.weekId ?? weekId }
  const index = retrospectives.value.findIndex((item) => item.weekId === weekId)
  if (index >= 0) {
    retrospectives.value.splice(index, 1, withWeek)
  } else {
    retrospectives.value.push(withWeek)
  }
}

function goToRetrospectiveChat(): void {
  const retro = selectedRetrospective.value
  if (!retro || !selectedWeekId.value) return
  void router.push({
    name: 'group-ai',
    params: { groupId: groupId.value },
    query: { retrospectiveId: retro.id, weekId: selectedWeekId.value },
  })
}

function renderJsonValue(value: JsonValue, depth = 0): string {
  if (value === null || value === undefined) return ''
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

function isPrimitive(value: JsonValue): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

// 회고 프롬프트는 줄바꿈으로 구분된 여러 질문일 수 있다.
const promptLines = computed<string[]>(() => {
  const prompt = selectedWeek.value?.retrospectivePrompt
  if (!prompt) return []
  return prompt
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
})

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
      @action="loadAll"
    />

    <ScreenState
      v-else-if="pageState === 'empty'"
      variant="empty"
      title="아직 커리큘럼이 없어요"
      description="스터디가 시작되면 주차별 회고를 작성할 수 있어요."
    />

    <template v-else-if="pageState === 'ready'">
      <!-- 주차 선택 -->
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">회고</p>
        <h2 class="mt-1 text-xl font-bold text-[var(--color-ink)]">주차별 회고</h2>
        <p class="mt-1 text-sm text-[var(--color-muted)]">
          이번 주차와 지난 주차의 회고를 확인해 보세요.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="week in weeks"
            :key="week.id"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition"
            :class="
              week.id === selectedWeekId
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            "
            @click="selectWeek(week.id)"
          >
            {{ week.weekNumber }}주차
            <span
              v-if="hasRetrospective(week.id)"
              class="h-1.5 w-1.5 rounded-full"
              :class="week.id === selectedWeekId ? 'bg-white' : 'bg-[var(--color-primary)]'"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      <!-- 회고 가이드 질문 (커리큘럼 생성 시 AI가 만든 프롬프트) -->
      <section
        v-if="promptLines.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">회고 가이드 질문</h3>
        <p class="mt-1 text-sm text-[var(--color-muted)]">
          {{ selectedWeek?.weekNumber }}주차를 돌아보며 아래 질문에 답해 보세요.
        </p>
        <ul class="mt-3 grid gap-2">
          <li
            v-for="(line, i) in promptLines"
            :key="i"
            class="flex gap-2 text-sm leading-6 text-[var(--color-ink)]"
          >
            <span
              class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
              aria-hidden="true"
            />
            {{ line }}
          </li>
        </ul>
      </section>

      <!-- 회고 없음: 요청 -->
      <section
        v-if="!selectedRetrospective"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 class="text-lg font-bold text-[var(--color-ink)]">
          {{ selectedWeek?.weekNumber }}주차 회고가 아직 없어요
        </h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {{
            canRequest
              ? 'AI 팀장과 함께 이번 주차 회고를 시작할 수 있어요.'
              : '주차가 시작되면 회고를 요청할 수 있어요.'
          }}
        </p>

        <p
          v-if="requestError"
          role="alert"
          class="mt-4 text-sm font-semibold text-[var(--color-danger)]"
        >
          {{ requestError }}
        </p>

        <button
          v-if="canRequest"
          type="button"
          :disabled="isRequesting"
          class="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
          @click="handleRequest"
        >
          {{ isRequesting ? '요청 중…' : '회고 요청' }}
        </button>
      </section>

      <!-- 회고 상태 + 결과 -->
      <template v-else>
        <section
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="text-sm font-semibold text-[var(--color-primary)]">
                {{ selectedWeek?.weekNumber }}주차 회고
              </p>
              <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">
                {{ STATUS_LABEL[selectedRetrospective.status] ?? selectedRetrospective.status }}
              </h2>
              <p
                v-if="selectedRetrospective.status === 'PROCESSING'"
                class="mt-3 text-sm leading-6 text-[var(--color-muted)]"
              >
                AI가 회고를 생성하고 있습니다.
              </p>
              <p
                v-else-if="selectedRetrospective.status === 'FAILED'"
                class="mt-3 text-sm leading-6 text-[var(--color-danger)]"
              >
                회고 생성에 실패했습니다. 다시 요청하거나 잠시 후 시도해 주세요.
              </p>
            </div>

            <div class="flex shrink-0 gap-2">
              <button
                v-if="selectedRetrospective.status === 'PROCESSING'"
                type="button"
                class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                @click="refreshSelected"
              >
                새로고침
              </button>
              <button
                type="button"
                class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
                @click="goToRetrospectiveChat"
              >
                AI 팀장과 회고하기
              </button>
            </div>
          </div>
        </section>

        <!-- AI 피드백 -->
        <section
          v-if="selectedRetrospective.status === 'COMPLETED' && selectedRetrospective.aiFeedback"
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <h3 class="text-base font-bold text-[var(--color-ink)]">AI 피드백</h3>
          <dl class="mt-4 grid gap-5">
            <template v-for="(value, key) in selectedRetrospective.aiFeedback" :key="key">
              <div v-if="value !== null && value !== undefined">
                <dt class="text-sm font-semibold text-[var(--color-muted)] capitalize">
                  {{ key }}
                </dt>
                <dd class="mt-2">
                  <p v-if="isPrimitive(value)" class="text-sm leading-6 text-[var(--color-ink)]">
                    {{ value }}
                  </p>
                  <ul v-else-if="isStringArray(value)" class="grid gap-1.5">
                    <li
                      v-for="(item, i) in value"
                      :key="i"
                      class="flex gap-2 text-sm leading-6 text-[var(--color-ink)]"
                    >
                      <span
                        class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                        aria-hidden="true"
                      />
                      {{ item }}
                    </li>
                  </ul>
                  <pre
                    v-else
                    class="rounded-md bg-[var(--color-card)] p-3 text-xs leading-6 text-[var(--color-ink)] whitespace-pre-wrap break-words"
                    >{{ renderJsonValue(value) }}</pre
                  >
                </dd>
              </div>
            </template>
          </dl>
        </section>

        <!-- 다음 주 조정 -->
        <section
          v-if="
            selectedRetrospective.status === 'COMPLETED' && selectedRetrospective.nextWeekAdjustment
          "
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <h3 class="text-base font-bold text-[var(--color-ink)]">다음 주 조정 제안</h3>
          <dl class="mt-4 grid gap-5">
            <template v-for="(value, key) in selectedRetrospective.nextWeekAdjustment" :key="key">
              <div v-if="value !== null && value !== undefined">
                <dt class="text-sm font-semibold text-[var(--color-muted)] capitalize">
                  {{ key }}
                </dt>
                <dd class="mt-2">
                  <p v-if="isPrimitive(value)" class="text-sm leading-6 text-[var(--color-ink)]">
                    {{ value }}
                  </p>
                  <ul v-else-if="isStringArray(value)" class="grid gap-1.5">
                    <li
                      v-for="(item, i) in value"
                      :key="i"
                      class="flex gap-2 text-sm leading-6 text-[var(--color-ink)]"
                    >
                      <span
                        class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                        aria-hidden="true"
                      />
                      {{ item }}
                    </li>
                  </ul>
                  <pre
                    v-else
                    class="rounded-md bg-[var(--color-card)] p-3 text-xs leading-6 text-[var(--color-ink)] whitespace-pre-wrap break-words"
                    >{{ renderJsonValue(value) }}</pre
                  >
                </dd>
              </div>
            </template>
          </dl>
        </section>
      </template>
    </template>
  </div>
</template>
