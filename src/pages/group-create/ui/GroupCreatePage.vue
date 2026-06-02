<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { createGroup, suggestDetailKeywords, type CreateGroupRequest } from '@/entities/group'
import { ApiError } from '@/shared/api'

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
const fieldErrors = ref<Record<string, string>>({})

const showProgressModal = ref(false)
const showSuccessModal = ref(false)
const progressValue = ref(0)
const createdGroupId = ref('')
let progressTimer: ReturnType<typeof setInterval> | null = null

watch(() => form.startsAt, () => clearFieldError('startsAt'))
watch(() => form.endsAt, () => clearFieldError('endsAt'))
watch(() => form.selectedKeywords, () => {
  if (form.selectedKeywords.length > 0) clearFieldError('selectedKeywords')
})

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
    progressValue.value = 100
    clearProgress()
    await new Promise((r) => setTimeout(r, 400))
    showProgressModal.value = false
    showSuccessModal.value = true
  } catch (error) {
    clearProgress()
    showProgressModal.value = false
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹을 생성하지 못했습니다. 다시 시도해주세요.'
  } finally {
    isSubmitting.value = false
  }
}

function startProgress(): void {
  const totalMs = 30000
  const tickMs = 200
  const maxAutoProgress = 92

  progressTimer = setInterval(() => {
    if (progressValue.value < maxAutoProgress) {
      const remaining = maxAutoProgress - progressValue.value
      progressValue.value = Math.min(maxAutoProgress, progressValue.value + remaining * (tickMs / totalMs) * 3)
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
      suggestionErrorMessage.value = '추가로 추천할 키워드가 없습니다.'
    }
  } catch (error) {
    suggestionErrorMessage.value =
      error instanceof ApiError ? error.message : '추천 키워드를 불러오지 못했습니다.'
  } finally {
    isSuggestingKeywords.value = false
  }
}

function addKeyword(keyword: string): void {
  if (!form.selectedKeywords.includes(keyword)) {
    form.selectedKeywords.push(keyword)
  }
}

function removeKeyword(keyword: string): void {
  form.selectedKeywords = form.selectedKeywords.filter((k) => k !== keyword)
}

function isSuggestedKeywordSelected(keyword: string): boolean {
  return form.selectedKeywords.includes(keyword)
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
    errors.selectedKeywords = 'AI 추천 버튼(+)으로 키워드를 하나 이상 추가해주세요.'
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
  <main class="mx-auto min-h-screen max-w-4xl px-6 py-10">
    <header class="border-b border-[var(--color-line)] pb-6">
      <RouterLink
        :to="{ name: 'groups' }"
        class="inline-flex h-9 items-center rounded-md border border-[var(--color-line)] bg-white px-3 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
      >
        그룹 목록
      </RouterLink>
      <p class="mt-5 text-sm font-semibold text-[var(--color-primary)]">스터디 그룹</p>
      <h1 class="mt-2 text-3xl font-bold text-[var(--color-ink)]">새 그룹 만들기</h1>
      <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        스터디 이름, 주제, 세부 키워드와 기간을 정하면 온보딩 단계로 이동합니다.
      </p>
    </header>

    <form class="mt-8 grid gap-6" @submit.prevent="submitGroup">
      <section
        class="grid gap-5 rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">그룹 이름</span>
          <input
            v-model="form.name"
            name="name"
            type="text"
            maxlength="120"
            class="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            placeholder="Backend Interview Study"
          />
          <span v-if="fieldErrors.name" class="text-xs font-semibold text-red-700">
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
            class="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            placeholder="Spring Boot"
          />
          <span v-if="fieldErrors.topic" class="text-xs font-semibold text-red-700">
            {{ fieldErrors.topic }}
          </span>
        </label>

        <!-- 세부 키워드 섹션 -->
        <div class="grid gap-3 border-t border-[var(--color-line)] pt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-[var(--color-ink)]">세부 키워드</p>
              <p class="mt-0.5 text-xs text-[var(--color-muted)]">주제를 입력 후 AI 추천을 받아 + 버튼으로 추가하세요.</p>
            </div>
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSuggestingKeywords"
              @click="requestKeywordSuggestions"
            >
              {{ isSuggestingKeywords ? '추천 중…' : 'AI 키워드 추천' }}
            </button>
          </div>

          <p v-if="suggestionErrorMessage" role="alert" class="text-xs font-semibold text-red-700">
            {{ suggestionErrorMessage }}
          </p>

          <!-- AI 추천 키워드 -->
          <div v-if="suggestedKeywords.length" class="flex flex-wrap gap-2">
            <div
              v-for="keyword in suggestedKeywords"
              :key="keyword"
              class="inline-flex min-h-9 items-center rounded-md border text-xs font-semibold transition focus:outline-none"
              :class="
                isSuggestedKeywordSelected(keyword)
                  ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                  : 'border-[var(--color-line)] bg-white text-[var(--color-muted)]'
              "
            >
              <span class="pl-3 pr-2 py-1.5">{{ keyword }}</span>
              <button
                v-if="!isSuggestedKeywordSelected(keyword)"
                type="button"
                class="pr-2.5 pl-0.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
                :aria-label="`${keyword} 추가`"
                @click="addKeyword(keyword)"
              >
                +
              </button>
              <span v-else class="pr-2.5 text-[var(--color-primary)]">✓</span>
            </div>
          </div>

          <!-- 선택된 키워드 -->
          <div v-if="form.selectedKeywords.length > 0">
            <p class="mb-2 text-xs font-semibold text-[var(--color-muted)]">선택된 키워드</p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="keyword in form.selectedKeywords"
                :key="keyword"
                class="inline-flex min-h-8 items-center gap-1 rounded-md bg-[var(--color-primary)] pl-3 pr-2 py-1 text-xs font-semibold text-white"
              >
                {{ keyword }}
                <button
                  type="button"
                  class="ml-0.5 text-white/70 hover:text-white focus:outline-none"
                  :aria-label="`${keyword} 제거`"
                  @click="removeKeyword(keyword)"
                >
                  ✕
                </button>
              </span>
            </div>
          </div>

          <span v-if="fieldErrors.selectedKeywords" class="text-xs font-semibold text-red-700">
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
              class="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            />
            <span v-if="fieldErrors.maxMembers" class="text-xs font-semibold text-red-700">
              {{ fieldErrors.maxMembers }}
            </span>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">시작일</span>
            <input
              v-model="form.startsAt"
              name="startsAt"
              type="date"
              class="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            />
            <span v-if="fieldErrors.startsAt" class="text-xs font-semibold text-red-700">
              {{ fieldErrors.startsAt }}
            </span>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">종료일</span>
            <input
              v-model="form.endsAt"
              name="endsAt"
              type="date"
              class="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            />
            <span v-if="fieldErrors.endsAt" class="text-xs font-semibold text-red-700">
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
            class="rounded-md border border-[var(--color-line)] bg-white px-3 py-3 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            placeholder="스터디 운영 방식이나 기대하는 참여 방식을 적어주세요."
          />
        </label>
      </section>

      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
      >
        {{ errorMessage }}
      </p>

      <div class="flex flex-wrap justify-end gap-3">
        <RouterLink
          :to="{ name: 'groups' }"
          class="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
        >
          취소
        </RouterLink>
        <button
          type="submit"
          class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isSubmitting"
        >
          그룹 생성
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
      <div class="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-white p-8 shadow-xl">
        <p class="text-sm font-semibold text-[var(--color-primary)]">AI 스터디 생성 중</p>
        <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">커리큘럼을 구성하고 있어요</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          AI가 스터디 주제를 분석하고 최적의 커리큘럼을 만들고 있습니다.
        </p>

        <div class="mt-6">
          <div class="flex items-center justify-between text-xs font-semibold text-[var(--color-muted)]">
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
      <div class="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-white p-8 shadow-xl">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <h2 class="mt-4 text-xl font-bold text-[var(--color-ink)]">그룹이 생성되었습니다!</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          이제 온보딩 정보를 입력하면 스터디 준비가 완료됩니다.
        </p>

        <button
          type="button"
          class="mt-6 inline-flex w-full h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
          @click="goToOnboarding"
        >
          온보딩 하러 가기
        </button>
      </div>
    </div>
  </Teleport>
</template>
