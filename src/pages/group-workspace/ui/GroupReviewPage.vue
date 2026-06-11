<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

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

if (!workspaceContext) {
  throw new Error('GroupReviewPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'loading' | 'ready' | 'error'

const pageState = ref<PageState>('loading')
const pageError = ref('')

const stats = ref<ReviewStats | null>(null)
const reviews = ref<Review[]>([])
const myReview = ref<Review | null>(null)

const selectedRating = ref(0)
const hoverRating = ref(0)
const reviewContent = ref('')
const isSubmitting = ref(false)
const submitError = ref('')
const submitFieldError = ref('')
const submitSuccess = ref(false)

onMounted(() => {
  void loadPage()
})

async function loadPage(): Promise<void> {
  pageState.value = 'loading'
  pageError.value = ''

  try {
    const [statsResult, reviewsResult] = await Promise.all([
      getReviewStats(groupId.value),
      listReviews(groupId.value),
    ])
    stats.value = statsResult
    reviews.value = reviewsResult

    try {
      myReview.value = await getMyReview(groupId.value)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }

    pageState.value = 'ready'
  } catch (error) {
    pageError.value =
      error instanceof ApiError ? error.message : '리뷰 정보를 불러오지 못했습니다.'
    pageState.value = 'error'
  }
}

async function submitReview(): Promise<void> {
  submitError.value = ''
  submitFieldError.value = ''

  if (selectedRating.value === 0) {
    submitFieldError.value = '평점을 선택해 주세요.'
    return
  }

  isSubmitting.value = true

  try {
    const created = await createReview(groupId.value, {
      rating: selectedRating.value,
      content: reviewContent.value.trim() || undefined,
    })

    myReview.value = created
    submitSuccess.value = true
    reviews.value = [created, ...reviews.value]

    if (stats.value) {
      const newTotal = stats.value.totalCount + 1
      const newAvg =
        (stats.value.averageRating * stats.value.totalCount + created.rating) / newTotal
      const dist = { ...stats.value.ratingDistribution }
      const key = String(created.rating)
      dist[key] = (dist[key] ?? 0) + 1
      stats.value = {
        averageRating: Math.round(newAvg * 10) / 10,
        totalCount: newTotal,
        ratingDistribution: dist,
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        submitError.value = '이미 리뷰를 작성했습니다.'
        void loadPage()
      } else if (error.status === 400) {
        const payload = error.payload as { errors?: Record<string, string> } | null
        submitFieldError.value = payload?.errors?.rating ?? '입력 값을 확인해 주세요.'
      } else {
        submitError.value = error.message
      }
    } else {
      submitError.value = '리뷰 제출에 실패했습니다.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(value),
  )
}

function ratingLabel(rating: number): string {
  const labels: Record<number, string> = {
    1: '별로예요',
    2: '아쉬워요',
    3: '보통이에요',
    4: '좋아요',
    5: '최고예요',
  }
  return labels[rating] ?? ''
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
      <!-- 평점 통계 -->
      <section
        v-if="stats"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <p class="text-sm font-semibold text-[var(--color-primary)]">스터디 리뷰</p>
        <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">평균 평점</h2>

        <div class="mt-4 flex items-end gap-6">
          <div class="text-center">
            <p class="text-5xl font-bold text-[var(--color-ink)]">
              {{ stats.averageRating.toFixed(1) }}
            </p>
            <div class="mt-2 flex justify-center gap-0.5" aria-label="평균 평점">
              <span
                v-for="star in 5"
                :key="star"
                :class="[
                  'text-2xl',
                  star <= Math.round(stats.averageRating)
                    ? 'text-yellow-400'
                    : 'text-[var(--color-line-strong)]',
                ]"
              >★</span>
            </div>
            <p class="mt-1 text-sm text-[var(--color-muted)]">{{ stats.totalCount }}개의 리뷰</p>
          </div>

          <dl class="flex-1 grid gap-1.5">
            <div
              v-for="star in [5, 4, 3, 2, 1]"
              :key="star"
              class="flex items-center gap-2 text-xs"
            >
              <dt class="w-6 shrink-0 text-right text-[var(--color-muted)]">{{ star }}점</dt>
              <div class="h-2 flex-1 rounded-full bg-[var(--color-active)]">
                <div
                  class="h-full rounded-full bg-yellow-400 transition-all"
                  :style="{
                    width:
                      stats.totalCount > 0
                        ? `${((stats.ratingDistribution[String(star)] ?? 0) / stats.totalCount) * 100}%`
                        : '0%',
                  }"
                />
              </div>
              <dd class="w-5 shrink-0 text-[var(--color-muted)]">
                {{ stats.ratingDistribution[String(star)] ?? 0 }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- 내 리뷰 / 작성 폼 -->
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">내 리뷰</h3>

        <!-- 이미 작성한 경우 -->
        <div v-if="myReview" class="mt-4">
          <div class="flex items-center gap-1" aria-label="내 평점">
            <span
              v-for="star in 5"
              :key="star"
              :class="['text-xl', star <= myReview.rating ? 'text-yellow-400' : 'text-[var(--color-line-strong)]']"
            >★</span>
            <span class="ml-2 text-sm font-semibold text-[var(--color-ink)]">
              {{ myReview.rating }}점
            </span>
          </div>
          <p v-if="myReview.content" class="mt-3 text-sm leading-6 text-[var(--color-ink)]">
            {{ myReview.content }}
          </p>
          <p class="mt-2 text-xs text-[var(--color-muted)]">{{ formatDate(myReview.createdAt) }}</p>
          <p
            class="mt-3 inline-flex items-center gap-1 rounded-md bg-[var(--color-active)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]"
          >
            이미 리뷰를 작성했습니다.
          </p>
        </div>

        <!-- 작성 폼 -->
        <form v-else class="mt-4" @submit.prevent="submitReview">
          <!-- 별점 선택 -->
          <fieldset>
            <legend class="text-sm font-semibold text-[var(--color-ink)]">평점 <span class="text-[var(--color-danger)]">*</span></legend>
            <div class="mt-2 flex items-center gap-1">
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                :aria-label="`${star}점`"
                :aria-pressed="selectedRating === star"
                class="text-3xl transition-transform hover:scale-110 focus:outline-none"
                :class="
                  star <= (hoverRating || selectedRating)
                    ? 'text-yellow-400'
                    : 'text-[var(--color-line-strong)]'
                "
                @mouseenter="hoverRating = star"
                @mouseleave="hoverRating = 0"
                @click="selectedRating = star"
              >★</button>
              <span
                v-if="hoverRating || selectedRating"
                class="ml-2 text-sm text-[var(--color-muted)]"
              >
                {{ ratingLabel(hoverRating || selectedRating) }}
              </span>
            </div>
            <p
              v-if="submitFieldError"
              role="alert"
              class="mt-1 text-xs font-semibold text-[var(--color-danger)]"
            >
              {{ submitFieldError }}
            </p>
          </fieldset>

          <!-- 리뷰 내용 -->
          <div class="mt-4">
            <label for="review-content" class="text-sm font-semibold text-[var(--color-ink)]">
              리뷰 내용 <span class="text-[var(--color-muted)]">(선택)</span>
            </label>
            <textarea
              id="review-content"
              v-model="reviewContent"
              name="content"
              rows="4"
              maxlength="500"
              placeholder="스터디 경험을 자유롭게 작성해 주세요."
              class="mt-2 w-full resize-none rounded-md border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
            />
            <p class="mt-1 text-right text-xs text-[var(--color-muted)]">
              {{ reviewContent.length }} / 500
            </p>
          </div>

          <p
            v-if="submitError"
            role="alert"
            class="mt-3 text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ submitError }}
          </p>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
          >
            {{ isSubmitting ? '제출 중…' : '리뷰 제출' }}
          </button>
        </form>
      </section>

      <!-- 전체 리뷰 목록 -->
      <section
        v-if="reviews.length > 0"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <h3 class="text-base font-bold text-[var(--color-ink)]">
          전체 리뷰 <span class="ml-1 text-sm font-normal text-[var(--color-muted)]">{{ reviews.length }}개</span>
        </h3>

        <ul class="mt-4 grid gap-4">
          <li
            v-for="review in reviews"
            :key="review.id"
            class="border-t border-[var(--color-line)] pt-4 first:border-t-0 first:pt-0"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-[var(--color-ink)]">
                  {{ review.displayName ?? '익명' }}
                </span>
                <div class="flex gap-0.5" :aria-label="`${review.rating}점`">
                  <span
                    v-for="star in 5"
                    :key="star"
                    :class="['text-sm', star <= review.rating ? 'text-yellow-400' : 'text-[var(--color-line-strong)]']"
                  >★</span>
                </div>
              </div>
              <time class="text-xs text-[var(--color-muted)]">{{ formatDate(review.createdAt) }}</time>
            </div>
            <p v-if="review.content" class="mt-2 text-sm leading-6 text-[var(--color-ink)]">
              {{ review.content }}
            </p>
          </li>
        </ul>
      </section>

      <p
        v-else
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted)]"
      >
        아직 작성된 리뷰가 없어요.
      </p>
    </template>
  </div>
</template>
