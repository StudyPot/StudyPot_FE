<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import {
  listGroupNotifications,
  listMyNotifications,
  markAllMyNotificationsRead,
  markNotificationRead,
  type Notification,
  type NotificationType,
} from '@/entities/notification'
import {
  listGroupLlmUsage,
  type LlmUsage,
  type LlmUsagePurpose,
  type LlmUsageStatus,
} from '@/entities/operation'
import { useGroupListStore } from '@/entities/group'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  GROUP_INVITE_CREATED: '그룹 초대',
  MEMBER_JOINED: '멤버 참여',
  ONBOARDING_REQUESTED: '온보딩 요청',
  ONBOARDING_SUBMITTED: '온보딩 제출',
  ONBOARDING_COMPLETED: '온보딩 완료',
  STUDY_STARTED: '스터디 시작',
  STUDY_COMPLETED: '스터디 완주',
  WEEK_STARTED: '주차 시작',
  TASK_DUE_REMINDER: '마감 알림',
  TASK_OVERDUE_CHECK: '지연 확인',
  INCOMPLETE_REASON_REQUESTED: '미완료 사유 요청',
  RETROSPECTIVE_READY: '회고 준비 완료',
  RETROSPECTIVE_REMINDER: '회고 리마인더',
  NEXT_WEEK_ADJUSTED: '다음 주 조정',
  NOTICE_POSTED: '새 공지',
  LEADER_REPORT_POSTED: '새 팀장 리포트',
  GROUP_DELETED: '그룹 삭제',
}

const LLM_PURPOSE_LABEL: Record<LlmUsagePurpose, string> = {
  DETAIL_KEYWORD_SUGGEST: '키워드 추천',
  CURRICULUM_GENERATE: '커리큘럼 생성',
  CURRICULUM_REGENERATE_WEEK: '주차 재생성',
  TEAM_LEAD_CHAT: 'AI 팀장 대화',
  RETROSPECTIVE_ANALYZE: '회고 분석',
  RETROSPECTIVE_FEEDBACK: '회고 피드백',
  NEXT_WEEK_ADJUST: '다음 주 조정',
}

const LLM_STATUS_LABEL: Record<LlmUsageStatus, string> = {
  SUCCESS: '성공',
  FAILED: '실패',
  TIMEOUT: '타임아웃',
}

type Tab = 'my' | 'group' | 'llm'
type LoadState = 'loading' | 'loaded' | 'error' | 'forbidden'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupNotificationsPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

const groupListStore = useGroupListStore()
// '내 알림'은 여러 그룹의 알림이 섞여 있어, 각 알림이 어느 그룹 것인지 이름을 함께 보여준다.
function groupNameOf(notification: Notification): string | null {
  if (!notification.groupId) return null
  return groupListStore.groups.find((g) => g.id === notification.groupId)?.name ?? null
}

const activeTab = ref<Tab>('my')

const myNotifications = ref<Notification[]>([])
const myState = ref<LoadState>('loading')
const myError = ref('')
const isMarkingAllRead = ref(false)
const markingReadId = ref<string | null>(null)

const groupNotifications = ref<Notification[]>([])
const groupNotifState = ref<LoadState>('loading')
const groupNotifError = ref('')

const llmUsages = ref<LlmUsage[]>([])
const llmState = ref<LoadState>('loading')
const llmError = ref('')

onMounted(() => {
  void loadMyNotifications()
})

function switchTab(tab: Tab): void {
  activeTab.value = tab

  if (tab === 'group' && groupNotifState.value === 'loading') {
    void loadGroupNotifications()
  }

  if (tab === 'llm' && llmState.value === 'loading') {
    void loadLlmUsage()
  }
}

async function loadMyNotifications(): Promise<void> {
  myState.value = 'loading'
  myError.value = ''

  try {
    const raw = await listMyNotifications()
    myNotifications.value = sortNotifications(raw)
    myState.value = 'loaded'
  } catch (error) {
    myError.value = error instanceof ApiError ? error.message : '알림을 불러오지 못했습니다.'
    myState.value = 'error'
  }
}

function sortNotifications(list: Notification[]): Notification[] {
  return [...list].sort((a, b) => {
    const aUnread = isUnread(a) ? 0 : 1
    const bUnread = isUnread(b) ? 0 : 1
    if (aUnread !== bUnread) return aUnread - bUnread
    const aTime = new Date(a.deliveredAt ?? a.createdAt ?? '').getTime()
    const bTime = new Date(b.deliveredAt ?? b.createdAt ?? '').getTime()
    return bTime - aTime
  })
}

async function loadGroupNotifications(): Promise<void> {
  groupNotifState.value = 'loading'
  groupNotifError.value = ''

  try {
    groupNotifications.value = await listGroupNotifications(groupId.value)
    groupNotifState.value = 'loaded'
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      groupNotifState.value = 'forbidden'
    } else {
      groupNotifError.value =
        error instanceof ApiError ? error.message : '그룹 알림을 불러오지 못했습니다.'
      groupNotifState.value = 'error'
    }
  }
}

async function loadLlmUsage(): Promise<void> {
  llmState.value = 'loading'
  llmError.value = ''

  try {
    llmUsages.value = await listGroupLlmUsage(groupId.value)
    llmState.value = 'loaded'
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      llmState.value = 'forbidden'
    } else {
      llmError.value =
        error instanceof ApiError ? error.message : 'LLM 사용량을 불러오지 못했습니다.'
      llmState.value = 'error'
    }
  }
}

async function handleMarkRead(notificationId: string): Promise<void> {
  markingReadId.value = notificationId

  try {
    const updated = await markNotificationRead(notificationId)
    const index = myNotifications.value.findIndex((n) => n.id === notificationId)

    if (index !== -1) {
      myNotifications.value[index] = updated
    }
  } catch {
    // 개별 읽음 실패는 조용히 무시
  } finally {
    markingReadId.value = null
  }
}

async function handleMarkAllRead(): Promise<void> {
  isMarkingAllRead.value = true

  try {
    await markAllMyNotificationsRead()
    myNotifications.value = myNotifications.value.map((n) => ({
      ...n,
      status: 'READ' as const,
      readAt: n.readAt ?? new Date().toISOString(),
    }))
  } catch {
    // 전체 읽음 실패는 조용히 무시
  } finally {
    isMarkingAllRead.value = false
  }
}

function isUnread(notification: Notification): boolean {
  return notification.status !== 'READ' && !notification.readAt
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR')
}
</script>

<template>
  <div class="grid gap-5">
    <section
      class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-soft)]"
    >
      <!-- 탭 헤더 -->
      <div class="flex border-b border-[var(--color-line)] px-5 pt-5">
        <p class="mb-4 text-sm font-semibold text-[var(--color-primary)]">알림</p>
      </div>

      <nav class="flex border-b border-[var(--color-line)]" aria-label="알림 탭">
        <button
          v-for="tab in [
            { id: 'my', label: '내 알림' },
            { id: 'group', label: '그룹 알림' },
            { id: 'llm', label: 'LLM 사용량' },
          ] as const"
          :key="tab.id"
          type="button"
          :class="[
            'relative px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[rgba(25,195,125,0.2)]',
            activeTab === tab.id
              ? 'text-[var(--color-primary-deep)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-primary)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
          ]"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
          <span
            v-if="tab.id === 'my' && myState === 'loaded' && myNotifications.some(isUnread)"
            class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-xs font-bold text-white"
          >
            {{ myNotifications.filter(isUnread).length }}
          </span>
        </button>
      </nav>

      <!-- 내 알림 탭 -->
      <div v-if="activeTab === 'my'" class="p-5">
        <ScreenState
          v-if="myState === 'loading'"
          variant="loading"
          title="알림을 불러오는 중입니다."
        />

        <ScreenState
          v-else-if="myState === 'error'"
          variant="error"
          title="알림을 불러오지 못했습니다."
          :description="myError"
          action-label="다시 시도"
          @action="loadMyNotifications"
        />

        <template v-else>
          <div class="flex items-center justify-between">
            <p class="text-sm text-[var(--color-muted)]">
              {{ myNotifications.filter(isUnread).length }}개 읽지 않음
            </p>
            <button
              type="button"
              :disabled="isMarkingAllRead || !myNotifications.some(isUnread)"
              class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-50"
              @click="handleMarkAllRead"
            >
              {{ isMarkingAllRead ? '처리 중…' : '전체 읽음' }}
            </button>
          </div>

          <ul v-if="myNotifications.length > 0" class="mt-4 grid gap-2">
            <li
              v-for="notification in myNotifications"
              :key="notification.id"
              :class="[
                'flex items-start gap-3 rounded-md border p-3 text-sm transition',
                isUnread(notification)
                  ? 'border-[rgba(25,195,125,0.22)] bg-[var(--color-card)]'
                  : 'border-[var(--color-line-strong)] bg-[var(--color-active)]',
              ]"
            >
              <div
                :class="[
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  isUnread(notification) ? 'bg-[var(--color-primary)]' : 'bg-transparent',
                ]"
                aria-hidden="true"
              />

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]"
                  >
                    {{ NOTIFICATION_TYPE_LABEL[notification.notificationType] }}
                  </span>
                  <span
                    v-if="groupNameOf(notification)"
                    class="max-w-[140px] truncate rounded bg-[var(--color-tint-50)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-primary-text)]"
                  >
                    {{ groupNameOf(notification) }}
                  </span>
                  <span class="font-semibold text-[var(--color-ink)]">{{
                    notification.title
                  }}</span>
                </div>
                <p class="mt-1 leading-6 text-[var(--color-muted)]">{{ notification.body }}</p>
                <p class="mt-1 text-xs text-[var(--color-muted)]">
                  {{ formatDateTime(notification.deliveredAt ?? notification.createdAt) }}
                </p>
              </div>

              <button
                v-if="isUnread(notification)"
                type="button"
                :disabled="markingReadId === notification.id"
                class="shrink-0 inline-flex h-7 items-center rounded border border-[var(--color-line-strong)] bg-[var(--color-active)] px-2 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-50"
                @click="handleMarkRead(notification.id)"
              >
                읽음
              </button>
            </li>
          </ul>

          <p v-else class="mt-4 text-sm text-[var(--color-muted)]">알림이 없어요.</p>
        </template>
      </div>

      <!-- 그룹 알림 탭 -->
      <div v-else-if="activeTab === 'group'" class="p-5">
        <ScreenState
          v-if="groupNotifState === 'loading'"
          variant="loading"
          title="그룹 알림을 불러오는 중입니다."
        />

        <ScreenState
          v-else-if="groupNotifState === 'forbidden'"
          variant="forbidden"
          title="그룹장만 조회할 수 있습니다."
          description="이 화면은 그룹장 권한이 필요합니다."
        />

        <ScreenState
          v-else-if="groupNotifState === 'error'"
          variant="error"
          title="그룹 알림을 불러오지 못했습니다."
          :description="groupNotifError"
          action-label="다시 시도"
          @action="loadGroupNotifications"
        />

        <template v-else>
          <ul v-if="groupNotifications.length > 0" class="grid gap-2">
            <li
              v-for="notification in groupNotifications"
              :key="notification.id"
              class="rounded-md border border-[var(--color-line)] bg-[var(--color-card)] p-3 text-sm"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]"
                >
                  {{ NOTIFICATION_TYPE_LABEL[notification.notificationType] }}
                </span>
                <span
                  :class="[
                    'rounded px-1.5 py-0.5 text-xs font-semibold',
                    notification.status === 'READ'
                      ? 'bg-[var(--color-card)] text-[var(--color-muted)]'
                      : notification.status === 'FAILED'
                        ? 'bg-[rgba(237,66,69,0.15)] text-[var(--color-danger)]'
                        : 'bg-[var(--color-card)] text-[var(--color-primary-deep)]',
                  ]"
                >
                  {{ notification.status }}
                </span>
                <span class="font-semibold text-[var(--color-ink)]">{{ notification.title }}</span>
              </div>
              <p class="mt-1 leading-6 text-[var(--color-muted)]">{{ notification.body }}</p>
              <p class="mt-1 text-xs text-[var(--color-muted)]">
                {{ formatDateTime(notification.deliveredAt ?? notification.createdAt) }}
              </p>
            </li>
          </ul>

          <p v-else class="text-sm text-[var(--color-muted)]">그룹 알림이 없어요.</p>
        </template>
      </div>

      <!-- LLM 사용량 탭 -->
      <div v-else-if="activeTab === 'llm'" class="p-5">
        <ScreenState
          v-if="llmState === 'loading'"
          variant="loading"
          title="LLM 사용량을 불러오는 중입니다."
        />

        <ScreenState
          v-else-if="llmState === 'forbidden'"
          variant="forbidden"
          title="그룹장만 조회할 수 있습니다."
          description="이 화면은 그룹장 권한이 필요합니다."
        />

        <ScreenState
          v-else-if="llmState === 'error'"
          variant="error"
          title="LLM 사용량을 불러오지 못했습니다."
          :description="llmError"
          action-label="다시 시도"
          @action="loadLlmUsage"
        />

        <template v-else>
          <div v-if="llmUsages.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="border-b border-[var(--color-line)] text-left text-xs font-semibold text-[var(--color-muted)]"
                >
                  <th class="pb-2 pr-4">목적</th>
                  <th class="pb-2 pr-4">모델</th>
                  <th class="pb-2 pr-4 text-right">입력 토큰</th>
                  <th class="pb-2 pr-4 text-right">출력 토큰</th>
                  <th class="pb-2 pr-4 text-right">지연(ms)</th>
                  <th class="pb-2 pr-4">상태</th>
                  <th class="pb-2">일시</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--color-line)]">
                <tr v-for="usage in llmUsages" :key="usage.id" class="text-[var(--color-ink)]">
                  <td class="py-2.5 pr-4 font-medium">
                    {{ LLM_PURPOSE_LABEL[usage.purpose] ?? usage.purpose }}
                  </td>
                  <td class="py-2.5 pr-4 text-[var(--color-muted)]">{{ usage.model }}</td>
                  <td class="py-2.5 pr-4 text-right tabular-nums">
                    {{ formatNumber(usage.inputTokens) }}
                  </td>
                  <td class="py-2.5 pr-4 text-right tabular-nums">
                    {{ formatNumber(usage.outputTokens) }}
                  </td>
                  <td class="py-2.5 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                    {{ usage.latencyMs != null ? formatNumber(usage.latencyMs) : '-' }}
                  </td>
                  <td class="py-2.5 pr-4">
                    <span
                      :class="[
                        'rounded px-1.5 py-0.5 text-xs font-semibold',
                        usage.status === 'SUCCESS'
                          ? 'bg-[rgba(35,165,90,0.2)] text-[var(--color-success)]'
                          : usage.status === 'FAILED'
                            ? 'bg-[rgba(237,66,69,0.15)] text-[var(--color-danger)]'
                            : 'bg-[rgba(224,149,58,0.15)] text-[#fbbf24]',
                      ]"
                    >
                      {{ LLM_STATUS_LABEL[usage.status] }}
                    </span>
                  </td>
                  <td class="py-2.5 text-xs text-[var(--color-muted)]">
                    {{ formatDateTime(usage.createdAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-else class="text-sm text-[var(--color-muted)]">LLM 사용 기록이 없어요.</p>
        </template>
      </div>
    </section>
  </div>
</template>
