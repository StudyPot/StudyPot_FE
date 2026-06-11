<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

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
const { groupId } = workspaceContext

type PageState = 'loading' | 'view' | 'error'

const pageState = ref<PageState>('loading')
const members = ref<MemberOnboardingResponse[]>([])
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
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-ink)]">팀원</h1>
    <p class="mt-1 text-sm text-[var(--color-muted)]">그룹 멤버들의 온보딩 정보를 확인하세요.</p>

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
          <!-- 헤더: 아바타, 닉네임, 제출 상태 -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white"
                aria-hidden="true"
              >
                {{ member.memberNickname.slice(0, 1).toUpperCase() }}
              </div>
              <span class="font-semibold text-[var(--color-ink)]">{{ member.memberNickname }}</span>
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
