<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'

import { useGroupListStore } from '@/entities/group'
import type { Notification, NotificationType } from '@/entities/notification'
import { useInAppNotificationStore } from '../model/inAppNotificationStore'

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

const store = useInAppNotificationStore()
const groupListStore = useGroupListStore()
const router = useRouter()

// 알림이 어느 그룹 것인지 표시 — 내가 속한 그룹 목록에서 이름을 찾는다(없으면 미표시).
function groupNameOf(notification: Notification): string | null {
  if (!notification.groupId) return null
  return groupListStore.groups.find((g) => g.id === notification.groupId)?.name ?? null
}
const isOpen = ref(false)
const isMarkingAll = ref(false)
const markingId = ref<string | null>(null)

function getNotificationRoute(notification: Notification): RouteLocationRaw | null {
  const { groupId, notificationType, payload } = notification

  if (notificationType === 'GROUP_DELETED') return { name: 'groups' }
  if (!groupId) return null

  const p = payload as Record<string, unknown> | undefined

  switch (notificationType) {
    case 'ONBOARDING_REQUESTED':
    case 'ONBOARDING_COMPLETED':
      return { name: 'group-onboarding', params: { groupId } }
    case 'MEMBER_JOINED':
    case 'ONBOARDING_SUBMITTED':
      return { name: 'group-my', params: { groupId } }
    case 'WEEK_STARTED':
    case 'TASK_DUE_REMINDER':
    case 'TASK_OVERDUE_CHECK':
    case 'INCOMPLETE_REASON_REQUESTED':
      return { name: 'group-todo', params: { groupId } }
    case 'NEXT_WEEK_ADJUSTED':
    case 'RETROSPECTIVE_REMINDER':
    case 'RETROSPECTIVE_READY':
      return { name: 'group-retrospective', params: { groupId } }
    case 'NOTICE_POSTED': {
      const postId = typeof p?.postId === 'string' ? p.postId : undefined
      return { name: 'group-board', params: { groupId }, query: postId ? { postId } : {} }
    }
    case 'LEADER_REPORT_POSTED':
      return { name: 'group-ai', params: { groupId } }
    default:
      return { name: 'group-overview', params: { groupId } }
  }
}

async function handleNotificationClick(notification: Notification): Promise<void> {
  if (isUnread(notification)) void store.markRead(notification.id)
  close()
  const route = getNotificationRoute(notification)
  if (route) await router.push(route)
}

function toggle(): void {
  isOpen.value = !isOpen.value
}

function close(): void {
  isOpen.value = false
}

function isUnread(notification: { status: string; readAt?: string | null }): boolean {
  return notification.status !== 'READ' && !notification.readAt
}

async function handleMarkRead(id: string): Promise<void> {
  markingId.value = id
  await store.markRead(id)
  markingId.value = null
}

async function handleMarkAllRead(): Promise<void> {
  isMarkingAll.value = true
  await store.markAllRead()
  isMarkingAll.value = false
}

function formatDateTime(value?: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <div class="relative">
    <!-- 벨 버튼 -->
    <button
      type="button"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.16)]"
      aria-label="알림"
      @click="toggle"
    >
      <!-- 벨 아이콘 -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>

      <!-- 읽지 않은 알림 배지 -->
      <span
        v-if="store.unreadCount > 0"
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
        aria-hidden="true"
      >
        {{ store.unreadCount > 99 ? '99+' : store.unreadCount }}
      </span>
    </button>

    <!-- 바깥 클릭 닫기용 오버레이 -->
    <div v-if="isOpen" class="fixed inset-0 z-10" aria-hidden="true" @click="close" />

    <!-- 알림 드롭다운 -->
    <div
      v-if="isOpen"
      class="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] shadow-lg sm:w-96"
    >
      <!-- 드롭다운 헤더 -->
      <div class="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-[var(--color-ink)]">알림</span>
          <!-- SSE 연결 상태 표시 -->
          <span
            :class="[
              'inline-block h-2 w-2 rounded-full',
              store.isSseConnected ? 'bg-green-400' : 'bg-amber-400',
            ]"
            :title="store.isSseConnected ? '실시간 연결됨' : '폴링 방식'"
            aria-hidden="true"
          />
          <span class="text-xs text-[var(--color-muted)]">
            {{ store.isSseConnected ? '실시간' : '30초 갱신' }}
          </span>
        </div>
        <button
          type="button"
          :disabled="isMarkingAll || store.unreadCount === 0"
          class="inline-flex h-7 items-center rounded border border-[var(--color-line)] bg-[var(--color-card)] px-2 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
          @click="handleMarkAllRead"
        >
          {{ isMarkingAll ? '처리 중…' : '전체 읽음' }}
        </button>
      </div>

      <!-- 알림 목록 -->
      <ul class="max-h-[28rem] overflow-y-auto divide-y divide-[var(--color-line)]" role="list">
        <li
          v-for="notification in store.notifications"
          :key="notification.id"
          :class="[
            'flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition hover:bg-[var(--color-hover)]',
            isUnread(notification) ? 'bg-[var(--color-card)]' : 'bg-[var(--color-bg)]',
          ]"
          @click="handleNotificationClick(notification)"
        >
          <!-- 읽지 않음 표시 점 -->
          <span
            :class="[
              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
              isUnread(notification) ? 'bg-[var(--color-primary)]' : 'bg-transparent',
            ]"
            aria-hidden="true"
          />

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                class="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]"
              >
                {{
                  NOTIFICATION_TYPE_LABEL[notification.notificationType] ??
                  notification.notificationType
                }}
              </span>
              <span
                v-if="groupNameOf(notification)"
                class="max-w-[120px] truncate rounded bg-[var(--color-tint-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary-text)]"
              >
                {{ groupNameOf(notification) }}
              </span>
              <span class="font-semibold text-[var(--color-ink)]">{{ notification.title }}</span>
            </div>
            <p class="mt-1 leading-5 text-[var(--color-muted)]">{{ notification.body }}</p>
            <p class="mt-1 text-xs text-[var(--color-muted)]">
              {{ formatDateTime(notification.deliveredAt ?? notification.createdAt) }}
            </p>
          </div>

          <button
            v-if="isUnread(notification)"
            type="button"
            :disabled="markingId === notification.id"
            class="mt-0.5 shrink-0 inline-flex h-6 items-center rounded border border-[var(--color-line)] bg-[var(--color-card)] px-1.5 text-[10px] font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none disabled:opacity-50"
            @click.stop="handleMarkRead(notification.id)"
          >
            읽음
          </button>
        </li>

        <li
          v-if="store.notifications.length === 0"
          class="px-4 py-8 text-center text-sm text-[var(--color-muted)]"
        >
          알림이 없어요.
        </li>
      </ul>
    </div>
  </div>
</template>
