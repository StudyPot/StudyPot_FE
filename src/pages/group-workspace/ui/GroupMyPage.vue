<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'

import { getGroupMembersActivity, type MemberActivityRow } from '@/entities/curriculum'
import { getGroupCategoryColor } from '@/entities/group'
import { getGroupOnboardings, type MemberOnboardingResponse } from '@/entities/onboarding'
import { getAiManager, updateAiManager, type AiManager } from '@/entities/ai'
import { useInAppNotificationStore } from '@/features/notification'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'
import { useSessionStore } from '@/features/auth/session'

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
const { groupId, group, members, reloadMembers } = workspaceContext

const sessionStore = useSessionStore()
const toastStore = useInAppNotificationStore()

// 내 멤버십 id (GroupMember.id === MemberOnboardingResponse.memberId)
const myMemberId = computed<string | null>(() => {
  const myUserId = sessionStore.user?.id
  if (!myUserId) return null
  return members.value.find((m) => m.userId === myUserId)?.id ?? null
})

const isOwner = computed(() => {
  const myUserId = sessionStore.user?.id
  if (!myUserId) return false
  return members.value.some((m) => m.userId === myUserId && m.permission === 'OWNER')
})

// 화면에 그릴 통합 멤버(로스터 기준이라 방장·미온보딩 멤버도 항상 포함).
type DisplayMember = {
  memberId: string
  userId: string
  memberNickname: string
  permission: 'OWNER' | 'MEMBER'
  joinedAt?: string | null
  status: 'SUBMITTED' | 'NOT_SUBMITTED'
  skillLevel: number
  additionalNote?: string | null
  availabilitySlots: MemberOnboardingResponse['availabilitySlots']
}

function isMe(member: DisplayMember): boolean {
  return member.memberId === myMemberId.value
}

const onboardingByMemberId = computed(() => {
  const map = new Map<string, MemberOnboardingResponse>()
  for (const o of memberList.value) map.set(o.memberId, o)
  return map
})

// 정렬: 내 카드 → 방장 → 나머지. 로스터(members)가 있으면 그것을 기준으로,
// 없으면 온보딩 응답만으로 fallback.
const orderedMembers = computed<DisplayMember[]>(() => {
  const roster = members.value.filter((m) => m.status !== 'LEFT')
  let merged: DisplayMember[]

  if (roster.length > 0) {
    merged = roster.map((gm) => {
      const o = onboardingByMemberId.value.get(gm.id)
      const submitted = o?.status === 'SUBMITTED' || gm.onboardingStatus === 'SUBMITTED'
      return {
        memberId: gm.id,
        userId: gm.userId,
        memberNickname: o?.memberNickname ?? gm.nickname ?? gm.displayName ?? '멤버',
        permission: gm.permission,
        joinedAt: o?.joinedAt ?? null,
        status: submitted ? 'SUBMITTED' : 'NOT_SUBMITTED',
        skillLevel: o?.skillLevel ?? 0,
        additionalNote: o?.additionalNote ?? null,
        availabilitySlots: o?.availabilitySlots ?? [],
      }
    })
  } else {
    merged = memberList.value.map((o) => ({
      memberId: o.memberId,
      userId: '',
      memberNickname: o.memberNickname,
      permission: o.permission,
      joinedAt: o.joinedAt ?? null,
      status: o.status === 'SUBMITTED' ? 'SUBMITTED' : 'NOT_SUBMITTED',
      skillLevel: o.skillLevel,
      additionalNote: o.additionalNote ?? null,
      availabilitySlots: o.availabilitySlots,
    }))
  }

  const mine = merged.filter((m) => m.memberId === myMemberId.value)
  const owners = merged.filter((m) => m.memberId !== myMemberId.value && m.permission === 'OWNER')
  const rest = merged.filter((m) => m.memberId !== myMemberId.value && m.permission !== 'OWNER')
  return [...mine, ...owners, ...rest]
})

const hasMembers = computed(() => orderedMembers.value.length > 0)

type PageState = 'loading' | 'view' | 'error'

const pageState = ref<PageState>('loading')
const memberList = ref<MemberOnboardingResponse[]>([])
const activityRows = ref<MemberActivityRow[]>([])
const errorMessage = ref('')

// AI 팀장
const aiManager = ref<AiManager | null>(null)
const showPersonaModal = ref(false)
const personaDraft = ref('')
const isSavingPersona = ref(false)
const personaSaveError = ref('')

function openPersonaModal(): void {
  personaDraft.value = aiManager.value?.persona ?? ''
  personaSaveError.value = ''
  showPersonaModal.value = true
}

async function savePersona(): Promise<void> {
  if (!personaDraft.value.trim()) return
  isSavingPersona.value = true
  personaSaveError.value = ''
  try {
    aiManager.value = await updateAiManager(groupId.value, { persona: personaDraft.value.trim() })
    showPersonaModal.value = false
  } catch (error) {
    personaSaveError.value = error instanceof ApiError ? error.message : '저장에 실패했습니다.'
  } finally {
    isSavingPersona.value = false
  }
}

async function copyInviteCode(): Promise<void> {
  const code = group.value?.inviteCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    toastStore.pushToast('초대 코드를 복사했어요', code, 'success')
  } catch {
    toastStore.pushToast('복사하지 못했어요', '직접 코드를 복사해 주세요.', 'error')
  }
}

onMounted(() => {
  void loadPage()
})

async function loadPage(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    memberList.value = await getGroupOnboardings(groupId.value)
    pageState.value = 'view'
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '팀원 정보를 불러오지 못했습니다.'
    pageState.value = 'error'
    return
  }
  const results = await Promise.allSettled([
    getAiManager(groupId.value),
    group.value?.status === 'ACTIVE' ? getGroupMembersActivity(groupId.value) : Promise.resolve([]),
    reloadMembers(), // 방장 포함 로스터 확보
  ])
  aiManager.value = results[0].status === 'fulfilled' ? results[0].value : null
  activityRows.value =
    results[1].status === 'fulfilled' ? (results[1].value as MemberActivityRow[]) : []
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftIso(iso: string, deltaDays: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function countMapFor(memberId: string): Map<string, number> {
  const row = activityRows.value.find((r: MemberActivityRow) => r.memberId === memberId)
  const map = new Map<string, number>()
  if (row) for (const d of row.dailyActivity) map.set(d.date, d.count)
  return map
}

// "이번 주 완료"는 TODO 완료만 집계(게시글 작성 제외). todoCount 없으면 count로 폴백.
function thisWeekCount(memberId: string): number {
  const row = activityRows.value.find((r: MemberActivityRow) => r.memberId === memberId)
  if (!row) return 0
  const todoByDate = new Map<string, number>()
  for (const d of row.dailyActivity) todoByDate.set(d.date, d.todoCount ?? d.count)
  const today = todayIso()
  let sum = 0
  for (let i = 0; i < 7; i += 1) sum += todoByDate.get(shiftIso(today, -i)) ?? 0
  return sum
}

function lastActivity(memberId: string): string | null {
  const row = activityRows.value.find((r: MemberActivityRow) => r.memberId === memberId)
  if (!row) return null
  let latest: string | null = null
  for (const d of row.dailyActivity) {
    if (d.count > 0 && (latest === null || d.date > latest)) latest = d.date
  }
  return latest
}

function mondayOf(iso: string): string {
  const d = new Date(iso)
  const dayFromMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayFromMonday)
  return d.toISOString().slice(0, 10)
}

function currentStreakWeeks(memberId: string): number {
  const map = countMapFor(memberId)
  const activeWeeks = new Set<string>()
  for (const [date, count] of map) {
    if (count > 0) activeWeeks.add(mondayOf(date))
  }
  if (activeWeeks.size === 0) return 0
  let cursor = mondayOf(todayIso())
  if (!activeWeeks.has(cursor)) cursor = shiftIso(cursor, -7)
  let streak = 0
  while (activeWeeks.has(cursor)) {
    streak += 1
    cursor = shiftIso(cursor, -7)
  }
  return streak
}

const isActiveGroup = computed(() => group.value?.status === 'ACTIVE')

function formatDate(value?: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value))
}
</script>

<template>
  <div>
    <!-- 헤더 -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-[var(--color-ink)]">팀원</h1>
        <p class="mt-1 text-sm text-[var(--color-muted)]">역할 · 온보딩 정보 · 활동을 확인하세요</p>
      </div>
      <button
        v-if="group?.inviteCode"
        type="button"
        class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
        @click="copyInviteCode"
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        초대 코드 복사
      </button>
    </div>

    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="팀원 정보를 불러오는 중입니다."
      class="mt-8"
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="팀원 정보를 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadPage"
    />

    <template v-else>
      <!-- AI 팀장 카드 -->
      <div
        class="mt-6 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-primary)]"
              aria-hidden="true"
            >
              <img src="/AIbot.png" alt="" class="h-full w-full object-cover" />
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="font-bold text-[var(--color-ink)]">AI 팀장</span>
                <span
                  class="inline-flex h-5 items-center rounded-full bg-[var(--color-tint-50)] px-2 text-[11px] font-bold text-[var(--color-primary-text)]"
                  >AI</span
                >
              </div>
              <span class="text-xs text-[var(--color-muted)]">
                {{
                  aiManager?.updatedByNickname
                    ? `${aiManager.updatedByNickname}님이 설정`
                    : '성격 미설정'
                }}
              </span>
            </div>
          </div>
          <button
            v-if="isOwner"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
            @click="openPersonaModal"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            성격 설정
          </button>
        </div>

        <div
          v-if="aiManager?.persona"
          class="mt-3 rounded-[var(--radius-input)] bg-[var(--color-panel)] px-4 py-3"
        >
          <p class="text-sm leading-6 text-[var(--color-body)]">{{ aiManager.persona }}</p>
        </div>
        <p v-else class="mt-3 text-sm text-[var(--color-muted)]">
          {{
            isOwner
              ? '성격을 설정하면 AI 팀장이 설정한 성격에 맞게 답변해요.'
              : '아직 AI 팀장 성격이 설정되지 않았어요.'
          }}
        </p>
      </div>

      <p v-if="!hasMembers" class="mt-8 text-center text-sm text-[var(--color-muted)]">
        아직 팀원이 없어요.
      </p>

      <ul v-else class="mt-4 grid gap-4">
        <li
          v-for="member in orderedMembers"
          :key="member.memberId"
          class="rounded-[var(--radius-card)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)] transition"
          :class="
            isMe(member)
              ? 'border-2 border-[var(--color-primary)]'
              : 'border border-[var(--color-line)]'
          "
        >
          <!-- 내 프로필 칩 -->
          <span
            v-if="isMe(member)"
            class="mb-3 inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-[var(--color-tint-50)] px-2.5 py-1 text-xs font-bold text-[var(--color-primary-text)]"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            내 프로필
          </span>

          <!-- 헤더 -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                :style="{ backgroundColor: getGroupCategoryColor(member.memberId) }"
                aria-hidden="true"
              >
                {{ member.memberNickname.slice(0, 1).toUpperCase() }}
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-[var(--color-ink)]">{{ member.memberNickname }}</span>
                  <span
                    :class="[
                      'inline-flex h-5 items-center rounded-[var(--radius-chip)] px-2 text-[11px] font-bold',
                      member.permission === 'OWNER'
                        ? 'bg-[var(--color-tint-50)] text-[var(--color-primary-text)]'
                        : 'bg-[var(--color-panel)] text-[var(--color-muted)]',
                    ]"
                  >
                    {{ member.permission === 'OWNER' ? '방장' : '멤버' }}
                  </span>
                </div>
                <span v-if="member.joinedAt" class="text-xs text-[var(--color-muted)]">
                  {{ formatDate(member.joinedAt) }} 가입
                </span>
              </div>
            </div>
            <!-- 미제출만 표시 -->
            <span
              v-if="member.status !== 'SUBMITTED'"
              class="inline-flex h-6 items-center rounded-[var(--radius-chip)] bg-[var(--color-panel)] px-2.5 text-xs font-semibold text-[var(--color-muted)]"
            >
              온보딩 미제출
            </span>
          </div>

          <!-- 활동 통계 (진행 중 + 온보딩 제출 멤버만) -->
          <div
            v-if="isActiveGroup && member.status === 'SUBMITTED'"
            class="mt-4 grid grid-cols-3 gap-2.5 text-center"
          >
            <div class="rounded-[var(--radius-input)] bg-[var(--color-panel)] py-4">
              <p class="text-xl font-extrabold text-[var(--color-ink)]">
                {{ thisWeekCount(member.memberId) }}
              </p>
              <p class="mt-0.5 text-[11px] text-[var(--color-muted)]">이번 주 완료</p>
            </div>
            <div class="rounded-[var(--radius-input)] bg-[var(--color-panel)] py-4">
              <p class="text-xl font-extrabold text-[var(--color-primary-text)]">
                {{ currentStreakWeeks(member.memberId) }}주
              </p>
              <p class="mt-0.5 text-[11px] text-[var(--color-muted)]">연속 참여</p>
            </div>
            <div class="rounded-[var(--radius-input)] bg-[var(--color-panel)] py-4">
              <p class="text-base font-extrabold text-[var(--color-ink)]">
                {{ formatDate(lastActivity(member.memberId)) }}
              </p>
              <p class="mt-0.5 text-[11px] text-[var(--color-muted)]">최근 활동</p>
            </div>
          </div>

          <!-- 온보딩 상세 -->
          <template v-if="member.status === 'SUBMITTED'">
            <div class="mt-4 grid gap-3 text-sm sm:grid-cols-[80px_1fr] sm:items-baseline">
              <span class="text-[var(--color-muted)]">숙련도</span>
              <span class="font-semibold text-[var(--color-ink)]">
                {{ member.skillLevel }}단계 — {{ SKILL_LABELS[member.skillLevel] }}
              </span>

              <template v-if="member.availabilitySlots.length > 0">
                <span class="text-[var(--color-muted)]">가능한 시간</span>
                <ul class="flex flex-wrap gap-2">
                  <li
                    v-for="(slot, i) in member.availabilitySlots"
                    :key="i"
                    class="rounded-[var(--radius-input)] bg-[var(--color-panel)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)]"
                  >
                    {{ DAY_LABELS[slot.dayOfWeek] }}요일 {{ slot.startTime }} – {{ slot.endTime }}
                  </li>
                </ul>
              </template>

              <!-- 추가 메모: 내 카드만 -->
              <template v-if="isMe(member) && member.additionalNote">
                <span class="text-[var(--color-muted)]">추가 메모</span>
                <span class="leading-6 text-[var(--color-body)]">{{ member.additionalNote }}</span>
              </template>
            </div>
          </template>

          <p v-else class="mt-3 text-sm text-[var(--color-muted)]">
            아직 온보딩을 제출하지 않았어요.
          </p>
        </li>
      </ul>
    </template>
  </div>

  <!-- AI 팀장 성격 설정 모달 -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showPersonaModal"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-modal-title"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="showPersonaModal = false"
        />
        <div
          class="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-strong)]"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-primary)]"
            >
              <img src="/AIbot.png" alt="" class="h-full w-full object-cover" />
            </div>
            <div>
              <h2 id="persona-modal-title" class="text-base font-bold text-[var(--color-ink)]">
                AI 팀장 성격 설정
              </h2>
              <p class="text-xs text-[var(--color-muted)]">자연어로 자유롭게 입력하세요</p>
            </div>
          </div>

          <div class="mt-4">
            <label for="persona-input" class="block text-sm font-semibold text-[var(--color-ink)]"
              >성격 / 역할 설명</label
            >
            <textarea
              id="persona-input"
              v-model="personaDraft"
              rows="5"
              placeholder="예) 넌 따뜻한 멘토야. 팀원들을 항상 격려하고 작은 성취도 크게 칭찬해줘."
              class="mt-1.5 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)]"
            />
            <p
              v-if="personaSaveError"
              role="alert"
              class="mt-1.5 text-xs font-semibold text-[var(--color-danger)]"
            >
              {{ personaSaveError }}
            </p>
          </div>

          <div class="mt-5 flex gap-3">
            <button
              type="button"
              :disabled="isSavingPersona"
              class="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-panel)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] disabled:opacity-50"
              @click="showPersonaModal = false"
            >
              취소
            </button>
            <button
              type="button"
              :disabled="isSavingPersona || !personaDraft.trim()"
              class="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              @click="savePersona"
            >
              {{ isSavingPersona ? '저장 중…' : '저장' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
