<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  getGroupCategoryColor,
  getGroupStatusLabel,
  listGroups,
  type ListGroupsParams,
  type StudyGroup,
  type StudyGroupStatus,
} from '@/entities/group'
import { listBookmarks, toggleBookmark } from '@/entities/bookmark'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

type StatusFilterOption = 'ALL' | 'ACTIVE' | 'COMPLETED'

const STATUS_FILTERS: { value: StatusFilterOption; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
]

const groups = ref<StudyGroup[]>([])
const isLoading = ref(true)
const errorMessage = ref('')

const bookmarkedGroupIds = ref(new Set<string>())
const togglingBookmarkIds = ref(new Set<string>())

const searchQuery = ref('')
const activeStatus = ref<StatusFilterOption>('ALL')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const hasGroups = computed(() => groups.value.length > 0)
const activeCount = computed(() => groups.value.filter((g) => g.status === 'ACTIVE').length)

function buildParams(): ListGroupsParams {
  const params: ListGroupsParams = { sort: 'startsAt', order: 'desc' }
  if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
  if (activeStatus.value !== 'ALL') params.status = activeStatus.value
  return params
}

onMounted(() => {
  void loadGroups()
  void loadBookmarkIds()
})

async function loadBookmarkIds(): Promise<void> {
  try {
    const list = await listBookmarks()
    bookmarkedGroupIds.value = new Set(list.map((b) => b.groupId))
  } catch {
    // 북마크 로딩 실패는 목록 표시에 영향 없음
  }
}

async function handleToggleBookmark(groupId: string): Promise<void> {
  if (togglingBookmarkIds.value.has(groupId)) return
  togglingBookmarkIds.value.add(groupId)
  try {
    const result = await toggleBookmark(groupId)
    const next = new Set(bookmarkedGroupIds.value)
    if (result.bookmarked) next.add(groupId)
    else next.delete(groupId)
    bookmarkedGroupIds.value = next
  } catch {
    // 토글 실패 시 상태 변경 없음
  } finally {
    togglingBookmarkIds.value.delete(groupId)
  }
}

watch(activeStatus, () => void loadGroups())

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadGroups(), 300)
})

async function loadGroups(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    groups.value = await listGroups(buildParams())
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹 목록을 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

function resetFilters(): void {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  searchQuery.value = ''
  activeStatus.value = 'ALL'
  void loadGroups()
}

// 상태별 진행바(라벨/퍼센트/색). progressPercent 가 없으면 상태 기반 기본값.
type ProgressView = { label: string; percent: number; color: string }

function progressView(group: StudyGroup): ProgressView {
  switch (group.status) {
    case 'ACTIVE':
      return {
        label: '커리큘럼 진행률',
        percent: clampPercent(group.progressPercent ?? 0),
        color: 'var(--color-primary)',
      }
    case 'READY_TO_START':
      return {
        label: '온보딩 완료',
        percent: clampPercent(group.progressPercent ?? 100),
        color: 'var(--color-warning)',
      }
    case 'ONBOARDING':
      return {
        label: '온보딩 진행',
        percent: clampPercent(group.progressPercent ?? 0),
        color: 'var(--color-info)',
      }
    case 'COMPLETED':
      return { label: '완료', percent: 100, color: 'var(--color-primary)' }
    default:
      return {
        label: '준비 중',
        percent: clampPercent(group.progressPercent ?? 0),
        color: 'var(--color-muted)',
      }
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

const STATUS_DOT: Record<StudyGroupStatus, string> = {
  DRAFT: 'var(--color-muted)',
  ONBOARDING: 'var(--color-info)',
  READY_TO_START: 'var(--color-warning)',
  ACTIVE: 'var(--color-success)',
  COMPLETED: 'var(--color-muted)',
  ARCHIVED: 'var(--color-muted)',
}
</script>

<template>
  <div class="mx-auto grid max-w-5xl gap-5">
    <!-- 헤더 -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-[var(--color-ink)]">참여 중인 스터디</h1>
        <p class="mt-1 text-sm text-[var(--color-muted)]">
          {{ groups.length }}개 그룹 · 진행 중 {{ activeCount }}개
        </p>
      </div>
      <RouterLink
        :to="{ name: 'group-create' }"
        class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--color-primary-deep)]"
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        새 그룹
      </RouterLink>
    </div>

    <!-- 검색 + 상태 필터 -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-56 flex-1">
        <svg
          class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          name="q"
          placeholder="그룹 이름 또는 주제로 검색"
          class="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] pl-10 pr-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
          aria-label="그룹 검색"
        />
      </div>

      <div class="flex gap-1.5" role="group" aria-label="상태 필터">
        <button
          v-for="filter in STATUS_FILTERS"
          :key="filter.value"
          type="button"
          :class="[
            'inline-flex h-9 items-center rounded-[var(--radius-chip)] px-4 text-sm font-semibold transition focus:outline-none',
            activeStatus === filter.value
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-line-strong)] hover:text-[var(--color-ink)]',
          ]"
          :aria-pressed="activeStatus === filter.value"
          @click="activeStatus = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <ScreenState
      v-if="isLoading"
      variant="loading"
      title="그룹을 불러오는 중입니다."
      description="참여 중인 스터디 그룹 목록을 확인하고 있습니다."
    />

    <ScreenState
      v-else-if="errorMessage"
      variant="error"
      title="목록을 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadGroups"
    />

    <ScreenState
      v-else-if="!hasGroups && (searchQuery || activeStatus !== 'ALL')"
      variant="empty"
      title="검색 결과가 없어요."
      description="다른 검색어나 필터를 사용해보세요."
      action-label="필터 초기화"
      @action="resetFilters"
    />

    <ScreenState
      v-else-if="!hasGroups"
      variant="empty"
      title="아직 참여 중인 그룹이 없어요."
      description="새 스터디 그룹을 만들거나 초대 코드로 참여하세요."
    >
      <template #actions>
        <RouterLink
          :to="{ name: 'group-create' }"
          class="inline-flex h-10 items-center rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
        >
          새 그룹 만들기
        </RouterLink>
        <RouterLink
          :to="{ name: 'group-join' }"
          class="inline-flex h-10 items-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
        >
          초대 코드로 참여
        </RouterLink>
      </template>
    </ScreenState>

    <!-- 그룹 카드 그리드 -->
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <RouterLink
        v-for="group in groups"
        :key="group.id"
        :to="{ name: 'group-overview', params: { groupId: group.id } }"
        class="group relative block rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--color-line-strong)] hover:shadow-[var(--shadow-strong)]"
      >
        <!-- 상단: 카테고리 + 즐겨찾기 -->
        <div class="flex items-start justify-between gap-3">
          <span
            class="inline-flex items-center gap-1.5 text-xs font-bold"
            :style="{ color: getGroupCategoryColor(group.topic) }"
          >
            <span
              class="h-2 w-2 rounded-full"
              :style="{ backgroundColor: getGroupCategoryColor(group.topic) }"
            />
            {{ group.topic }}
          </span>
          <button
            type="button"
            :aria-label="
              bookmarkedGroupIds.has(group.id) ? `${group.name} 찜 해제` : `${group.name} 찜하기`
            "
            :aria-pressed="bookmarkedGroupIds.has(group.id)"
            :disabled="togglingBookmarkIds.has(group.id)"
            class="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-lg transition hover:bg-[var(--color-hover)] focus:outline-none disabled:opacity-50"
            :class="
              bookmarkedGroupIds.has(group.id)
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-faint)]'
            "
            @click.prevent.stop="handleToggleBookmark(group.id)"
          >
            {{ bookmarkedGroupIds.has(group.id) ? '★' : '☆' }}
          </button>
        </div>

        <!-- 제목 -->
        <h2 class="mt-1.5 truncate text-lg font-bold text-[var(--color-ink)]">{{ group.name }}</h2>

        <!-- 상태 + 멤버 -->
        <div class="mt-2 flex items-center gap-2.5 text-xs">
          <span
            class="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-[var(--color-active)] px-2.5 py-1 font-semibold text-[var(--color-body)]"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: STATUS_DOT[group.status] }"
            />
            {{ getGroupStatusLabel(group.status) }}
          </span>
          <span class="text-[var(--color-muted)]">
            <template v-if="group.memberCount != null"
              >멤버 {{ group.memberCount }}/{{ group.maxMembers }}</template
            >
            <template v-else>멤버 {{ group.maxMembers }}명</template>
          </span>
        </div>

        <!-- 진행바 -->
        <div class="mt-4">
          <div class="mb-1.5 flex items-center justify-between text-xs">
            <span class="font-medium text-[var(--color-muted)]">{{
              progressView(group).label
            }}</span>
            <span class="font-bold" :style="{ color: progressView(group).color }">
              {{ progressView(group).percent }}%
            </span>
          </div>
          <div
            class="h-2 w-full overflow-hidden rounded-[var(--radius-chip)] bg-[var(--color-active)]"
          >
            <div
              class="h-full rounded-[var(--radius-chip)] transition-[width] duration-500"
              :style="{
                width: `${progressView(group).percent}%`,
                backgroundColor: progressView(group).color,
              }"
            />
          </div>
        </div>

        <!-- 주제 태그 -->
        <div v-if="group.detailKeywords.length" class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="keyword in group.detailKeywords.slice(0, 4)"
            :key="keyword"
            class="rounded-[var(--radius-chip)] bg-[var(--color-active)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
          >
            {{ keyword }}
          </span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
