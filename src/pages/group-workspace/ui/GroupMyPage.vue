<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'

import { getGroupMembersActivity, type MemberActivityRow } from '@/entities/curriculum'
import {
  getGroupOnboardings,
  type MemberOnboardingResponse,
} from '@/entities/onboarding'
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
const { groupId, group } = workspaceContext

type PageState = 'loading' | 'view' | 'error'

const pageState = ref<PageState>('loading')
const members = ref<MemberOnboardingResponse[]>([])
const activityRows = ref<MemberActivityRow[]>([])
const errorMessage = ref('')

onMounted(() => {
  void loadMembers()
})

async function loadMembers(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    members.value = await getGroupOnboardings(groupId.value)
    pageState.value = 'view'
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '팀원 정보를 불러오지 못했습니다.'
    pageState.value = 'error'
    return
  }
  // 활동 통계는 스터디가 시작(ACTIVE)된 후에만 의미가 있으므로 best-effort 로 불러온다.
  if (group.value?.status === 'ACTIVE') {
    try {
      activityRows.value = await getGroupMembersActivity(groupId.value)
    } catch {
      activityRows.value = []
    }
  } else {
    activityRows.value = []
  }
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
  const row = activityRows.value.find((r) => r.memberId === memberId)
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
  const row = activityRows.value.find((r) => r.memberId === memberId)
  if (!row) return null
  let latest: string | null = null
  for (const d of row.dailyActivity) {
    if (d.count > 0 && (latest === null || d.date > latest)) latest = d.date
  }
  return latest
}

// 5. 연속 완료(오늘부터 거꾸로 활동이 이어진 일수)
function currentStreak(memberId: string): number {
  const map = countMapFor(memberId)
  let streak = 0
  let cursor = todayIso()
  while ((map.get(cursor) ?? 0) > 0) {
    streak += 1
    cursor = shiftIso(cursor, -1)
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
    <p class="mt-1 text-sm text-[var(--color-muted)]">그룹 멤버들의 역할, 온보딩 정보와 활동을 확인하세요.</p>

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
      @action="loadMembers"
    />

    <template v-else>
      <p
        v-if="members.length === 0"
        class="mt-8 text-center text-sm text-[var(--color-muted)]"
      >
        아직 온보딩 정보가 없어요.
      </p>

      <ul v-else class="mt-6 grid gap-4">
        <li
          v-for="member in members"
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
                  <span class="font-semibold text-[var(--color-ink)]">{{ member.memberNickname }}</span>
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
              <p class="text-lg font-bold text-[var(--color-ink)]">{{ thisWeekCount(member.memberId) }}</p>
              <p class="text-[11px] text-[var(--color-muted)]">이번 주 완료</p>
            </div>
            <div class="rounded-md bg-[var(--color-input)] py-2">
              <p class="text-lg font-bold text-[var(--color-ink)]">🔥 {{ currentStreak(member.memberId) }}</p>
              <p class="text-[11px] text-[var(--color-muted)]">연속(일)</p>
            </div>
            <div class="rounded-md bg-[var(--color-input)] py-2">
              <p class="text-sm font-bold text-[var(--color-ink)]">{{ formatDate(lastActivity(member.memberId)) }}</p>
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
                <dd class="mt-0.5 leading-6 text-[var(--color-ink)]">{{ member.additionalNote }}</dd>
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
</template>
