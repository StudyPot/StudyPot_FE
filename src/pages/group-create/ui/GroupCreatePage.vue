<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { createGroup, suggestDetailKeywords, type CreateGroupRequest } from '@/entities/group'
import { ApiError } from '@/shared/api'

type GroupCreateForm = {
  name: string
  topic: string
  detailKeywords: string
  maxMembers: number
  startsAt: string
  endsAt: string
  description: string
}

const router = useRouter()

const form = reactive<GroupCreateForm>({
  name: '',
  topic: '',
  detailKeywords: '',
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

const parsedKeywords = computed(() =>
  form.detailKeywords
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean),
)

const today = computed(() => new Date().toISOString().slice(0, 10))

async function submitGroup(): Promise<void> {
  errorMessage.value = ''

  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    const group = await createGroup(toCreateGroupRequest())
    await router.replace({
      name: 'group-onboarding',
      params: {
        groupId: group.id,
      },
    })
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹을 생성하지 못했습니다. 다시 시도해주세요.'
  } finally {
    isSubmitting.value = false
  }
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
      hintKeywords: parsedKeywords.value,
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

function toggleSuggestedKeyword(keyword: string): void {
  if (isSuggestedKeywordSelected(keyword)) {
    form.detailKeywords = parsedKeywords.value.filter((k) => k !== keyword).join(', ')
  } else {
    form.detailKeywords = [...parsedKeywords.value, keyword].join(', ')
    clearFieldError('detailKeywords')
  }
}

function isSuggestedKeywordSelected(keyword: string): boolean {
  return parsedKeywords.value.includes(keyword)
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

  if (parsedKeywords.value.length === 0) {
    errors.detailKeywords = '세부 키워드를 하나 이상 입력해주세요.'
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
    detailKeywords: parsedKeywords.value,
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

        <div class="grid gap-3 border-t border-[var(--color-line)] pt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-[var(--color-ink)]">세부 키워드 추천</p>
            </div>
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSuggestingKeywords"
              @click="requestKeywordSuggestions"
            >
              {{ isSuggestingKeywords ? '추천 중' : '키워드 추천' }}
            </button>
          </div>

          <p v-if="suggestionErrorMessage" role="alert" class="text-xs font-semibold text-red-700">
            {{ suggestionErrorMessage }}
          </p>

          <div v-if="suggestedKeywords.length" class="flex flex-wrap gap-2">
            <button
              v-for="keyword in suggestedKeywords"
              :key="keyword"
              type="button"
              class="inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)] disabled:cursor-default"
              :class="
                isSuggestedKeywordSelected(keyword)
                  ? 'border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary-deep)]'
                  : 'border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
              "
              :aria-pressed="isSuggestedKeywordSelected(keyword)"
              @click="toggleSuggestedKeyword(keyword)"
            >
              {{ keyword }}
            </button>
          </div>
        </div>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">세부 키워드</span>
          <textarea
            v-model="form.detailKeywords"
            name="detailKeywords"
            rows="4"
            class="rounded-md border border-[var(--color-line)] bg-white px-3 py-3 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            placeholder="JPA, Security, Testing"
          />
          <span class="text-xs text-[var(--color-muted)]">
            쉼표 또는 줄바꿈으로 여러 키워드를 입력할 수 있습니다.
          </span>
          <span v-if="fieldErrors.detailKeywords" class="text-xs font-semibold text-red-700">
            {{ fieldErrors.detailKeywords }}
          </span>
        </label>

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
              :min="today"
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
              :min="form.startsAt || today"
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
          {{ isSubmitting ? '생성 중' : '그룹 생성' }}
        </button>
      </div>
    </form>
  </main>
</template>
