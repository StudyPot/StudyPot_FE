import { apiClient } from '@/shared/api'
import type { ListMyNotificationsParams, Notification } from '../model/types'

export function listMyNotifications(
  params: ListMyNotificationsParams = {},
): Promise<Notification[]> {
  const searchParams = new URLSearchParams()

  if (params.unreadOnly !== undefined) {
    searchParams.set('unreadOnly', String(params.unreadOnly))
  }

  if (params.cursor) {
    searchParams.set('cursor', params.cursor)
  }

  const query = searchParams.toString()

  return apiClient<Notification[]>(`/users/me/notifications${query ? `?${query}` : ''}`)
}

export function markNotificationRead(notificationId: string): Promise<Notification> {
  return apiClient<Notification>(`/notifications/${notificationId}/read`, {
    method: 'POST',
  })
}

export function markAllMyNotificationsRead(): Promise<void> {
  return apiClient<void>('/users/me/notifications/read-all', {
    method: 'POST',
  })
}

export function listGroupNotifications(groupId: string): Promise<Notification[]> {
  return apiClient<Notification[]>(`/groups/${groupId}/notifications`)
}
