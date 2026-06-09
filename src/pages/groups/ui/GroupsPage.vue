<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  getGroupListPrimaryEntry,
  getGroupStatusLabel,
  listGroups,
  type GroupEntryAction,
  type GroupSortField,
  type ListGroupsParams,
  type SortOrder,
  type StudyGroup,
  type StudyGroupStatus,
} from '@/entities/group'
import { startStudy } from '@/entities/curriculum'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

type StatusFilterOption = StudyGroupStatus | 'ALL'
type SortOption = { field: GroupSortField; order: SortOrder; label: string }

const STATUS_FILTERS: { value: StatusFilterOption; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'ONBOARDING', label: '온보딩' },
  { value: 'READY_TO_START', label: '시작 대기' },
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
]

const SORT_OPTIONS: SortOption[] = [
  { field: 'startsAt', order: 'desc', label: '최신 시작순' },
  { field: 'startsAt', order: 'asc', label: '오래된 시작순' },
  { field: 'endsAt', order: 'asc', label: '종료 임박순' },
  { field: 'name', order: 'asc', label: '이름 오름차순' },
  { field: 'name', order: 'desc', label: '이름 내림차순' },
]

const groups = ref<StudyGroup[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const startingGroupId = ref<string | null>(null)
const startError = ref<Record<string, string>>({})
const showStartModal = ref(false)
const startProgress = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null

// 검색·필터·정렬 상태
const searchQuery = ref('')
const activeStatus = ref<StatusFilterOption>('ALL')
const activeSortIndex = ref(0)

let searchTimer: ReturnType<typeof setTimeout> | null = null

const hasGroups = computed(() => groups.value.length > 0)
const activeSort = computed(() => SORT_OPTIONS[activeSortIndex.value])

function buildParams(): ListGroupsParams {
  const params: ListGroupsParams = {}
  if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
  if (activeStatus.value !== 'ALL') params.status = activeStatus.value
  params.sort = activeSort.value.field
  params.order = activeSort.value.order
  return params
}

onMounted(() => {
  void loadGroups()
})

// 필터·정렬 변경 시 자동 재조회
watch([activeStatus, activeSortIndex], () => {
  void loadGroups()
})

// 검색어 디바운스 (300 ms)
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void loadGroups()
  }, 300)
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
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  searchQuery.value = ''
  activeStatus.value = 'ALL'
  activeSortIndex.value = 0
  void loadGroups()
}

function getPrimaryEntry(status: StudyGroupStatus): GroupEntryAction {
  return getGroupListPrimaryEntry(status)
}

function startProgressAnimation(): void {
  startProgress.value = 0
  progressTimer = setInterval(() => {
    startProgress.value = Math.min(startProgress.value + 10, 99)
  }, 3000)
}

function clearProgressAnimation(): void {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

async function handleStartStudy(groupId: string): Promise<void> {
  startingGroupId.value = groupId
  delete startError.value[groupId]
  showStartModal.value = true
  startProgressAnimation()
  try {
    await startStudy(groupId)
    clearProgressAnimation()
    startProgress.value = 100
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
    showStartModal.value = false
    await loadGroups()
  } catch (error) {
    clearProgressAnimation()
    showStartModal.value = false
    startError.value[groupId] =
      error instanceof ApiError ? error.message : '스터디 시작에 실패했습니다.'
  } finally {
    startingGroupId.value = null
  }
}

function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}
</script>

<template>
  <div class="grid gap-4">
    <!-- 헤더 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-[var(--color-ink)]">참여 중인 스터디</h2>
        <p class="mt-0.5 text-sm text-[var(--color-muted)]">
          스터디 그룹을 선택해 학습을 시작하세요.
        </p>
      </div>
      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
        @click="loadGroups"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        새로고침
      </button>
    </div>

    <!-- 검색 + 정렬 -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-48">
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          name="q"
          placeholder="그룹 이름 또는 주제로 검색"
          class="h-9 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] pl-8 pr-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
          aria-label="그룹 검색"
        />
      </div>

      <select
        v-model="activeSortIndex"
        class="h-9 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
        aria-label="정렬 기준"
        name="sort"
      >
        <option v-for="(opt, idx) in SORT_OPTIONS" :key="idx" :value="idx">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- 상태 필터 탭 -->
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="상태 필터">
      <button
        v-for="filter in STATUS_FILTERS"
        :key="filter.value"
        type="button"
        :class="[
          'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]',
          activeStatus === filter.value
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-active)] text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]',
        ]"
        :aria-pressed="activeStatus === filter.value"
        @click="activeStatus = filter.value"
      >
        {{ filter.label }}
      </button>
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

    <!-- 필터 결과 없음 -->
    <ScreenState
      v-else-if="!hasGroups && (searchQuery || activeStatus !== 'ALL')"
      variant="empty"
      title="검색 결과가 없습니다."
      description="다른 검색어나 필터를 사용해보세요."
      action-label="필터 초기화"
      @action="resetFilters"
    />

    <!-- 그룹 자체가 없음 -->
    <ScreenState
      v-else-if="!hasGroups"
      variant="empty"
      title="아직 참여 중인 그룹이 없어요."
      description="새 스터디 그룹을 만들거나 초대 코드로 참여하세요."
    >
      <template #actions>
        <RouterLink
          :to="{ name: 'group-create' }"
          class="inline-flex h-9 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
        >
          새 그룹 만들기
        </RouterLink>
        <RouterLink
          :to="{ name: 'group-join' }"
          class="inline-flex h-9 items-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
        >
          초대 코드로 참여
        </RouterLink>
      </template>
    </ScreenState>

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <article
        v-for="group in groups"
        :key="group.id"
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 transition hover:border-[var(--color-line-strong)]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-[var(--color-primary)]">{{ group.topic }}</p>
            <h3 class="mt-1 text-base font-bold text-[var(--color-ink)]">{{ group.name }}</h3>
          </div>
          <span
            class="shrink-0 rounded-full bg-[var(--color-active)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]"
          >
            {{ getGroupStatusLabel(group.status) }}
          </span>
        </div>

        <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          {{ getPrimaryEntry(group.status).summary }}
        </p>

        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-[var(--color-muted-deep)] text-xs">기간</dt>
            <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">
              {{ formatDateRange(group.startsAt, group.endsAt) }}
            </dd>
          </div>
          <div>
            <dt class="text-[var(--color-muted-deep)] text-xs">정원</dt>
            <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">{{ group.maxMembers }}명</dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="keyword in group.detailKeywords"
            :key="keyword"
            class="rounded px-2 py-0.5 text-xs font-medium text-[var(--color-muted)] bg-[var(--color-active)]"
          >
            {{ keyword }}
          </span>
        </div>

        <p class="mt-3 break-all text-[10px] text-[var(--color-muted-deep)]">
          초대 코드 {{ group.inviteCode }}
        </p>

        <p v-if="startError[group.id]" role="alert" class="mt-2 text-xs font-semibold text-[var(--color-danger)]">
          {{ startError[group.id] }}
        </p>

        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <RouterLink
            :to="{ name: 'group-overview', params: { groupId: group.id } }"
            class="inline-flex h-8 items-center rounded px-3 text-xs font-semibold text-[var(--color-muted)] border border-[var(--color-line-strong)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
          >
            그룹 홈
          </RouterLink>

          <button
            v-if="group.status === 'READY_TO_START'"
            type="button"
            :disabled="startingGroupId === group.id"
            class="inline-flex h-8 items-center rounded bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-60"
            @click="handleStartStudy(group.id)"
          >
            {{ startingGroupId === group.id ? '시작 중…' : '스터디 시작' }}
          </button>

          <RouterLink
            v-else
            :to="{ name: getPrimaryEntry(group.status).routeName, params: { groupId: group.id } }"
            class="inline-flex h-8 items-center rounded bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
          >
            {{ getPrimaryEntry(group.status).label }}
          </RouterLink>
        </div>
      </article>
    </div>
  </div>

  <!-- Start study modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showStartModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="groups-start-modal-title"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div class="relative w-full max-w-sm rounded-2xl bg-[var(--color-panel)] p-8 shadow-2xl text-center mx-4">
          <div
            class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-active)] text-3xl"
            aria-hidden="true"
          >
            🤖
          </div>
          <h2 id="groups-start-modal-title" class="text-xl font-bold text-[var(--color-ink)]">
            스터디 생성 중
          </h2>
          <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            AI가 커리큘럼을 만들고 있어요.<br />잠시만 기다려 주세요.
          </p>
          <div class="mt-7">
            <div class="mb-2 flex items-center justify-between text-xs font-semibold">
              <span class="text-[var(--color-muted)]">진행률</span>
              <span class="text-[var(--color-primary)]">{{ startProgress }}%</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-active)]">
              <div
                class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700 ease-out"
                :style="{ width: `${startProgress}%` }"
              />
            </div>
          </div>
          <p v-if="startProgress === 100" class="mt-4 text-xs font-semibold text-[var(--color-primary)]">
            완료! 잠시 후 이동합니다...
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
