<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  getGroupSummary,
  joinGroupByInviteCode,
  listGroups,
  type GroupSummary,
  type StudyGroup,
  type StudyGroupStatus,
} from '@/entities/group'
import { listBookmarks, toggleBookmark } from '@/entities/bookmark'
import { startStudy } from '@/entities/curriculum'
import { useSessionStore } from '@/features/auth/session'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

const sessionStore = useSessionStore()

function isOwner(group: StudyGroup): boolean {
  const myUserId = sessionStore.user?.id
  return !!myUserId && !!group.createdBy && group.createdBy === myUserId
}

// 카테고리 컬러 (7색 순환)
const CAT_COLORS = ['#4DABF7', '#9775FA', '#22B8CF', '#51CF66', '#FFA94D', '#FF8787', '#F783AC']
function getCatColor(index: number): string {
  return CAT_COLORS[index % CAT_COLORS.length] ?? '#4DABF7'
}

// 상태별 도트 색상
function getStatusDotColor(status: StudyGroupStatus): string {
  switch (status) {
    case 'ONBOARDING':     return '#4DABF7'
    case 'READY_TO_START': return '#FFA94D'
    case 'ACTIVE':         return '#19C37D'
    case 'COMPLETED':      return '#8A9099'
    default:               return '#8A9099'
  }
}

// 진행률 바 정보
function getProgressInfo(status: StudyGroupStatus): { label: string; color: string } {
  switch (status) {
    case 'ONBOARDING':     return { label: '온보딩 진행',     color: '#4DABF7' }
    case 'READY_TO_START': return { label: '온보딩 완료',     color: '#FFA94D' }
    case 'ACTIVE':         return { label: '커리큘럼 진행률', color: '#19C37D' }
    case 'COMPLETED':      return { label: '학습 완료',       color: '#8A9099' }
    default:               return { label: '',                color: '#8A9099' }
  }
}

function getProgressPct(group: StudyGroup): number {
  if (group.status === 'READY_TO_START' || group.status === 'COMPLETED') return 100
  return group.progressPct ?? 0
}

// 상태 표시 레이블
function getStatusLabel(status: StudyGroupStatus): string {
  switch (status) {
    case 'ONBOARDING':     return '온보딩'
    case 'READY_TO_START': return '시작 대기'
    case 'ACTIVE':         return '진행 중'
    case 'COMPLETED':      return '완료'
    default:               return status
  }
}

// 심플 필터: 전체 / 진행 중 / 완료
type SimpleFilter = 'all' | 'ongoing' | 'completed'
const SIMPLE_FILTERS: { value: SimpleFilter; label: string }[] = [
  { value: 'all',       label: '전체' },
  { value: 'ongoing',   label: '진행 중' },
  { value: 'completed', label: '완료' },
]

const allGroups = ref<StudyGroup[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const summary = ref<GroupSummary | null>(null)

const bookmarkedGroupIds = ref(new Set<string>())
const togglingBookmarkIds = ref(new Set<string>())

const searchQuery = ref('')
const activeFilter = ref<SimpleFilter>('all')
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 스터디 시작 모달
const startingGroupId = ref<string | null>(null)
const startError = ref<Record<string, string>>({})
const showStartModal = ref(false)
const startProgress = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null

// 코드로 참여 모달
const showJoinModal = ref(false)
const joinForm = reactive({ inviteCode: '' })
const isJoining = ref(false)
const joinError = ref('')
const joinFieldError = ref('')

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allGroups.value.filter((g) => {
    if (q && !g.name.toLowerCase().includes(q) && !g.topic.toLowerCase().includes(q)) return false
    if (activeFilter.value === 'ongoing') return ['ONBOARDING', 'READY_TO_START', 'ACTIVE'].includes(g.status)
    if (activeFilter.value === 'completed') return g.status === 'COMPLETED'
    return true
  })
})

const hasGroups = computed(() => filteredGroups.value.length > 0)

onMounted(async () => {
  await Promise.all([loadGroups(), loadBookmarkIds(), loadSummary()])
})

async function loadSummary(): Promise<void> {
  try {
    summary.value = await getGroupSummary()
  } catch {
    // summary 로딩 실패 시 헤더 서브타이틀 숨김
  }
}

async function loadBookmarkIds(): Promise<void> {
  try {
    const list = await listBookmarks()
    bookmarkedGroupIds.value = new Set(list.map((b) => b.groupId))
  } catch {
    // 북마크 로딩 실패는 그룹 목록에 영향 없음
  }
}

async function handleToggleBookmark(groupId: string): Promise<void> {
  if (togglingBookmarkIds.value.has(groupId)) return
  togglingBookmarkIds.value.add(groupId)
  try {
    const result = await toggleBookmark(groupId)
    const next = new Set(bookmarkedGroupIds.value)
    if (result.bookmarked) { next.add(groupId) } else { next.delete(groupId) }
    bookmarkedGroupIds.value = next
  } catch {
    // 토글 실패 시 상태 변경 없음
  } finally {
    togglingBookmarkIds.value.delete(groupId)
  }
}

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { /* client-side filter via computed */ }, 300)
})

async function loadGroups(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    allGroups.value = await listGroups()
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹 목록을 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

function resetFilters(): void {
  searchQuery.value = ''
  activeFilter.value = 'all'
}

function startProgressAnimation(): void {
  startProgress.value = 0
  progressTimer = setInterval(() => {
    startProgress.value = Math.min(startProgress.value + 10, 99)
  }, 3000)
}

function clearProgressAnimation(): void {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
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

function openJoinModal(): void {
  joinForm.inviteCode = ''
  joinError.value = ''
  joinFieldError.value = ''
  showJoinModal.value = true
}

function closeJoinModal(): void {
  showJoinModal.value = false
}

async function submitJoin(): Promise<void> {
  joinError.value = ''
  joinFieldError.value = ''
  if (!joinForm.inviteCode.trim()) {
    joinFieldError.value = '초대 코드를 입력해주세요.'
    return
  }
  isJoining.value = true
  try {
    await joinGroupByInviteCode(joinForm.inviteCode.trim())
    closeJoinModal()
    await loadGroups()
  } catch (error) {
    joinError.value =
      error instanceof ApiError ? error.message : '그룹에 참여하지 못했어요. 초대 코드를 확인해 주세요.'
  } finally {
    isJoining.value = false
  }
}
</script>

<template>
  <div class="grid gap-5">
    <!-- 헤더 -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-[26px] font-extrabold leading-tight text-ink">참여 중인 스터디</h2>
        <p v-if="summary" class="mt-0.5 text-sm text-muted">
          {{ summary.groupCount }}개 그룹 · 이번 주 활동 {{ summary.weeklyActivityCount }}회
        </p>
      </div>
      <RouterLink
        :to="{ name: 'group-create' }"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(25,195,125,0.35)] transition hover:bg-primary-deep focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        새 그룹
      </RouterLink>
    </div>

    <!-- 검색 + 필터 -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-48 flex-1">
        <svg
          class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          name="q"
          placeholder="그룹 이름 또는 주제로 검색"
          class="h-10 w-full rounded-input border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
          aria-label="그룹 검색"
        />
      </div>
      <div class="flex gap-1.5" role="group" aria-label="상태 필터">
        <button
          v-for="filter in SIMPLE_FILTERS"
          :key="filter.value"
          type="button"
          :class="[
            'h-10 rounded-input px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]',
            activeFilter === filter.value
              ? 'bg-primary text-white'
              : 'border border-line-strong bg-surface text-muted hover:bg-hover hover:text-ink',
          ]"
          :aria-pressed="activeFilter === filter.value"
          @click="activeFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- 로딩 / 에러 -->
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

    <!-- 검색/필터 결과 없음 -->
    <div
      v-else-if="!hasGroups && (searchQuery || activeFilter !== 'all')"
      class="flex flex-col items-center justify-center gap-4 rounded-card bg-surface py-16 shadow-soft"
    >
      <p class="text-sm text-muted">검색 결과가 없어요.</p>
      <button
        type="button"
        class="rounded-input border border-line-strong px-4 py-2 text-sm font-semibold text-body hover:bg-hover"
        @click="resetFilters"
      >
        필터 초기화
      </button>
    </div>

    <!-- 빈 상태 -->
    <div
      v-else-if="!hasGroups"
      class="flex flex-col items-center justify-center gap-5 rounded-card bg-surface py-20 shadow-soft"
    >
      <div class="text-center">
        <p class="text-base font-bold text-ink">아직 참여한 스터디가 없어요</p>
        <p class="mt-1 text-sm text-muted">새 스터디를 만들거나 초대 코드로 참여해보세요.</p>
      </div>
      <div class="flex gap-2">
        <RouterLink
          :to="{ name: 'group-create' }"
          class="inline-flex h-10 items-center gap-1.5 rounded-button bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-deep"
        >
          새 그룹 만들기
        </RouterLink>
        <button
          type="button"
          class="h-10 rounded-button border border-line-strong bg-surface px-5 text-sm font-semibold text-body transition hover:bg-hover"
          @click="openJoinModal"
        >
          코드로 참여
        </button>
      </div>
    </div>

    <!-- 그룹 카드 목록 -->
    <div v-else class="grid gap-4 sm:grid-cols-2">
      <article
        v-for="(group, index) in filteredGroups"
        :key="group.id"
        class="group/card relative rounded-card bg-surface p-5 shadow-[0_1px_4px_rgba(20,28,40,.06)] transition hover:shadow-[0_4px_20px_rgba(20,28,40,.10)]"
      >
        <!-- 토픽 + 북마크 -->
        <div class="flex items-center justify-between">
          <span
            class="inline-flex items-center gap-1.5 text-sm font-semibold"
            :style="{ color: getCatColor(index) }"
          >
            <svg class="h-2 w-2 shrink-0 rounded-full" viewBox="0 0 8 8" aria-hidden="true">
              <circle cx="4" cy="4" r="4" :fill="getCatColor(index)" />
            </svg>
            {{ group.topic }}
          </span>
          <button
            type="button"
            :aria-label="bookmarkedGroupIds.has(group.id) ? `${group.name} 찜 해제` : `${group.name} 찜하기`"
            :aria-pressed="bookmarkedGroupIds.has(group.id)"
            :disabled="togglingBookmarkIds.has(group.id)"
            class="relative z-10 flex h-8 w-8 items-center justify-center text-xl transition hover:scale-110 disabled:opacity-50"
            :class="bookmarkedGroupIds.has(group.id) ? 'text-primary' : 'text-faint'"
            @click.stop="handleToggleBookmark(group.id)"
          >
            {{ bookmarkedGroupIds.has(group.id) ? '★' : '☆' }}
          </button>
        </div>

        <!-- 그룹명 (카드 전체 클릭 가능 링크) -->
        <RouterLink
          :to="{ name: 'group-overview', params: { groupId: group.id } }"
          class="mt-3 block text-[22px] font-bold leading-snug text-ink focus:outline-none after:absolute after:inset-0 after:rounded-card"
        >
          {{ group.name }}
        </RouterLink>

        <!-- 상태 배지 + 멤버 수 -->
        <div class="mt-2 flex items-center gap-3 text-sm">
          <span class="inline-flex items-center gap-1.5 font-semibold" :style="{ color: getStatusDotColor(group.status) }">
            <svg class="h-2 w-2 shrink-0" viewBox="0 0 8 8" aria-hidden="true">
              <circle cx="4" cy="4" r="4" :fill="getStatusDotColor(group.status)" />
            </svg>
            {{ getStatusLabel(group.status) }}
          </span>
          <span class="text-muted-deep">멤버 {{ group.memberCount ?? '?' }}/{{ group.maxMembers }}</span>
        </div>

        <!-- 진행률 바 -->
        <div class="mt-4">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-deep">{{ getProgressInfo(group.status).label }}</span>
            <span class="font-semibold" :style="{ color: getProgressInfo(group.status).color }">
              {{ getProgressPct(group) }}%
            </span>
          </div>
          <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-panel">
            <div
              class="h-full rounded-full transition-all duration-500"
              :style="{
                width: `${getProgressPct(group)}%`,
                backgroundColor: getProgressInfo(group.status).color,
              }"
            />
          </div>
        </div>

        <!-- 키워드 -->
        <div v-if="group.detailKeywords.length" class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="keyword in group.detailKeywords"
            :key="keyword"
            class="rounded-lg bg-panel px-2 py-1 text-xs font-medium text-muted"
          >
            {{ keyword }}
          </span>
        </div>

      </article>
    </div>
  </div>

  <!-- 스터디 시작 모달 -->
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
        <div class="relative mx-4 w-full max-w-sm rounded-card bg-panel p-8 text-center shadow-2xl">
          <div class="orbit-spinner mx-auto mb-5" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="orbit-arm" :style="`--i: ${i - 1}`">
              <div class="orbit-dot" />
            </div>
          </div>
          <h2 id="groups-start-modal-title" class="text-xl font-bold text-ink">스터디 생성 중</h2>
          <p class="mt-2 text-sm leading-6 text-muted">
            AI가 커리큘럼을 만들고 있어요.<br />잠시만 기다려 주세요.
          </p>
          <div class="mt-7">
            <div class="mb-2 flex items-center justify-between text-xs font-semibold">
              <span class="text-muted">진행률</span>
              <span class="text-primary">{{ startProgress }}%</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-active">
              <div
                class="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                :style="{ width: `${startProgress}%` }"
              />
            </div>
          </div>
          <p v-if="startProgress === 100" class="mt-4 text-xs font-semibold text-primary">
            완료! 잠시 후 이동합니다...
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 코드로 참여 모달 -->
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
        v-if="showJoinModal"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-modal-title"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeJoinModal" />
        <div class="relative w-full max-w-sm rounded-card bg-surface p-6 shadow-strong">
          <div class="mb-5 flex items-center justify-between">
            <h2 id="join-modal-title" class="text-lg font-bold text-ink">코드로 참여</h2>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-hover"
              aria-label="닫기"
              @click="closeJoinModal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-4 w-4" stroke-linecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p class="mb-4 text-sm text-muted">그룹장에게 받은 초대 코드를 입력해주세요.</p>
          <form @submit.prevent="submitJoin">
            <label class="grid gap-1.5">
              <span class="text-sm font-semibold text-ink">초대 코드</span>
              <input
                v-model="joinForm.inviteCode"
                type="text"
                placeholder="초대 코드 입력"
                class="h-11 w-full rounded-input border bg-input px-3 text-sm text-ink outline-none transition focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
                :class="joinFieldError ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-primary'"
              />
              <span v-if="joinFieldError" class="text-xs font-semibold text-danger">{{ joinFieldError }}</span>
            </label>
            <p
              v-if="joinError"
              role="alert"
              class="mt-3 rounded-xl border border-[rgba(255,82,71,0.3)] bg-[rgba(255,82,71,0.08)] px-3 py-2 text-xs font-semibold text-danger"
            >
              {{ joinError }}
            </p>
            <div class="mt-5 flex gap-2">
              <button
                type="button"
                class="h-11 flex-1 rounded-button border border-line-strong bg-panel text-sm font-semibold text-body transition hover:bg-hover"
                @click="closeJoinModal"
              >
                취소
              </button>
              <button
                type="submit"
                :disabled="isJoining"
                class="h-11 flex-1 rounded-button bg-primary text-sm font-semibold text-white transition hover:bg-primary-deep disabled:opacity-60"
              >
                {{ isJoining ? '참여 중…' : '그룹 참여' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.orbit-spinner {
  position: relative;
  width: 64px;
  height: 64px;
}

.orbit-arm {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 0;
  transform-origin: 0 50%;
  animation: orbit 1.4s linear infinite;
  animation-delay: calc(var(--i) * -0.233s);
}

.orbit-dot {
  position: absolute;
  right: -5px;
  top: -5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-primary);
  opacity: calc(0.2 + var(--i) * 0.16);
}

@keyframes orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
