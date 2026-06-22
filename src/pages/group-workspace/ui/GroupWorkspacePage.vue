<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
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
</script>

<template>
  <RouterView />
</template>
