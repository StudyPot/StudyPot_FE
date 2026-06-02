<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { useInAppNotificationStore } from '@/features/notification/model/inAppNotificationStore'
import { InAppToast } from '@/shared/ui'

const sessionStore = useSessionStore()
const notificationStore = useInAppNotificationStore()
const router = useRouter()

watch(
  () => sessionStore.isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      notificationStore.startPolling()
    } else {
      notificationStore.stopPolling()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  notificationStore.stopPolling()
})
</script>

<template>
  <RouterView />
  <InAppToast />
</template>
