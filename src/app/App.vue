<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { useInAppNotificationStore } from '@/features/notification'
import { InAppToast } from '@/shared/ui'
import AppShell from '@/widgets/app-shell/AppShell.vue'

const sessionStore = useSessionStore()
const notificationStore = useInAppNotificationStore()
const route = useRoute()

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
