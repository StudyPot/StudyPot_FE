<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'

import { getGroupMembersActivity, type MemberActivityRow } from '@/entities/curriculum'
import { getGroupOnboardings, type MemberOnboardingResponse } from '@/entities/onboarding'
import { getAiManager, updateAiManager, type AiManager } from '@/entities/ai'
import aiManagerAvatar from '@/assets/ai-manager-avatar.svg'
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
const { groupId, group, members } = workspaceContext

const sessionStore = useSessionStore()

const isOwner = computed(() => {
  const myUserId = sessionStore.user?.id
  if (!myUserId) return false
  return members.value.some((m) => m.userId === myUserId && m.permission === 'OWNER')
})

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
  // AI 팀장 퍼소나 + 활동 통계는 best-effort 로 불러온다.
  const results = await Promise.allSettled([
    getAiManager(groupId.value),
    group.value?.status === 'ACTIVE' ? getGroupMembersActivity(groupId.value) : Promise.resolve([]),
  ])
  aiManager.value = results[0].status === 'fulfilled' ? results[0].value : null
  activityRows.value = results[1].status === 'fulfilled' ? (results[1].value as MemberActivityRow[]) : []
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

// 3. 이번 주 완료(최근 7일 내 완료한 과제 수)
function thisWeekCount(memberId: string): number {
  const map = countMapFor(memberId)
  const today = todayIso()
  let sum = 0
  for (let i = 0; i < 7; i += 1) sum += map.get(shiftIso(today, -i)) ?? 0
  return sum
}

// 5. 최근 활동일
function lastActivity(memberId: string): string | null {
  const row = activityRows.value.find((r: MemberActivityRow) => r.memberId === memberId)
  if (!row) return null
  let latest: string | null = null
  for (const d of row.dailyActivity) {
    if (d.count > 0 && (latest === null || d.date > latest)) latest = d.date
  }
  return latest
}

// 해당 날짜가 속한 주의 월요일(ISO, 주 시작) 날짜를 반환한다.
function mondayOf(iso: string): string {
  const d = new Date(iso)
  const dayFromMonday = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - dayFromMonday)
  return d.toISOString().slice(0, 10)
}

// 5. 연속 완료(이번 주부터 거꾸로 활동이 이어진 주 수)
// 이번 주에 아직 활동이 없으면 진행 중인 주로 보고 지난 주를 기준으로 센다.
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

const hasActivity = computed(() => activityRows.value.length > 0)

function formatDate(value?: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value))
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-ink)]">팀원</h1>
    <p class="mt-1 text-sm text-[var(--color-muted)]">
      그룹 멤버들의 역할, 온보딩 정보와 활동을 확인하세요.
    </p>

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
      <div class="mt-6 rounded-lg border border-[var(--color-primary)]/30 bg-gradient-to-br from-[rgba(54,92,255,0.06)] to-[rgba(54,92,255,0.02)] p-5 shadow-[var(--shadow-soft)]">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(201,113,80,0.12)]"
              aria-hidden="true"
            >
              <img :src="aiManagerAvatar" alt="" class="h-5 w-5" />
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-[var(--color-ink)]">AI 팀장</span>
                <span class="inline-flex h-5 items-center rounded-full bg-[rgba(54,92,255,0.15)] px-2 text-[11px] font-bold text-[var(--color-primary)]">
                  AI
                </span>
              </div>
              <span class="text-xs text-[var(--color-muted)]">
                {{ aiManager?.updatedByNickname ? `${aiManager.updatedByNickname}이 설정` : '성격 미설정' }}
              </span>
            </div>
          </div>
          <button
            v-if="isOwner"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
            @click="openPersonaModal"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            성격 설정
          </button>
        </div>

        <div v-if="aiManager?.persona" class="mt-3 rounded-md bg-[var(--color-input)] px-4 py-3">
          <p class="text-sm leading-6 text-[var(--color-ink)]">{{ aiManager.persona }}</p>
        </div>
        <p v-else class="mt-3 text-sm text-[var(--color-muted)]">
          {{ isOwner ? '성격을 설정하면 AI 팀장이 설정한 성격에 맞게 답변해요.' : '아직 AI 팀장 성격이 설정되지 않았어요.' }}
        </p>
      </div>

      <p v-if="memberList.length === 0" class="mt-8 text-center text-sm text-[var(--color-muted)]">
        아직 온보딩 정보가 없어요.
      </p>

      <ul v-else class="mt-4 grid gap-4">
        <li
          v-for="member in memberList"
          :key="member.memberId"
          class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
        >
          <!-- 헤더: 아바타, 닉네임, 역할, 제출 상태 -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white"
                aria-hidden="true"
              >
                {{ member.memberNickname.slice(0, 1).toUpperCase() }}
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-[var(--color-ink)]">{{
                    member.memberNickname
                  }}</span>
                  <!-- 1. 역할 배지 -->
                  <span
                    :class="[
                      'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-bold',
                      member.permission === 'OWNER'
                        ? 'bg-[rgba(54,92,255,0.15)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-hover)] text-[var(--color-muted)]',
                    ]"
                  >
                    {{ member.permission === 'OWNER' ? '방장' : '멤버' }}
                  </span>
                </div>
                <!-- 6. 가입일 -->
                <span v-if="member.joinedAt" class="text-xs text-[var(--color-muted)]">
                  {{ formatDate(member.joinedAt) }} 가입
                </span>
              </div>
            </div>
            <span
              :class="[
                'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
                member.status === 'SUBMITTED'
                  ? 'bg-[var(--color-active)] text-[var(--color-success)]'
                  : 'bg-[var(--color-hover)] text-[var(--color-muted)]',
              ]"
            >
              {{ member.status === 'SUBMITTED' ? '제출 완료' : '미제출' }}
            </span>
          </div>

          <!-- 3 & 5. 활동 통계 (스터디 시작 후) -->
          <div v-if="hasActivity" class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-md bg-[var(--color-input)] py-2">
              <p class="text-lg font-bold text-[var(--color-ink)]">
                {{ thisWeekCount(member.memberId) }}
              </p>
              <p class="text-[11px] text-[var(--color-muted)]">이번 주 완료</p>
            </div>
            <div class="rounded-md bg-[var(--color-input)] py-2">
              <p class="text-lg font-bold text-[var(--color-ink)]">
                🔥 {{ currentStreakWeeks(member.memberId) }}
              </p>
              <p class="text-[11px] text-[var(--color-muted)]">연속(주)</p>
            </div>
            <div class="rounded-md bg-[var(--color-input)] py-2">
              <p class="text-sm font-bold text-[var(--color-ink)]">
                {{ formatDate(lastActivity(member.memberId)) }}
              </p>
              <p class="text-[11px] text-[var(--color-muted)]">최근 활동</p>
            </div>
          </div>

          <!-- 제출 완료: 온보딩 상세 -->
          <template v-if="member.status === 'SUBMITTED'">
            <dl class="mt-4 grid gap-3 text-sm">
              <div>
                <dt class="text-[var(--color-muted)]">숙련도</dt>
                <dd class="mt-0.5 font-semibold text-[var(--color-ink)]">
                  {{ member.skillLevel }}단계 — {{ SKILL_LABELS[member.skillLevel] }}
                </dd>
              </div>
              <div v-if="member.additionalNote">
                <dt class="text-[var(--color-muted)]">추가 메모</dt>
                <dd class="mt-0.5 leading-6 text-[var(--color-ink)]">
                  {{ member.additionalNote }}
                </dd>
              </div>
            </dl>

            <div v-if="member.availabilitySlots.length > 0" class="mt-4">
              <p class="text-sm font-semibold text-[var(--color-muted)]">가능한 시간</p>
              <ul class="mt-2 flex flex-wrap gap-2">
                <li
                  v-for="(slot, i) in member.availabilitySlots"
                  :key="i"
                  class="rounded-md border border-[var(--color-line)] bg-[var(--color-input)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)]"
                >
                  {{ DAY_LABELS[slot.dayOfWeek] }}요일 {{ slot.startTime }} – {{ slot.endTime }}
                </li>
              </ul>
            </div>
          </template>

          <!-- 미제출 안내 -->
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
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showPersonaModal = false" />
        <div class="relative w-full max-w-md rounded-xl bg-[var(--color-card)] p-6 shadow-2xl">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(201,113,80,0.12)]">
              <img :src="aiManagerAvatar" alt="" class="h-6 w-6" />
            </div>
            <div>
              <h2 id="persona-modal-title" class="text-base font-bold text-[var(--color-ink)]">AI 팀장 성격 설정</h2>
              <p class="text-xs text-[var(--color-muted)]">자연어로 자유롭게 입력하세요</p>
            </div>
          </div>

          <div class="mt-4">
            <label for="persona-input" class="block text-sm font-semibold text-[var(--color-ink)]">성격 / 역할 설명</label>
            <textarea
              id="persona-input"
              v-model="personaDraft"
              rows="5"
              placeholder="예) 넌 따뜻한 멘토야. 팀원들을 항상 격려하고 작은 성취도 크게 칭찬해줘. 어려운 개념은 쉬운 비유로 설명하고, 실패해도 긍정적인 시각으로 바라봐."
              class="mt-1.5 w-full resize-none rounded-md border border-[var(--color-line-strong)] bg-[var(--color-input)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
            />
            <p v-if="personaSaveError" role="alert" class="mt-1.5 text-xs font-semibold text-[var(--color-danger)]">
              {{ personaSaveError }}
            </p>
          </div>

          <div class="mt-5 flex gap-3">
            <button
              type="button"
              :disabled="isSavingPersona"
              class="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] disabled:opacity-50"
              @click="showPersonaModal = false"
            >
              취소
            </button>
            <button
              type="button"
              :disabled="isSavingPersona || !personaDraft.trim()"
              class="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:cursor-not-allowed disabled:opacity-50"
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
