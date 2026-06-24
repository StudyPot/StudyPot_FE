<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  getGroup,
  getMyGroupMemberProfile,
  listGroupMembers,
  type GroupMember,
  type StudyGroup,
} from '@/entities/group'
import { getMyOnboarding } from '@/entities/onboarding'
import { useInAppNotificationStore } from '@/features/notification'
import { ApiError } from '@/shared/api'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const route = useRoute()
const notificationStore = useInAppNotificationStore()

const groupId = computed(() => String(route.params.groupId ?? ''))
const group = ref<StudyGroup | null>(null)
const isGroupLoading = ref(false)
const groupErrorMessage = ref('')
const members = ref<GroupMember[]>([])

watch(groupId, () => { void loadGroup() }, { immediate: true })

// 실시간 알림(SSE)으로 현재 그룹 관련 이벤트가 오면 그룹/멤버 상태를 새로고침해
// '스터디 시작하기' 노출, 온보딩 현황 등이 새로고침 없이 갱신되도록 한다.
const LIVE_REFRESH_TYPES = new Set([
  'MEMBER_JOINED',
  'ONBOARDING_REQUESTED',
  'ONBOARDING_SUBMITTED',
  'ONBOARDING_COMPLETED',
  'STUDY_STARTED',
  'WEEK_STARTED',
  'STUDY_COMPLETED',
])

watch(
  () => notificationStore.lastEvent,
  (event) => {
    if (!event) return
    const eventGroupId =
      event.groupId ??
      (event.payload?.groupId as string | undefined) ??
      event.relatedResourceIds?.groupId
    if (eventGroupId === groupId.value && LIVE_REFRESH_TYPES.has(event.notificationType)) {
      void loadGroup()
    }
  },
)

provide(groupWorkspaceContextKey, {
  groupId,
  group,
  isGroupLoading,
  groupErrorMessage,
  reloadGroup: loadGroup,
  reloadMembers: loadMembers,
  members,
})

async function loadGroup(): Promise<void> {
  if (!groupId.value) return

  isGroupLoading.value = true
  groupErrorMessage.value = ''
  group.value = null

  try {
    group.value = await getGroup(groupId.value)
    await Promise.allSettled([loadMyOnboardingStatus(), loadMembers()])
  } catch (error) {
    groupErrorMessage.value =
      error instanceof ApiError ? error.message : '그룹 정보를 불러오지 못했습니다.'
  } finally {
    isGroupLoading.value = false
  }
}

async function loadMyOnboardingStatus(): Promise<void> {
  try {
    await getMyOnboarding(groupId.value)
  } catch {}
}

async function loadMembers(): Promise<void> {
  try {
    members.value = await listGroupMembers(groupId.value)
  } catch {
    // 팀원 목록 조회에 실패하면 최소한 내 멤버 정보만이라도 채운다.
    await loadMyProfileOnly()
  }
}

async function loadMyProfileOnly(): Promise<void> {
  try {
    const profile = await getMyGroupMemberProfile(groupId.value)
    members.value = [
      {
        id: profile.memberId,
        groupId: profile.groupId,
        userId: profile.userId,
        permission: profile.permission,
        status: profile.status,
        displayName: profile.displayName,
      },
    ]
  } catch {
    members.value = []
  }
}

// 온보딩 제출 알림은 방장에게만 가도록 바뀌어(다른 멤버는 SSE 이벤트가 없음), 멤버들의 온보딩 현황이
// 새로고침 전까지 갱신되지 않는다. 알림과 무관하게 멤버 목록을 주기적·탭 포커스 복귀 시 다시 불러와
// '제출 완료/미제출', '스터디 시작' 게이트 등이 근실시간으로 반영되도록 한다.
const MEMBER_POLL_INTERVAL_MS = 20000
let memberPollTimer: ReturnType<typeof setInterval> | null = null

function refreshMembersIfVisible(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  if (!groupId.value) return
  void loadMembers()
}

function startMemberPolling(): void {
  stopMemberPolling()
  memberPollTimer = setInterval(refreshMembersIfVisible, MEMBER_POLL_INTERVAL_MS)
}

function stopMemberPolling(): void {
  if (memberPollTimer) {
    clearInterval(memberPollTimer)
    memberPollTimer = null
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') refreshMembersIfVisible()
}

onMounted(() => {
  startMemberPolling()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
})

onBeforeUnmount(() => {
  stopMemberPolling()
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
})
</script>

<template>
  <RouterView />
</template>
