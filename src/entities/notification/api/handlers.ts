import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../model/types'

type LegacyNotification = Omit<Partial<Notification>, 'notificationType' | 'status' | 'channel'> & {
  id: string
  type?: string
  notificationType?: string
  channel: string
  status: string
  title: string
  body: string
}

export const notificationHandlers = [
  http.get(`${apiBaseUrl}/users/me/notifications`, ({ request }) => {
    const url = new URL(request.url)
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
    const notifications = (mockMswData.notifications.notifications as unknown as LegacyNotification[]).map(
      toNotification,
    )

    return HttpResponse.json(
      unreadOnly
        ? notifications.filter((notification) => notification.status !== 'READ' && !notification.readAt)
        : notifications,
    )
  }),
  http.post(`${apiBaseUrl}/notifications/:notificationId/read`, ({ params }) => {
    const legacyNotifications = mockMswData.notifications.notifications as unknown as LegacyNotification[]
    const notification =
      legacyNotifications.map(toNotification).find((item) => item.id === params.notificationId) ??
      toNotification(
        legacyNotifications[0] ?? {
          id: String(params.notificationId),
          channel: 'IN_APP',
          status: 'DELIVERED',
          title: 'Notification',
          body: 'Notification body',
        },
      )

    return HttpResponse.json(markRead(notification))
  }),
  http.post(`${apiBaseUrl}/users/me/notifications/read-all`, () => {
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/notifications`, () => {
    return HttpResponse.json(
      (mockMswData.notifications.groupNotificationLogs as unknown as LegacyNotification[]).map(toNotification),
    )
  }),
]

function toNotification(source: LegacyNotification): Notification {
  return {
    ...source,
    notificationType: toNotificationType(source.notificationType ?? source.type),
    channel: toNotificationChannel(source.channel),
    status: toNotificationStatus(source.status),
  }
}

function markRead(notification: Notification): Notification {
  return {
    ...notification,
    status: 'READ' satisfies NotificationStatus,
    readAt: notification.readAt ?? new Date().toISOString(),
  }
}

function toNotificationType(value?: string): NotificationType {
  const knownTypes: NotificationType[] = [
    'GROUP_INVITE_CREATED',
    'MEMBER_JOINED',
    'ONBOARDING_REQUESTED',
    'ONBOARDING_SUBMITTED',
    'ONBOARDING_COMPLETED',
    'STUDY_STARTED',
    'WEEK_STARTED',
    'TASK_DUE_REMINDER',
    'TASK_OVERDUE_CHECK',
    'INCOMPLETE_REASON_REQUESTED',
    'RETROSPECTIVE_REMINDER',
    'RETROSPECTIVE_READY',
    'NEXT_WEEK_ADJUSTED',
    'NOTICE_POSTED',
    'LEADER_REPORT_POSTED',
    'GROUP_DELETED',
  ]

  return knownTypes.includes(value as NotificationType) ? (value as NotificationType) : 'WEEK_STARTED'
}

function toNotificationChannel(value: string): NotificationChannel {
  return value === 'IN_APP' ? 'IN_APP' : 'IN_APP'
}

function toNotificationStatus(value: string): NotificationStatus {
  const knownStatuses: NotificationStatus[] = ['PENDING', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED']

  return knownStatuses.includes(value as NotificationStatus) ? (value as NotificationStatus) : 'DELIVERED'
}
