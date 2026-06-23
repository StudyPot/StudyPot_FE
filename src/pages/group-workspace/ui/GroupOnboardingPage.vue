<script setup lang="ts">
import { inject, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  getMyOnboarding,
  submitMyOnboarding,
  useOnboardingStatusStore,
  type AvailabilitySlot,
  type OnboardingResponse,
} from '@/entities/onboarding'
import { ApiError } from '@/shared/api'
import { ScreenState, TimeInput } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const SKILL_LABELS: Record<number, string> = {
  1: '완전 초보',
  2: '기초 이해',
  3: '실습 가능',
  4: '심화 활용',
  5: '전문가',
}

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupOnboardingPage must be used inside GroupWorkspacePage.')
}

const { groupId, group, reloadMembers } = workspaceContext
const router = useRouter()
const onboardingStatusStore = useOnboardingStatusStore()

// 스터디가 시작되면(상태가 더 이상 온보딩 단계가 아니면) 온보딩 페이지는 자동으로 사라지고
// 그룹 개요로 이동한다. (새로고침 없이도 실시간 갱신으로 그룹 상태가 바뀌면 반영됨)
watch(
  () => group.value?.status,
  (status) => {
    if (status && status !== 'ONBOARDING' && status !== 'READY_TO_START' && status !== 'DRAFT') {
      void router.replace({ name: 'group-overview', params: { groupId: groupId.value } })
    }
  },
  { immediate: true },
)

type PageState = 'loading' | 'form' | 'submitted' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const onboarding = ref<OnboardingResponse | null>(null)
const isSubmitting = ref(false)
const submitError = ref('')

const form = reactive({
  skillLevel: 3,
  additionalNote: '',
  availabilitySlots: [] as AvailabilitySlot[],
})

onMounted(() => {
  void loadOnboarding()
})

async function loadOnboarding(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    const data = await getMyOnboarding(groupId.value)
    onboarding.value = data

    if (data.status === 'SUBMITTED') {
      pageState.value = 'submitted'
    } else {
      prefillForm(data)
      pageState.value = 'form'
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      pageState.value = 'form'
    } else {
      errorMessage.value =
        error instanceof ApiError ? error.message : '온보딩 정보를 불러오지 못했습니다.'
      pageState.value = 'error'
    }
  }
}

function prefillForm(data: OnboardingResponse): void {
  form.skillLevel = data.skillLevel
  form.additionalNote = data.additionalNote ?? ''
  form.availabilitySlots = data.availabilitySlots.map((s) => ({ ...s }))
}

function addSlot(): void {
  form.availabilitySlots.push({
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '12:00',
    timezone: 'Asia/Seoul',
  })
}

function removeSlot(index: number): void {
  form.availabilitySlots.splice(index, 1)
}

async function handleSubmit(): Promise<void> {
  isSubmitting.value = true
  submitError.value = ''

  try {
    const result = await submitMyOnboarding(groupId.value, {
      skillLevel: form.skillLevel,
      additionalNote: form.additionalNote || undefined,
      availabilitySlots: form.availabilitySlots,
    })

    onboarding.value = result
    pageState.value = 'submitted'
    // 공유 워크스페이스 members를 갱신해 개요의 온보딩 현황에 즉시 반영되게 한다.
    void reloadMembers()
    // 제출 완료 신호를 공유 스토어에 기록해 좌측 온보딩 탭이 즉시 사라지게 하고, 홈으로 이동한다.
    onboardingStatusStore.markSubmitted(groupId.value)
    void router.replace({ name: 'group-overview', params: { groupId: groupId.value } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      submitError.value = '이미 제출된 온보딩입니다.'
    } else {
      submitError.value =
        error instanceof ApiError ? error.message : '제출 중 오류가 발생했어요.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <div class="grid gap-5">
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="온보딩 정보를 확인하는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="온보딩 정보를 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadOnboarding"
    />

    <section
      v-else-if="pageState === 'submitted' && onboarding"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">온보딩</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">제출 완료</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        온보딩이 제출되었습니다.
        <template v-if="onboarding.submittedAt">
          {{ formatSubmittedAt(onboarding.submittedAt) }}
        </template>
      </p>

      <dl class="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-[var(--color-muted)]">숙련도</dt>
          <dd class="mt-1 font-semibold text-[var(--color-ink)]">
            {{ onboarding.skillLevel }}단계 — {{ SKILL_LABELS[onboarding.skillLevel] }}
          </dd>
        </div>
        <div v-if="onboarding.additionalNote">
          <dt class="text-[var(--color-muted)]">추가 메모</dt>
          <dd class="mt-1 font-semibold text-[var(--color-ink)]">{{ onboarding.additionalNote }}</dd>
        </div>
      </dl>

      <div v-if="onboarding.availabilitySlots.length > 0" class="mt-5">
        <p class="text-sm font-semibold text-[var(--color-muted)]">가능한 시간</p>
        <ul class="mt-2 grid gap-2">
          <li
            v-for="(slot, i) in onboarding.availabilitySlots"
            :key="i"
            class="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-2 text-sm font-medium text-[var(--color-ink)]"
          >
            <span>{{ DAY_LABELS[slot.dayOfWeek] }}요일</span>
            <span class="text-[var(--color-muted)]">{{ slot.startTime }} – {{ slot.endTime }}</span>
            <span class="text-xs text-[var(--color-muted)]">({{ slot.timezone }})</span>
          </li>
        </ul>
      </div>
    </section>

    <section
      v-else-if="pageState === 'form'"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">온보딩</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">나의 준비 정보</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        스터디 참여에 필요한 숙련도와 가능한 시간을 입력하고 제출하세요.
      </p>

      <form class="mt-6 grid gap-6" @submit.prevent="handleSubmit">
        <fieldset>
          <legend class="text-sm font-semibold text-[var(--color-ink)]">숙련도</legend>
          <div class="mt-3 flex flex-wrap gap-2">
            <label
              v-for="level in [1, 2, 3, 4, 5]"
              :key="level"
              class="cursor-pointer"
            >
              <input
                v-model="form.skillLevel"
                type="radio"
                :value="level"
                class="sr-only"
              />
              <span
                :class="[
                  'inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold transition',
                  form.skillLevel === level
                    ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                    : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-primary)]',
                ]"
              >
                {{ level }} · {{ SKILL_LABELS[level] }}
              </span>
            </label>
          </div>
        </fieldset>

        <div>
          <label class="text-sm font-semibold text-[var(--color-ink)]" for="additionalNote">
            추가 메모 <span class="font-normal text-[var(--color-muted)]">(선택)</span>
          </label>
          <textarea
            id="additionalNote"
            v-model="form.additionalNote"
            rows="3"
            placeholder="학습 방향, 목표, 요청 사항 등"
            class="mt-2 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
          />
        </div>

        <div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-[var(--color-ink)]">가능한 시간</p>
            <button
              type="button"
              class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
              @click="addSlot"
            >
              + 시간 추가
            </button>
          </div>

          <ul v-if="form.availabilitySlots.length > 0" class="mt-3 grid gap-3">
            <li
              v-for="(slot, i) in form.availabilitySlots"
              :key="i"
              class="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-2"
            >
              <select
                v-model.number="slot.dayOfWeek"
                class="rounded border border-[var(--color-line)] bg-[var(--color-input)] px-2 py-1 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
              >
                <option v-for="(label, d) in DAY_LABELS" :key="d" :value="d">{{ label }}요일</option>
              </select>

              <TimeInput v-model="slot.startTime" />
              <TimeInput v-model="slot.endTime" />

              <button
                type="button"
                class="text-xs font-semibold text-[var(--color-muted)] hover:text-red-600 focus:outline-none"
                aria-label="시간 삭제"
                @click="removeSlot(i)"
              >
                삭제
              </button>
            </li>
          </ul>

          <p v-else class="mt-3 text-sm text-[var(--color-muted)]">
            가능한 시간대를 추가해 주세요.
          </p>
        </div>

        <p v-if="submitError" role="alert" class="text-sm font-semibold text-[var(--color-danger)]">
          {{ submitError }}
        </p>

        <div>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
          >
            {{ isSubmitting ? '제출 중…' : '온보딩 제출' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
