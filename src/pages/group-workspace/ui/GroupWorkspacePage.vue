<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  getGroup,
  getMyGroupMemberProfile,
  type GroupMember,
  type StudyGroup,
} from '@/entities/group'
import { getMyOnboarding } from '@/entities/onboarding'
import { ApiError } from '@/shared/api'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const route = useRoute()

const groupId = computed(() => String(route.params.groupId ?? ''))
const group = ref<StudyGroup | null>(null)
const isGroupLoading = ref(false)
const groupErrorMessage = ref('')
const members = ref<GroupMember[]>([])

watch(groupId, () => { void loadGroup() }, { immediate: true })

provide(groupWorkspaceContextKey, {
  groupId,
  group,
  isGroupLoading,
  groupErrorMessage,
  reloadGroup: loadGroup,
  members,
})

async function loadGroup(): Promise<void> {
  if (!groupId.value) return

  isGroupLoading.value = true
  groupErrorMessage.value = ''
  group.value = null

  try {
    group.value = await getGroup(groupId.value)
    await Promise.allSettled([loadMyOnboardingStatus(), loadMyProfile()])
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

async function loadMyProfile(): Promise<void> {
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
