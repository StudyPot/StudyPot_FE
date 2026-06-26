<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createGroup,
  suggestDetailKeywords,
  type CreateGroupRequest,
  useGroupListStore,
} from '@/entities/group'
import { getStudyQuota } from '@/entities/user/api/currentUser'
import type { StudyQuota } from '@/entities/user/model/types'
import QuotaUpgradeModal from '@/entities/user/ui/QuotaUpgradeModal.vue'
import { ApiError } from '@/shared/api'
import { DateInput } from '@/shared/ui'

type GroupCreateForm = {
  name: string
  topic: string
  selectedKeywords: string[]
  maxMembers: number
  startsAt: string
  endsAt: string
  description: string
}

const router = useRouter()
const route = useRoute()
const groupListStore = useGroupListStore()

const form = reactive<GroupCreateForm>({
  name: '',
  topic: '',
  selectedKeywords: [],
  maxMembers: 6,
  startsAt: '',
  endsAt: '',
  description: '',
})

const isSubmitting = ref(false)
const isSuggestingKeywords = ref(false)
const errorMessage = ref('')
const suggestionErrorMessage = ref('')
const suggestedKeywords = ref<string[]>([])
const customKeywords = ref<string[]>([])
const showCustomInput = ref(false)
const customKeywordInput = ref('')
const customInputRef = ref<HTMLInputElement | null>(null)

// 추천(완료 스터디 → 다음 스터디)에서 넘어온 주제를 폼에 미리 채운다.
onMounted(() => {
  const topic = typeof route.query.topic === 'string' ? route.query.topic.trim() : ''
  if (topic) {
    form.topic = topic
    if (!form.name) {
      form.name = topic
    }
  }
  void loadQuota()
})
const fieldErrors = ref<Record<string, string>>({})

const allKeywords = computed(() => [...suggestedKeywords.value, ...customKeywords.value])

const showProgressModal = ref(false)
const showSuccessModal = ref(false)
const progressValue = ref(0)
const createdGroupId = ref('')
let progressTimer: ReturnType<typeof setInterval> | null = null

// 호스트 스터디 개수 제한(무료/유료 플랜) 안내·차단
const quota = ref<StudyQuota | null>(null)
const showQuotaModal = ref(false)
const quotaModal = reactive({ plan: 'FREE', limit: 3, current: 0 })
const atLimit = computed(() => (quota.value ? !quota.value.canCreate : false))

async function loadQuota(): Promise<void> {
  try {
    quota.value = await getStudyQuota()
  } catch {
    // 쿼터 조회 실패는 생성을 막지 않는다(서버가 최종 검증).
  }
}

function openQuotaModalFromQuota(): void {
  if (!quota.value) return
  quotaModal.plan = quota.value.plan
  quotaModal.limit = quota.value.limit
  quotaModal.current = quota.value.hostedActiveCount
  showQuotaModal.value = true
}

watch(
  () => form.startsAt,
  () => clearFieldError('startsAt'),
)
watch(
  () => form.endsAt,
  () => clearFieldError('endsAt'),
)
watch(
  () => form.selectedKeywords,
  () => {
    if (form.selectedKeywords.length > 0) clearFieldError('selectedKeywords')
  },
)

const today = computed(() => new Date().toISOString().slice(0, 10))

async function submitGroup(): Promise<void> {
  errorMessage.value = ''

  if (!validateForm()) {
    return
  }

  isSubmitting.value = true
  showProgressModal.value = true
  progressValue.value = 0
  startProgress()

  try {
    const group = await createGroup(toCreateGroupRequest())
    createdGroupId.value = group.id
    void groupListStore.loadGroups()
    progressValue.value = 100
    clearProgress()
    await new Promise((r) => setTimeout(r, 400))
    showProgressModal.value = false
    showSuccessModal.value = true
  } catch (error) {
    clearProgress()
    showProgressModal.value = false
    if (error instanceof ApiError && isQuotaError(error)) {
      const payload = error.payload as { plan?: string; limit?: number; current?: number } | null
      quotaModal.plan = payload?.plan ?? quota.value?.plan ?? 'FREE'
      quotaModal.limit = payload?.limit ?? quota.value?.limit ?? 3
      quotaModal.current = payload?.current ?? quota.value?.hostedActiveCount ?? quotaModal.limit
      showQuotaModal.value = true
      void loadQuota()
    } else {
      errorMessage.value =
        error instanceof ApiError ? error.message : '그룹을 생성하지 못했어요. 다시 시도해 주세요.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function isQuotaError(error: ApiError): boolean {
  if (error.status !== 409) return false
  const payload = error.payload as { code?: string } | null
  return payload?.code === 'STUDY_GROUP_QUOTA_EXCEEDED'
}

function startProgress(): void {
  const totalMs = 30000
  const tickMs = 200
  const maxAutoProgress = 92

  progressTimer = setInterval(() => {
    if (progressValue.value < maxAutoProgress) {
      const remaining = maxAutoProgress - progressValue.value
      progressValue.value = Math.min(
        maxAutoProgress,
        progressValue.value + remaining * (tickMs / totalMs) * 3,
      )
    }
  }, tickMs)
}

function clearProgress(): void {
  if (progressTimer !== null) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

async function goToOnboarding(): Promise<void> {
  showSuccessModal.value = false
  await router.replace({
    name: 'group-onboarding',
    params: { groupId: createdGroupId.value },
  })
}

async function goToGroupList(): Promise<void> {
  showSuccessModal.value = false
  await router.replace({ name: 'groups' })
}

async function requestKeywordSuggestions(): Promise<void> {
  suggestionErrorMessage.value = ''

  if (!form.topic.trim()) {
    fieldErrors.value = {
      ...fieldErrors.value,
      topic: '스터디 주제를 입력해주세요.',
    }
    return
  }

  clearFieldError('topic')
  isSuggestingKeywords.value = true

  try {
    const response = await suggestDetailKeywords({
      topic: form.topic.trim(),
      hintKeywords: form.selectedKeywords,
      maxCandidates: 5,
    })
    suggestedKeywords.value = response.keywords.filter(Boolean)

    if (suggestedKeywords.value.length === 0) {
      suggestionErrorMessage.value = '추가로 추천할 키워드가 없어요.'
    }
  } catch (error) {
    suggestionErrorMessage.value =
      error instanceof ApiError ? error.message : '추천 키워드를 불러오지 못했어요.'
  } finally {
    isSuggestingKeywords.value = false
  }
}

function toggleKeyword(keyword: string): void {
  if (form.selectedKeywords.includes(keyword)) {
    form.selectedKeywords = form.selectedKeywords.filter((k) => k !== keyword)
  } else {
    form.selectedKeywords.push(keyword)
  }
}

async function openCustomInput(): Promise<void> {
  showCustomInput.value = true
  await nextTick()
  customInputRef.value?.focus()
}

function confirmCustomKeyword(): void {
  const keyword = customKeywordInput.value.trim()
  if (keyword && !allKeywords.value.includes(keyword)) {
    customKeywords.value.push(keyword)
    form.selectedKeywords.push(keyword)
  }
  customKeywordInput.value = ''
  showCustomInput.value = false
}

function cancelCustomInput(): void {
  customKeywordInput.value = ''
  showCustomInput.value = false
}

function validateForm(): boolean {
  const errors: Record<string, string> = {}

  if (!form.name.trim()) {
    errors.name = '그룹 이름을 입력해주세요.'
  } else if (form.name.trim().length > 120) {
    errors.name = '그룹 이름은 120자 이하로 입력해주세요.'
  }

  if (!form.topic.trim()) {
    errors.topic = '스터디 주제를 입력해주세요.'
  } else if (form.topic.trim().length > 120) {
    errors.topic = '스터디 주제는 120자 이하로 입력해주세요.'
  }

  if (form.selectedKeywords.length === 0) {
    errors.selectedKeywords = '키워드를 하나 이상 선택하거나 추가해주세요.'
  }

  if (!Number.isInteger(form.maxMembers) || form.maxMembers < 1) {
    errors.maxMembers = '모집 인원은 1명 이상이어야 합니다.'
  }

  if (!form.startsAt) {
    errors.startsAt = '시작일을 선택해주세요.'
  }

  if (!form.endsAt) {
    errors.endsAt = '종료일을 선택해주세요.'
  } else if (form.startsAt && form.endsAt < form.startsAt) {
    errors.endsAt = '종료일은 시작일 이후여야 합니다.'
  } else if (form.startsAt && form.endsAt) {
    const diffDays =
      (new Date(form.endsAt).getTime() - new Date(form.startsAt).getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 365) {
      errors.endsAt = '스터디 기간은 1년(365일)을 초과할 수 없습니다.'
    }
  }

  fieldErrors.value = errors

  return Object.keys(errors).length === 0
}

function clearFieldError(field: string): void {
  const nextErrors = { ...fieldErrors.value }
  delete nextErrors[field]
  fieldErrors.value = nextErrors
}

function toCreateGroupRequest(): CreateGroupRequest {
  return {
    name: form.name.trim(),
    topic: form.topic.trim(),
    detailKeywords: form.selectedKeywords,
    maxMembers: form.maxMembers,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
  }
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-3xl px-0 py-6 sm:px-6 sm:py-12">
    <header class="mb-6">
      <h1 class="text-2xl font-extrabold text-[var(--color-ink)]">스터디 그룹을 만들어볼까요?</h1>
      <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        기본 정보를 입력하면 멤버를 모집할 수 있어요. AI가 키워드를 추천하고, 시작하면 첫 주
        커리큘럼을 만들어줍니다.
      </p>
    </header>

    <div
      v-if="atLimit && quota"
      class="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-[rgba(25,195,125,0.3)] bg-[rgba(25,195,125,0.08)] px-4 py-3.5"
    >
      <span class="text-lg leading-6" aria-hidden="true">🚀</span>
      <div class="flex-1 text-sm">
        <p class="font-semibold text-[var(--color-ink)]">
          운영 중인 스터디가 한도에 도달했어요 ({{ quota.hostedActiveCount }}/{{ quota.limit }})
        </p>
        <p class="mt-1 leading-6 text-[var(--color-muted)]">
          {{ quota.plan === 'PREMIUM' ? '프리미엄' : '무료' }} 플랜은 최대 {{ quota.limit }}개까지
          운영할 수 있어요. 기존 스터디를 마무리하거나 프리미엄으로 전환하면 새로 만들 수 있어요.
        </p>
        <button
          type="button"
          class="mt-2 text-sm font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
          @click="openQuotaModalFromQuota"
        >
          자세히 보기
        </button>
      </div>
    </div>

    <form class="grid gap-6" @submit.prevent="submitGroup">
      <section
        class="grid gap-5 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-4 sm:p-6 shadow-[var(--shadow-soft)]"
      >
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">그룹 이름</span>
          <input
            v-model="form.name"
            name="name"
            type="text"
            maxlength="120"
            class="h-11 rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            placeholder="예: 백엔드 면접 스터디"
          />
          <span v-if="fieldErrors.name" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.name }}
          </span>
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">스터디 주제</span>
          <input
            v-model="form.topic"
            name="topic"
            type="text"
            maxlength="120"
            class="h-11 rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            placeholder="예: Spring Boot"
          />
          <span v-if="fieldErrors.topic" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.topic }}
          </span>
        </label>

        <!-- 세부 키워드 섹션 -->
        <div class="grid gap-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-[var(--color-ink)]">세부 키워드</p>
              <p class="mt-0.5 text-xs text-[var(--color-muted)]">
                AI 추천 키워드를 클릭해 선택하거나, + 버튼으로 직접 추가하세요.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSuggestingKeywords"
              @click="requestKeywordSuggestions"
            >
              <svg
                class="h-4 w-4 text-[var(--color-primary)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 15l-1.6-5L6 8.4l4.4-1.6L12 2z" />
              </svg>
              {{ isSuggestingKeywords ? '추천 중…' : 'AI 키워드 추천' }}
            </button>
          </div>

          <p
            v-if="suggestionErrorMessage"
            role="alert"
            class="text-xs font-semibold text-[var(--color-danger)]"
          >
            {{ suggestionErrorMessage }}
          </p>

          <!-- 키워드 버튼 목록 + + 버튼 -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="keyword in allKeywords"
              :key="keyword"
              type="button"
              :class="[
                'inline-flex h-9 sm:h-8 items-center rounded-[var(--radius-chip)] border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]',
                form.selectedKeywords.includes(keyword)
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
              ]"
              :aria-pressed="form.selectedKeywords.includes(keyword)"
              @click="toggleKeyword(keyword)"
            >
              {{ keyword }}
            </button>

            <!-- 직접 입력 중일 때 -->
            <template v-if="showCustomInput">
              <div class="inline-flex items-center gap-1">
                <input
                  ref="customInputRef"
                  v-model="customKeywordInput"
                  type="text"
                  maxlength="30"
                  placeholder="키워드 입력"
                  class="h-8 w-28 rounded-md border border-[var(--color-primary)] bg-[var(--color-card)] px-2 text-xs text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
                  @keydown.enter.prevent="confirmCustomKeyword"
                  @keydown.escape="cancelCustomInput"
                />
                <button
                  type="button"
                  class="inline-flex h-8 items-center rounded-md bg-[var(--color-primary)] px-2.5 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none"
                  @click="confirmCustomKeyword"
                >
                  확인
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center rounded-md border border-[var(--color-line)] bg-[var(--color-active)] px-2.5 text-xs font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-ink)] focus:outline-none"
                  @click="cancelCustomInput"
                >
                  취소
                </button>
              </div>
            </template>

            <!-- + 버튼 -->
            <button
              v-else
              type="button"
              class="inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-card)] text-base font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
              aria-label="키워드 직접 추가"
              @click="openCustomInput"
            >
              +
            </button>
          </div>

          <span
            v-if="fieldErrors.selectedKeywords"
            class="text-xs font-semibold text-[var(--color-danger)]"
          >
            {{ fieldErrors.selectedKeywords }}
          </span>
        </div>

        <div class="grid gap-5 sm:grid-cols-3">
          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">모집 인원</span>
            <input
              v-model.number="form.maxMembers"
              name="maxMembers"
              type="number"
              min="1"
              class="h-11 rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            />
            <span
              v-if="fieldErrors.maxMembers"
              class="text-xs font-semibold text-[var(--color-danger)]"
            >
              {{ fieldErrors.maxMembers }}
            </span>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">시작일</span>
            <DateInput v-model="form.startsAt" :min="today" />
            <span
              v-if="fieldErrors.startsAt"
              class="text-xs font-semibold text-[var(--color-danger)]"
            >
              {{ fieldErrors.startsAt }}
            </span>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">종료일</span>
            <DateInput v-model="form.endsAt" :min="form.startsAt || today" />
            <span
              v-if="fieldErrors.endsAt"
              class="text-xs font-semibold text-[var(--color-danger)]"
            >
              {{ fieldErrors.endsAt }}
            </span>
          </label>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">소개 메모</span>
          <textarea
            v-model="form.description"
            name="description"
            rows="4"
            class="rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            placeholder="스터디 운영 방식이나 기대하는 참여 방식을 적어주세요."
          />
        </label>
      </section>

      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-lg border border-[rgba(237,66,69,0.3)] bg-[rgba(237,66,69,0.1)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
      >
        {{ errorMessage }}
      </p>

      <div class="flex gap-3">
        <RouterLink
          :to="{ name: 'groups' }"
          class="inline-flex h-12 w-36 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.16)]"
        >
          취소
        </RouterLink>
        <button
          type="submit"
          class="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] text-sm font-bold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isSubmitting || atLimit"
        >
          {{ atLimit ? '스터디 개수 한도 도달' : '그룹 생성' }}
        </button>
      </div>
    </form>
  </main>

  <!-- 생성 중 프로그레스 모달 -->
  <Teleport to="body">
    <div
      v-if="showProgressModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-8 shadow-xl"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">AI 스터디 생성 중</p>
        <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">커리큘럼을 구성하고 있어요</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          AI가 스터디 주제를 분석하고 최적의 커리큘럼을 만들고 있습니다.
        </p>

        <div class="mt-6">
          <div
            class="flex items-center justify-between text-xs font-semibold text-[var(--color-muted)]"
          >
            <span>진행률</span>
            <span>{{ Math.round(progressValue) }}%</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-card)]">
            <div
              class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300 ease-out"
              :style="{ width: `${progressValue}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 생성 완료 모달 -->
  <Teleport to="body">
    <div
      v-if="showSuccessModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-8 shadow-xl"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(35,165,90,0.2)] text-2xl"
        >
          ✓
        </div>
        <h2 class="mt-4 text-xl font-bold text-[var(--color-ink)]">그룹이 생성되었습니다!</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          이제 온보딩 정보를 입력하면 스터디 준비가 완료됩니다.
        </p>

        <div class="mt-6 grid gap-2">
          <button
            type="button"
            class="inline-flex w-full h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)]"
            @click="goToOnboarding"
          >
            온보딩 하러 가기
          </button>
          <button
            type="button"
            class="inline-flex w-full h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-5 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.16)]"
            @click="goToGroupList"
          >
            그룹 목록으로
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 호스트 스터디 개수 한도 안내 모달 -->
  <QuotaUpgradeModal
    :open="showQuotaModal"
    :plan="quotaModal.plan"
    :limit="quotaModal.limit"
    :current="quotaModal.current"
    @close="showQuotaModal = false"
  />
</template>
