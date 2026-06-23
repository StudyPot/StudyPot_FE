<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useGroupListStore } from '@/entities/group'
import { useSessionStore } from '@/features/auth/session'
import { useInAppNotificationStore } from '@/features/notification'
import { InAppToast } from '@/shared/ui'
import AppShell from '@/widgets/app-shell/AppShell.vue'

const sessionStore = useSessionStore()
const notificationStore = useInAppNotificationStore()
const groupListStore = useGroupListStore()
const route = useRoute()
const router = useRouter()

// Auth callback routes (OAuth redirect) render standalone without the shell
const isAuthCallbackRoute = computed(() =>
  route.path.startsWith('/auth/') && route.path !== '/auth/failure',
)

watch(
  () => sessionStore.isAuthenticated,
  (authenticated) => {
    if (authenticated) notificationStore.startPolling()
    else notificationStore.stopPolling()
  },
  { immediate: true },
)

// 그룹이 삭제되면(실시간 알림 수신) 사이드바 목록에서 제거하고,
// 마침 그 그룹 화면을 보고 있으면 그룹 목록으로 내보낸다.
watch(
  () => notificationStore.lastEvent,
  (event) => {
    if (!event || event.notificationType !== 'GROUP_DELETED') return
    const deletedGroupId =
      event.groupId ??
      (event.payload?.groupId as string | undefined) ??
      event.relatedResourceIds?.groupId
    if (!deletedGroupId) return
    groupListStore.removeGroup(deletedGroupId)
    if (route.params.groupId === deletedGroupId) {
      void router.replace({ name: 'groups' })
    }
  },
)

onUnmounted(() => {
  notificationStore.stopPolling()
})
</script>

<template>
  <!-- OAuth callback page renders standalone (no shell) -->
  <RouterView v-if="isAuthCallbackRoute" />

  <!-- All other routes: Discord shell handles auth state internally -->
  <AppShell v-else>
    <RouterView />
  </AppShell>

  <InAppToast />
</template>
