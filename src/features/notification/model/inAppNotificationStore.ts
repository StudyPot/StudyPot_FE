import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import {
  listMyNotifications,
  markNotificationRead,
  markAllMyNotificationsRead,
} from '@/entities/notification'
import type { Notification } from '@/entities/notification'
import { apiBaseUrl } from '@/shared/config/api'

export type ToastItem = {
  id: string
  title: string
  body: string
  notificationType: string
}

const POLL_INTERVAL_MS = 30_000
const SSE_RECONNECT_INITIAL_DELAY_MS = 1_000
const SSE_RECONNECT_MAX_DELAY_MS = 30_000

function isUnread(n: Notification): boolean {
  return n.status !== 'READ' && !n.readAt
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

export const useInAppNotificationStore = defineStore('inAppNotification', () => {
  const notifications = ref<Notification[]>([])
  const toasts = ref<ToastItem[]>([])
  const seenIds = ref<Set<string>>(new Set())
  const isSseConnected = ref(false)
  // 실시간으로 새로 도착한 알림. 화면이 watch 해서 관련 데이터를 갱신할 수 있다.
  const lastEvent = ref<Notification | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
  let shouldReconnectSse = false
  let hasLoadedInitialNotifications = false

  const unreadCount = computed(() => notifications.value.filter(isUnread).length)

  async function fetchNotifications(): Promise<void> {
    try {
      const list = await listMyNotifications()
      const sorted = sortNotifications(list)
      const shouldToastNewNotifications = hasLoadedInitialNotifications

      for (const n of sorted.filter(isUnread)) {
        if (!seenIds.value.has(n.id) && shouldToastNewNotifications) {
          showToast(n)
        }
        seenIds.value.add(n.id)
      }

      notifications.value = sorted
      hasLoadedInitialNotifications = true
    } catch {
      // silent
    }
  }

  function addIncomingNotification(notification: Notification): void {
    if (!seenIds.value.has(notification.id)) {
      seenIds.value.add(notification.id)
      showToast(notification)
      lastEvent.value = notification
    }
    const idx = notifications.value.findIndex((n) => n.id === notification.id)
    if (idx === -1) {
      notifications.value = sortNotifications([notification, ...notifications.value])
    } else {
      const updated = [...notifications.value]
      updated[idx] = notification
      notifications.value = sortNotifications(updated)
    }
  }

  function startSse(): void {
    shouldReconnectSse = true
    void fetchNotifications()
    if (eventSource || reconnectTimer) {
      return
    }
    connectSse()
  }

  function connectSse(): void {
    try {
      const es = new EventSource(`${apiBaseUrl}/users/me/notifications/stream`, {
        withCredentials: true,
      })

      es.onopen = () => {
        isSseConnected.value = true
        reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
        stopPollingFallback()
      }

      es.addEventListener('notification-created', (event) => {
        try {
          const notification = JSON.parse(event.data as string) as Notification
          addIncomingNotification(notification)
        } catch {
          // ignore parse errors
        }
      })

      es.onerror = () => {
        if (eventSource !== es) return
        isSseConnected.value = false
        es.close()
        eventSource = null
        void fetchNotifications()
        startPollingFallback()
        scheduleSseReconnect()
      }

      eventSource = es
    } catch {
      eventSource = null
      startPollingFallback()
      scheduleSseReconnect()
    }
  }

  function startPollingFallback(): void {
    if (!pollTimer) {
      pollTimer = setInterval(() => void fetchNotifications(), POLL_INTERVAL_MS)
    }
  }

  function stopPollingFallback(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function scheduleSseReconnect(): void {
    if (!shouldReconnectSse || reconnectTimer) {
      return
    }
    const delayMs = reconnectDelayMs
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, SSE_RECONNECT_MAX_DELAY_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!shouldReconnectSse || eventSource) {
        return
      }
      connectSse()
    }, delayMs)
  }

  function clearSseReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
  }

  function stopSse(): void {
    shouldReconnectSse = false
    clearSseReconnect()
    if (eventSource) {
      eventSource.close()
      eventSource = null
      isSseConnected.value = false
    }
    stopPollingFallback()
  }

  async function markRead(notificationId: string): Promise<void> {
    try {
      const updated = await markNotificationRead(notificationId)
      const idx = notifications.value.findIndex((n) => n.id === notificationId)
      if (idx !== -1) {
        const list = [...notifications.value]
        list[idx] = updated
        notifications.value = sortNotifications(list)
      }
    } catch {
      // ignore
    }
  }

  async function markAllRead(): Promise<void> {
    try {
      await markAllMyNotificationsRead()
      notifications.value = notifications.value.map((n) => ({
        ...n,
        status: 'READ' as const,
        readAt: n.readAt ?? new Date().toISOString(),
      }))
    } catch {
      // ignore
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

  // backward compat aliases
  const startPolling = startSse
  const stopPolling = stopSse

  return {
    notifications,
    toasts,
    lastEvent,
    unreadCount,
    isSseConnected,
    startSse,
    stopSse,
    startPolling,
    stopPolling,
    dismissToast,
    markRead,
    markAllRead,
    fetchNotifications,
  }
})
