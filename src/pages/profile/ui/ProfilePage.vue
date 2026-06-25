<script setup lang="ts">
/*
 * SSAFY Coach backend evidence (framework_back_hw_09_2@4abd8ecc94a9551896e1d7193ddf1f37973b662b):
 * #07 profile read/update: src/main/java/com/studypot/aistudyleader/auth/controller/AuthController.java,
 *     src/main/java/com/studypot/aistudyleader/auth/service/AuthSessionService.java,
 *     src/main/java/com/studypot/aistudyleader/auth/domain/AuthUser.java,
 *     src/main/java/com/studypot/aistudyleader/auth/repository/JdbcAuthAccountRepository.java.
 * AuthControllerTest verifies PATCH /api/v1/users/me nickname, bio, preferredTopics, and skillLevel.
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getCurrentUser, updateCurrentUser } from '@/entities/user/api/currentUser'
import type { User } from '@/entities/user/model/types'
import { useSessionStore } from '@/features/auth/session'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

const router = useRouter()
const sessionStore = useSessionStore()

const isLoggingOut = ref(false)

async function handleLogout(): Promise<void> {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await sessionStore.logoutCurrentSession()
    await router.replace({ name: 'login', query: { signedOut: 'current' } })
  } finally {
    isLoggingOut.value = false
  }
}

type PageState = 'loading' | 'view' | 'edit'

const pageState = ref<PageState>('loading')
const profile = ref<User | null>(null)
const errorMessage = ref('')

const form = reactive({
  nickname: '',
  bio: '',
  preferredTopics: [] as string[],
})
const topicInput = ref('')
const isSubmitting = ref(false)
const fieldError = ref('')
const submitError = ref('')

onMounted(() => {
  void loadProfile()
})

async function loadProfile(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    profile.value = await getCurrentUser()
    pageState.value = 'view'
  } catch {
    errorMessage.value = '프로필을 불러오지 못했습니다.'
    pageState.value = 'view'
  }
}

function prefillForm(user: User): void {
  form.nickname = user.nickname
  form.bio = user.bio ?? ''
  form.preferredTopics = [...(user.preferredTopics ?? [])]
}

function startEdit(): void {
  if (profile.value) prefillForm(profile.value)
  fieldError.value = ''
  submitError.value = ''
  pageState.value = 'edit'
}

function cancelEdit(): void {
  pageState.value = 'view'
}

function addTopic(): void {
  const topic = topicInput.value.trim()
  if (topic && !form.preferredTopics.includes(topic)) {
    form.preferredTopics.push(topic)
  }
  topicInput.value = ''
}

function removeTopic(index: number): void {
  form.preferredTopics.splice(index, 1)
}

async function handleSubmit(): Promise<void> {
  fieldError.value = ''
  submitError.value = ''

  if (!form.nickname.trim()) {
    fieldError.value = '닉네임을 입력해 주세요.'
    return
  }

  isSubmitting.value = true
  try {
    const updated = await updateCurrentUser({
      nickname: form.nickname.trim(),
      bio: form.bio.trim() || undefined,
      preferredTopics: form.preferredTopics.length > 0 ? form.preferredTopics : undefined,
    })
    profile.value = updated
    pageState.value = 'view'
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      const payload = error.payload as { errors?: Record<string, string> } | null
      fieldError.value = payload?.errors?.nickname ?? '입력 값을 확인해 주세요.'
    } else {
      submitError.value = error instanceof ApiError ? error.message : '저장 중 오류가 발생했어요.'
    }
  } finally {
    isSubmitting.value = false
  }
}

</script>

<template>
  <div class="mx-auto max-w-xl px-0 py-8 sm:px-4">
    <h1 class="text-2xl font-bold text-[var(--color-ink)]">내 프로필</h1>

    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="프로필을 불러오는 중입니다."
      class="mt-8"
    />

    <template v-else>
      <!-- 프로필 정보 섹션 -->
      <section
        class="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex items-start justify-between gap-3">
          <h2 class="text-lg font-bold text-[var(--color-ink)]">기본 정보</h2>
          <button
            v-if="pageState === 'view'"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)]"
            @click="startEdit"
          >
            수정
          </button>
        </div>

        <!-- 보기 모드 -->
        <template v-if="pageState === 'view' && profile">
          <dl class="mt-4 grid gap-3 text-sm">
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

        <!-- 편집 모드 -->
        <form
          v-else-if="pageState === 'edit'"
          class="mt-4 grid gap-4"
          @submit.prevent="handleSubmit"
        >
          <div>
            <label for="profile-nickname" class="text-sm font-semibold text-[var(--color-ink)]">
              닉네임 <span class="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="profile-nickname"
              v-model="form.nickname"
              name="nickname"
              type="text"
              maxlength="50"
              placeholder="닉네임을 입력해 주세요."
              class="mt-2 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
            />
            <p
              v-if="fieldError"
              role="alert"
              class="mt-1 text-xs font-semibold text-[var(--color-danger)]"
            >
              {{ fieldError }}
            </p>
          </div>

          <div>
            <label for="profile-bio" class="text-sm font-semibold text-[var(--color-ink)]">
              자기소개 <span class="font-normal text-[var(--color-muted)]">(선택)</span>
            </label>
            <textarea
              id="profile-bio"
              v-model="form.bio"
              name="bio"
              rows="3"
              maxlength="200"
              placeholder="간단한 자기소개를 입력해 주세요."
              class="mt-2 w-full resize-none rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
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
                class="h-10 flex-1 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
                @keydown.enter.prevent="addTopic"
              />
              <button
                type="button"
                class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none"
                @click="addTopic"
              >
                추가
              </button>
            </div>
            <div v-if="form.preferredTopics.length > 0" class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="(topic, i) in form.preferredTopics"
                :key="topic"
                class="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-active)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-ink)]"
              >
                {{ topic }}
                <button
                  type="button"
                  :aria-label="`${topic} 제거`"
                  class="inline-flex h-6 w-6 -mr-1 items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-danger)] focus:outline-none"
                  @click="removeTopic(i)"
                >
                  ✕
                </button>
              </span>
            </div>
          </div>

          <p
            v-if="submitError"
            role="alert"
            class="text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ submitError }}
          </p>

          <div class="flex gap-3">
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none"
              @click="cancelEdit"
            >
              취소
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-50"
            >
              {{ isSubmitting ? '저장 중…' : '저장' }}
            </button>
          </div>
        </form>
      </section>

      <!-- 로그아웃 -->
      <div class="mt-6">
        <button
          type="button"
          :disabled="isLoggingOut"
          class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(237,66,69,0.06)] disabled:opacity-50"
          @click="handleLogout"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {{ isLoggingOut ? '로그아웃 중…' : '로그아웃' }}
        </button>
      </div>
    </template>
  </div>
</template>
