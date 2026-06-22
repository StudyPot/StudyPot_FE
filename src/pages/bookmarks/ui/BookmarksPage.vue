<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { listBookmarks, toggleBookmark, type Bookmark } from '@/entities/bookmark'
import { getGroupStatusLabel } from '@/entities/group'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

type PageState = 'loading' | 'loaded' | 'error'

const pageState = ref<PageState>('loading')
const errorMessage = ref('')
const bookmarks = ref<Bookmark[]>([])
const togglingGroupIds = ref(new Set<string>())

onMounted(() => {
  void loadBookmarks()
})

async function loadBookmarks(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    bookmarks.value = await listBookmarks()
    pageState.value = 'loaded'
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '찜 목록을 불러오지 못했습니다.'
    pageState.value = 'error'
  }
}

async function handleToggle(groupId: string): Promise<void> {
  if (togglingGroupIds.value.has(groupId)) return
  togglingGroupIds.value.add(groupId)
  try {
    const result = await toggleBookmark(groupId)
    if (!result.bookmarked) {
      bookmarks.value = bookmarks.value.filter((b) => b.groupId !== groupId)
    }
  } catch {
    // ignore toggle errors silently
  } finally {
    togglingGroupIds.value.delete(groupId)
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(value),
  )
}

function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
}
</script>

<template>
  <div class="grid gap-4">
    <!-- 헤더 -->
    <div>
      <h2 class="text-lg font-bold text-[var(--color-ink)]">찜한 스터디</h2>
      <p class="mt-0.5 text-sm text-[var(--color-muted)]">관심 있는 스터디 그룹 목록입니다.</p>
    </div>

    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="찜 목록을 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="목록을 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadBookmarks"
    />

    <ScreenState
      v-else-if="bookmarks.length === 0"
      variant="empty"
      title="아직 찜한 스터디가 없어요."
      description="그룹 목록에서 ★ 버튼을 눌러 관심 스터디를 저장하세요."
    />

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <article
        v-for="bookmark in bookmarks"
        :key="bookmark.groupId"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 transition hover:border-[var(--color-line-strong)]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-[var(--color-primary)]">
              {{ bookmark.group.topic }}
            </p>
            <h3 class="mt-1 text-base font-bold text-[var(--color-ink)]">
              {{ bookmark.group.name }}
            </h3>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              class="rounded-full bg-[var(--color-active)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]"
            >
              {{ getGroupStatusLabel(bookmark.group.status) }}
            </span>
            <button
              type="button"
              :aria-label="`${bookmark.group.name} 찜 해제`"
              :aria-pressed="true"
              :disabled="togglingGroupIds.has(bookmark.groupId)"
              class="flex h-8 w-8 items-center justify-center rounded text-lg text-[var(--color-primary)] transition hover:bg-[var(--color-hover)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
              @click="handleToggle(bookmark.groupId)"
            >
              ★
            </button>
          </div>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-xs text-[var(--color-muted-deep)]">기간</dt>
            <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">
              {{ formatDateRange(bookmark.group.startsAt, bookmark.group.endsAt) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-[var(--color-muted-deep)]">정원</dt>
            <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">
              {{ bookmark.group.maxMembers }}명
            </dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="keyword in bookmark.group.detailKeywords"
            :key="keyword"
            class="rounded bg-[var(--color-active)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]"
          >
            {{ keyword }}
          </span>
        </div>

        <div class="mt-4 flex justify-end">
          <RouterLink
            :to="{ name: 'group-overview', params: { groupId: bookmark.groupId } }"
            class="inline-flex h-8 items-center rounded border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
          >
            그룹 홈
          </RouterLink>
        </div>
      </article>
    </div>
  </div>
</template>
