<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import { getMyGroupMemberProfile } from '@/entities/group'
import {
  createReview,
  getMyReview,
  getReviewStats,
  listReviews,
  type Review,
  type ReviewStats,
} from '@/entities/review'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupReviewPage must be used inside GroupWorkspacePage.')
const { groupId } = workspaceContext

type PageState = 'loading' | 'ready' | 'error'

const pageState = ref<PageState>('loading')
const pageError = ref('')
const hasPendingTodos = ref(false)

const stats = ref<ReviewStats | null>(null)
const reviewList = ref<Review[]>([])
const myReview = ref<Review | null>(null)

const rating = ref(0)
const content = ref('')
const isSubmitting = ref(false)
const submitError = ref('')
const ratingError = ref('')

onMounted(() => void loadPage())

async function loadPage(): Promise<void> {
  pageState.value = 'loading'
  pageError.value = ''

  // todo 미완료 체크 (실패해도 페이지 차단 안 함)
  try {
    const profile = await getMyGroupMemberProfile(groupId.value)
    hasPendingTodos.value = profile.taskCompletion.incompleteCount > 0
  } catch {
    hasPendingTodos.value = false
  }

  try {
    const [statsRes, listRes, myRes] = await Promise.allSettled([
      getReviewStats(groupId.value),
      listReviews(groupId.value),
      getMyReview(groupId.value),
    ])

    if (statsRes.status === 'fulfilled') stats.value = statsRes.value
    else throw statsRes.reason

    if (listRes.status === 'fulfilled') reviewList.value = listRes.value

    if (myRes.status === 'fulfilled') {
      myReview.value = myRes.value
    } else if (myRes.reason instanceof ApiError && myRes.reason.status === 404) {
      myReview.value = null
    } else {
      throw myRes.reason
    }

    pageState.value = 'ready'
  } catch (err) {
    pageError.value = err instanceof ApiError ? err.message : '리뷰를 불러오지 못했습니다.'
    pageState.value = 'error'
  }
}

async function handleSubmit(): Promise<void> {
  ratingError.value = ''
  submitError.value = ''

  if (rating.value === 0) {
    ratingError.value = '평점을 선택해 주세요.'
    return
  }

  isSubmitting.value = true
  try {
    const created = await createReview(groupId.value, {
      rating: rating.value,
      content: content.value.trim() || undefined,
    })
    myReview.value = created
    reviewList.value = [created, ...reviewList.value]
    if (stats.value) {
      stats.value = {
        ...stats.value,
        totalCount: stats.value.totalCount + 1,
        averageRating:
          Math.round(
            ((stats.value.averageRating * stats.value.totalCount + rating.value) /
              (stats.value.totalCount + 1)) *
              10,
          ) / 10,
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      submitError.value = '이미 리뷰를 작성했습니다.'
      void loadPage()
    } else {
      submitError.value = err instanceof ApiError ? err.message : '저장에 실패했습니다.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <div class="grid gap-5">
    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="리뷰를 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="리뷰를 불러오지 못했습니다."
      :description="pageError"
      action-label="다시 시도"
      @action="loadPage"
    />

    <template v-else-if="pageState === 'ready'">
      <!-- Todo 미완료 차단 -->
      <section
        v-if="hasPendingTodos"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-10 text-center shadow-[var(--shadow-soft)]"
      >
        <p class="text-3xl">📝</p>
        <p class="mt-4 text-base font-bold text-[var(--color-ink)]">아직 완료하지 않은 Todo가 있어요</p>
        <p class="mt-2 text-sm text-[var(--color-muted)]">이번 주 할 일을 모두 완료한 뒤 리뷰를 작성할 수 있어요.</p>
        <RouterLink
          :to="{ name: 'group-todo', params: { groupId } }"
          class="mt-5 inline-flex h-9 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
        >
          Todo 완료하러 가기
        </RouterLink>
      </section>

      <template v-else>
        <!-- 통계 -->
        <section
          v-if="stats"
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm font-semibold text-[var(--color-primary)]">스터디 리뷰</p>
          <div class="mt-3 flex items-center gap-4">
            <span class="text-4xl font-bold text-[var(--color-ink)]">{{ stats.averageRating }}</span>
            <div>
              <div class="flex gap-0.5">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-xl"
                  :class="i <= Math.round(stats.averageRating) ? 'text-yellow-400' : 'text-[var(--color-line-strong)]'"
                >★</span>
              </div>
              <p class="mt-0.5 text-xs text-[var(--color-muted)]">{{ stats.totalCount }}개의 리뷰</p>
            </div>
          </div>
        </section>

        <!-- 이미 리뷰 작성한 경우 -->
        <section
          v-if="myReview"
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <p class="text-sm font-semibold text-[var(--color-primary)]">내 리뷰</p>
          <p class="mt-1 text-sm font-bold text-[var(--color-ink)]">이미 리뷰를 작성했습니다.</p>
          <div class="mt-3 flex gap-0.5">
            <span
              v-for="i in 5"
              :key="i"
              class="text-lg"
              :class="i <= myReview.rating ? 'text-yellow-400' : 'text-[var(--color-line-strong)]'"
            >★</span>
          </div>
          <p v-if="myReview.content" class="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-ink)]">
            {{ myReview.content }}
          </p>
          <p class="mt-3 text-xs text-[var(--color-muted)]">{{ formatDate(myReview.createdAt) }} 작성</p>
        </section>

        <!-- 리뷰 작성 폼 -->
        <section
          v-else
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-soft)]"
        >
          <div class="border-b border-[var(--color-line)] px-6 py-5">
            <p class="text-sm font-semibold text-[var(--color-primary)]">리뷰 작성</p>
            <h2 class="mt-0.5 text-xl font-bold text-[var(--color-ink)]">스터디는 어떠셨나요?</h2>
          </div>
          <form class="px-6 py-5" @submit.prevent="handleSubmit">
            <!-- 별점 -->
            <label class="block text-sm font-semibold text-[var(--color-ink)]">
              평점 <span class="ml-0.5 text-[var(--color-danger)]">*</span>
            </label>
            <div class="mt-2 flex gap-1">
              <button
                v-for="i in 5"
                :key="i"
                type="button"
                :aria-label="`${i}점`"
                class="text-3xl transition-transform hover:scale-110 focus:outline-none"
                :class="i <= rating ? 'text-yellow-400' : 'text-[var(--color-line-strong)]'"
                @click="rating = i"
              >★</button>
            </div>
            <p v-if="ratingError" class="mt-1 text-xs font-semibold text-[var(--color-danger)]">
              {{ ratingError }}
            </p>

            <!-- 내용 -->
            <label class="mt-5 block text-sm font-semibold text-[var(--color-ink)]">
              한 줄 소감 <span class="ml-0.5 text-xs font-normal text-[var(--color-muted)]">(선택)</span>
            </label>
            <textarea
              v-model="content"
              rows="4"
              maxlength="500"
              placeholder="이번 스터디에 대한 솔직한 소감을 남겨보세요."
              class="mt-2 w-full resize-none rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
            />

            <div class="mt-4 flex items-center justify-end gap-3">
              <p v-if="submitError" role="alert" class="flex-1 text-sm font-semibold text-[var(--color-danger)]">
                {{ submitError }}
              </p>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
              >
                {{ isSubmitting ? '제출 중…' : '리뷰 제출' }}
              </button>
            </div>
          </form>
        </section>

        <!-- 다른 팀원 리뷰 목록 -->
        <section
          v-if="reviewList.length > 0"
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-soft)]"
        >
          <div class="border-b border-[var(--color-line)] px-6 py-4">
            <p class="text-sm font-semibold text-[var(--color-ink)]">팀원 리뷰</p>
          </div>
          <div class="divide-y divide-[var(--color-line)]">
            <div v-for="r in reviewList" :key="r.id" class="px-6 py-4">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold text-[var(--color-ink)]">{{ r.displayName ?? '익명' }}</p>
                <div class="flex gap-0.5">
                  <span
                    v-for="i in 5"
                    :key="i"
                    class="text-sm"
                    :class="i <= r.rating ? 'text-yellow-400' : 'text-[var(--color-line-strong)]'"
                  >★</span>
                </div>
              </div>
              <p v-if="r.content" class="mt-1 text-sm leading-6 text-[var(--color-muted)]">{{ r.content }}</p>
              <p class="mt-1 text-xs text-[var(--color-muted-deep)]">{{ formatDate(r.createdAt) }}</p>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
