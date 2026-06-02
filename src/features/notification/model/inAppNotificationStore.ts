import { defineStore } from 'pinia'
import { ref } from 'vue'

import { listMyNotifications } from '@/entities/notification'
import type { Notification } from '@/entities/notification'

export type ToastItem = {
  id: string
  title: string
  body: string
  notificationType: string
}

const POLL_INTERVAL_MS = 30_000

export const useInAppNotificationStore = defineStore('inAppNotification', () => {
  const toasts = ref<ToastItem[]>([])
  const seenIds = ref<Set<string>>(new Set())
  const unreadCount = ref(0)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function poll(): Promise<void> {
    try {
      const notifications = await listMyNotifications()
      const unread = notifications.filter(
        (n) => n.status !== 'READ' && !n.readAt,
      )
      unreadCount.value = unread.length

      for (const n of unread) {
        if (!seenIds.value.has(n.id)) {
          seenIds.value.add(n.id)
          if (seenIds.value.size > 1) {
            showToast(n)
          }
        }
      }
    } catch {
      // silent
    }
  }

  function showToast(notification: Notification): void {
    const toast: ToastItem = {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      notificationType: notification.notificationType,
    }
    toasts.value.push(toast)
    setTimeout(() => dismissToast(toast.id), 5000)
  }

  function dismissToast(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function startPolling(): void {
    void poll()
    if (!pollTimer) {
      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS)
    }
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return { toasts, unreadCount, startPolling, stopPolling, dismissToast }
})
