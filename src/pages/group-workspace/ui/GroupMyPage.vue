<script setup lang="ts">
import { inject, onMounted, reactive, ref } from 'vue'

import {
  getMyOnboarding,
  submitMyOnboarding,
  type AvailabilitySlot,
  type OnboardingResponse,
} from '@/entities/onboarding'
import { getCurrentUser, updateCurrentUser } from '@/entities/user/api/currentUser'
import type { User } from '@/entities/user/model/types'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
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
  throw new Error('GroupMyPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'view' | 'edit' | 'error'

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

// ── 사용자 프로필 ──────────────────────────────────────────
type ProfileState = 'loading' | 'view' | 'edit'

const profileState = ref<ProfileState>('loading')
const profile = ref<User | null>(null)
const profileForm = reactive({
  nickname: '',
  bio: '',
  preferredTopics: [] as string[],
})
const topicInput = ref('')
const isProfileSubmitting = ref(false)
const profileError = ref('')
const profileFieldError = ref('')

onMounted(() => {
  void loadProfile()
  void loadOnboarding()
})

async function loadProfile(): Promise<void> {
  profileState.value = 'loading'
  try {
    profile.value = await getCurrentUser()
    prefillProfileForm(profile.value)
    profileState.value = 'view'
  } catch {
    profileState.value = 'view'
  }
}

function prefillProfileForm(user: User): void {
  profileForm.nickname = user.nickname
  profileForm.bio = user.bio ?? ''
  profileForm.preferredTopics = [...(user.preferredTopics ?? [])]
}

function startEditProfile(): void {
  if (profile.value) prefillProfileForm(profile.value)
  profileError.value = ''
  profileFieldError.value = ''
  profileState.value = 'edit'
}

function cancelEditProfile(): void {
  profileState.value = 'view'
}

function addTopic(): void {
  const topic = topicInput.value.trim()
  if (topic && !profileForm.preferredTopics.includes(topic)) {
    profileForm.preferredTopics.push(topic)
  }
  topicInput.value = ''
}

function removeTopic(index: number): void {
  profileForm.preferredTopics.splice(index, 1)
}

async function handleProfileSubmit(): Promise<void> {
  profileError.value = ''
  profileFieldError.value = ''

  if (!profileForm.nickname.trim()) {
    profileFieldError.value = '닉네임은 필수 입력 값입니다.'
    return
  }

  isProfileSubmitting.value = true

  try {
    const updated = await updateCurrentUser({
      nickname: profileForm.nickname.trim(),
      bio: profileForm.bio.trim() || undefined,
      preferredTopics:
        profileForm.preferredTopics.length > 0 ? profileForm.preferredTopics : undefined,
    })
    profile.value = updated
    profileState.value = 'view'
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        const payload = error.payload as { errors?: Record<string, string> } | null
        profileFieldError.value = payload?.errors?.nickname ?? '입력 값을 확인해 주세요.'
      } else {
        profileError.value = error.message
      }
    } else {
      profileError.value = '프로필 저장 중 오류가 발생했습니다.'
    }
  } finally {
    isProfileSubmitting.value = false
  }
}
// ────────────────────────────────────────────────────────────

async function loadOnboarding(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''

  try {
    const data = await getMyOnboarding(groupId.value)
    onboarding.value = data
    prefillForm(data)
    pageState.value = data.status === 'SUBMITTED' ? 'view' : 'edit'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      pageState.value = 'edit'
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

function startEdit(): void {
  if (onboarding.value) prefillForm(onboarding.value)
  pageState.value = 'edit'
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
    pageState.value = 'view'
  } catch (error) {
    submitError.value =
      error instanceof ApiError ? error.message : '저장 중 오류가 발생했습니다.'
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
    <!-- ── 사용자 프로필 섹션 ── -->
    <section
      v-if="profileState !== 'loading'"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-[var(--color-primary)]">마이페이지</p>
          <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">내 프로필</h2>
        </div>
        <button
          v-if="profileState === 'view'"
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
          @click="startEditProfile"
        >
          수정
        </button>
      </div>

      <!-- 보기 -->
      <template v-if="profileState === 'view' && profile">
        <dl class="mt-5 grid gap-3 text-sm">
          <div>
            <dt class="text-[var(--color-muted)]">이메일</dt>
            <dd class="mt-0.5 font-medium text-[var(--color-ink)]">{{ profile.email }}</dd>
          </div>
          <div>
            <dt class="text-[var(--color-muted)]">닉네임</dt>
            <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">{{ profile.nickname }}</dd>
          </div>
          <div v-if="profile.bio">
            <dt class="text-[var(--color-muted)]">자기소개</dt>
            <dd class="mt-0.5 leading-6 text-[var(--color-ink)]">{{ profile.bio }}</dd>
          </div>
          <div v-if="profile.preferredTopics && profile.preferredTopics.length > 0">
            <dt class="text-[var(--color-muted)]">관심 주제</dt>
            <dd class="mt-1.5 flex flex-wrap gap-2">
              <span
                v-for="topic in profile.preferredTopics"
                :key="topic"
                class="rounded-full border border-[var(--color-line)] bg-[var(--color-active)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-ink)]"
              >
                {{ topic }}
              </span>
            </dd>
          </div>
        </dl>
      </template>

      <!-- 편집 폼 -->
      <form
        v-else-if="profileState === 'edit'"
        class="mt-5 grid gap-4"
        @submit.prevent="handleProfileSubmit"
      >
        <div>
          <label for="profile-nickname" class="text-sm font-semibold text-[var(--color-ink)]">
            닉네임 <span class="text-[var(--color-danger)]">*</span>
          </label>
          <input
            id="profile-nickname"
            v-model="profileForm.nickname"
            name="nickname"
            type="text"
            maxlength="50"
            class="mt-2 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
          />
          <p
            v-if="profileFieldError"
            role="alert"
            class="mt-1 text-xs font-semibold text-[var(--color-danger)]"
          >
            {{ profileFieldError }}
          </p>
        </div>

        <div>
          <label for="profile-bio" class="text-sm font-semibold text-[var(--color-ink)]">
            자기소개 <span class="font-normal text-[var(--color-muted)]">(선택)</span>
          </label>
          <textarea
            id="profile-bio"
            v-model="profileForm.bio"
            name="bio"
            rows="3"
            maxlength="200"
            placeholder="간단한 자기소개를 입력해 주세요."
            class="mt-2 w-full resize-none rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
          />
        </div>

        <div>
          <p class="text-sm font-semibold text-[var(--color-ink)]">
            관심 주제 <span class="font-normal text-[var(--color-muted)]">(선택)</span>
          </p>
          <div class="mt-2 flex gap-2">
            <input
              v-model="topicInput"
              type="text"
              name="topic-input"
              placeholder="주제 입력 후 추가"
              maxlength="30"
              class="flex-1 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
              @keydown.enter.prevent="addTopic"
            />
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
              @click="addTopic"
            >
              추가
            </button>
          </div>
          <div v-if="profileForm.preferredTopics.length > 0" class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="(topic, i) in profileForm.preferredTopics"
              :key="topic"
              class="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-active)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-ink)]"
            >
              {{ topic }}
              <button
                type="button"
                :aria-label="`${topic} 제거`"
                class="ml-0.5 text-[var(--color-muted)] hover:text-[var(--color-danger)] focus:outline-none"
                @click="removeTopic(i)"
              >
                ✕
              </button>
            </span>
          </div>
        </div>

        <p
          v-if="profileError"
          role="alert"
          class="text-sm font-semibold text-[var(--color-danger)]"
        >
          {{ profileError }}
        </p>

        <div class="flex gap-3">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
            @click="cancelEditProfile"
          >
            취소
          </button>
          <button
            type="submit"
            :disabled="isProfileSubmitting"
            class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
          >
            {{ isProfileSubmitting ? '저장 중…' : '저장' }}
          </button>
        </div>
      </form>
    </section>

    <!-- ── 온보딩 섹션 ── -->
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="내 정보를 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="정보를 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadOnboarding"
    />

    <!-- 보기 모드 -->
    <section
      v-else-if="pageState === 'view' && onboarding"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-[var(--color-primary)]">온보딩</p>
          <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">나의 온보딩 정보</h2>
          <p v-if="onboarding.submittedAt" class="mt-1 text-sm text-[var(--color-muted)]">
            제출일: {{ formatSubmittedAt(onboarding.submittedAt) }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
          @click="startEdit"
        >
          수정
        </button>
      </div>

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

    <!-- 편집 모드 -->
    <section
      v-else-if="pageState === 'edit'"
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">온보딩</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">나의 준비 정보</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        스터디 참여에 필요한 숙련도와 가능한 시간을 입력하고 저장하세요.
      </p>

      <form class="mt-6 grid gap-6" @submit.prevent="handleSubmit">
        <fieldset>
          <legend class="text-sm font-semibold text-[var(--color-ink)]">숙련도</legend>
          <div class="mt-3 flex flex-wrap gap-2">
            <label v-for="level in [1, 2, 3, 4, 5]" :key="level" class="cursor-pointer">
              <input v-model="form.skillLevel" type="radio" :value="level" class="sr-only" />
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
          <label class="text-sm font-semibold text-[var(--color-ink)]" for="myAdditionalNote">
            추가 메모 <span class="font-normal text-[var(--color-muted)]">(선택)</span>
          </label>
          <textarea
            id="myAdditionalNote"
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
              <input
                v-model="slot.startTime"
                type="time"
                class="rounded border border-[var(--color-line)] bg-[var(--color-input)] px-2 py-1 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
              />
              <input
                v-model="slot.endTime"
                type="time"
                class="rounded border border-[var(--color-line)] bg-[var(--color-input)] px-2 py-1 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
              />
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

        <div class="flex gap-3">
          <button
            v-if="onboarding"
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
            @click="pageState = 'view'"
          >
            취소
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
          >
            {{ isSubmitting ? '저장 중…' : '저장' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
