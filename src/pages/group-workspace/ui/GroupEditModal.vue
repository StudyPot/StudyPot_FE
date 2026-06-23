<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { updateGroup, type StudyGroup, type UpdateGroupRequest } from '@/entities/group'
import { ApiError } from '@/shared/api'

const props = defineProps<{
  group: StudyGroup
}>()

const emit = defineEmits<{
  close: []
  updated: [group: StudyGroup]
}>()

type EditForm = {
  name: string
  topic: string
  selectedKeywords: string[]
  maxMembers: number
  startsAt: string
  endsAt: string
}

const form = reactive<EditForm>({
  name: props.group.name,
  topic: props.group.topic,
  selectedKeywords: [...props.group.detailKeywords],
  maxMembers: props.group.maxMembers,
  startsAt: props.group.startsAt,
  endsAt: props.group.endsAt,
})

const isSubmitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const customKeywords = ref<string[]>(
  props.group.detailKeywords.filter((k) => !props.group.detailKeywords.includes(k)),
)
const showCustomInput = ref(false)
const customKeywordInput = ref('')
const customInputRef = ref<HTMLInputElement | null>(null)

const allKeywords = computed(() => {
  const base = [...props.group.detailKeywords]
  for (const k of customKeywords.value) {
    if (!base.includes(k)) base.push(k)
  }
  return base
})

watch(() => form.startsAt, () => clearFieldError('startsAt'))
watch(() => form.endsAt, () => clearFieldError('endsAt'))
watch(() => form.selectedKeywords, () => {
  if (form.selectedKeywords.length > 0) clearFieldError('selectedKeywords')
})

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
  const next = { ...fieldErrors.value }
  delete next[field]
  fieldErrors.value = next
}

function toRequest(): UpdateGroupRequest {
  return {
    name: form.name.trim(),
    topic: form.topic.trim(),
    detailKeywords: form.selectedKeywords,
    maxMembers: form.maxMembers,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
  }
}

function applyServerFieldErrors(payload: unknown): void {
  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    payload.errors &&
    typeof payload.errors === 'object'
  ) {
    fieldErrors.value = { ...fieldErrors.value, ...(payload.errors as Record<string, string>) }
  }
}

async function submit(): Promise<void> {
  errorMessage.value = ''

  if (!validateForm()) return

  isSubmitting.value = true
  try {
    const updated = await updateGroup(props.group.id, toRequest())
    emit('updated', updated)
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400 || error.status === 422) {
        applyServerFieldErrors(error.payload)
        errorMessage.value = error.message
      } else if (error.status === 404) {
        errorMessage.value = '그룹을 찾을 수 없어요. 이미 삭제되었을 수 있어요.'
      } else {
        errorMessage.value = error.message
      }
    } else {
      errorMessage.value = '그룹 정보를 수정하지 못했어요. 다시 시도해 주세요.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
    role="dialog"
    aria-modal="true"
    aria-labelledby="group-edit-modal-title"
    @mousedown.self="emit('close')"
  >
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />

    <div class="relative w-full max-w-2xl rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-2xl">
      <div class="mb-5 flex items-center justify-between">
        <h2 id="group-edit-modal-title" class="text-lg font-bold text-[var(--color-ink)]">
          그룹 정보 수정
        </h2>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
          aria-label="닫기"
          @click="emit('close')"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <form class="grid gap-5" @submit.prevent="submit">
        <!-- 그룹 이름 -->
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">그룹 이름</span>
          <input
            v-model="form.name"
            name="name"
            type="text"
            maxlength="120"
            class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25, 195, 125,0.12)]"
            @input="clearFieldError('name')"
          />
          <span v-if="fieldErrors.name" role="alert" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.name }}
          </span>
        </label>

        <!-- 스터디 주제 -->
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">스터디 주제</span>
          <input
            v-model="form.topic"
            name="topic"
            type="text"
            maxlength="120"
            class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25, 195, 125,0.12)]"
            @input="clearFieldError('topic')"
          />
          <span v-if="fieldErrors.topic" role="alert" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.topic }}
          </span>
        </label>

        <!-- 세부 키워드 -->
        <div class="grid gap-3 border-t border-[var(--color-line)] pt-4">
          <p class="text-sm font-semibold text-[var(--color-ink)]">세부 키워드</p>

          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="keyword in allKeywords"
              :key="keyword"
              type="button"
              :class="[
                'inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition',
                form.selectedKeywords.includes(keyword)
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
              ]"
              :aria-pressed="form.selectedKeywords.includes(keyword)"
              @click="toggleKeyword(keyword)"
            >
              {{ keyword }}
            </button>

            <template v-if="showCustomInput">
              <div class="inline-flex items-center gap-1">
                <input
                  ref="customInputRef"
                  v-model="customKeywordInput"
                  type="text"
                  maxlength="30"
                  placeholder="키워드 입력"
                  class="h-8 w-28 rounded-md border border-[var(--color-primary)] bg-[var(--color-card)] px-2 text-xs text-[var(--color-ink)] outline-none"
                  @keydown.enter.prevent="confirmCustomKeyword"
                  @keydown.escape="cancelCustomInput"
                />
                <button
                  type="button"
                  class="inline-flex h-8 items-center rounded-md bg-[var(--color-primary)] px-2.5 text-xs font-semibold text-white"
                  @click="confirmCustomKeyword"
                >
                  확인
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center rounded-md border border-[var(--color-line)] bg-[var(--color-active)] px-2.5 text-xs font-semibold text-[var(--color-muted)]"
                  @click="cancelCustomInput"
                >
                  취소
                </button>
              </div>
            </template>

            <button
              v-else
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-card)] text-base font-semibold text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              aria-label="키워드 직접 추가"
              @click="openCustomInput"
            >
              +
            </button>
          </div>

          <span v-if="fieldErrors.selectedKeywords" role="alert" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.selectedKeywords }}
          </span>
        </div>

        <!-- 모집 인원 / 시작일 / 종료일 -->
        <div class="grid gap-5 sm:grid-cols-3">
          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">모집 인원</span>
            <input
              v-model.number="form.maxMembers"
              name="maxMembers"
              type="number"
              min="1"
              class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25, 195, 125,0.12)]"
              @input="clearFieldError('maxMembers')"
            />
            <span v-if="fieldErrors.maxMembers" role="alert" class="text-xs font-semibold text-[var(--color-danger)]">
              {{ fieldErrors.maxMembers }}
            </span>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">시작일</span>
            <input
              v-model="form.startsAt"
              name="startsAt"
              type="date"
              class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25, 195, 125,0.12)]"
            />
            <span v-if="fieldErrors.startsAt" role="alert" class="text-xs font-semibold text-[var(--color-danger)]">
              {{ fieldErrors.startsAt }}
            </span>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">종료일</span>
            <input
              v-model="form.endsAt"
              name="endsAt"
              type="date"
              :min="form.startsAt"
              class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25, 195, 125,0.12)]"
            />
            <span v-if="fieldErrors.endsAt" role="alert" class="text-xs font-semibold text-[var(--color-danger)]">
              {{ fieldErrors.endsAt }}
            </span>
          </label>
        </div>

        <!-- 서버 에러 -->
        <p
          v-if="errorMessage"
          role="alert"
          class="rounded-lg border border-[rgba(237,66,69,0.3)] bg-[rgba(237,66,69,0.1)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
        >
          {{ errorMessage }}
        </p>

        <!-- 액션 버튼 -->
        <div class="flex justify-end gap-3 border-t border-[var(--color-line)] pt-4">
          <button
            type="button"
            class="inline-flex h-10 items-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            @click="emit('close')"
          >
            취소
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="inline-flex h-10 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isSubmitting ? '저장 중…' : '저장' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
