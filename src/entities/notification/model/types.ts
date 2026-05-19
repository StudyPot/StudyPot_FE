import type { JsonObject } from '@/shared/model/json'

export type NotificationType =
  | 'GROUP_INVITE_CREATED'
  | 'ONBOARDING_REQUESTED'
  | 'ONBOARDING_SUBMITTED'
  | 'STUDY_STARTED'
  | 'WEEK_STARTED'
  | 'TASK_DUE_REMINDER'
  | 'TASK_OVERDUE_CHECK'
  | 'INCOMPLETE_REASON_REQUESTED'
  | 'RETROSPECTIVE_READY'
  | 'NEXT_WEEK_ADJUSTED'

export type NotificationChannel = 'IN_APP'

export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED'

export type Notification = {
  id: string
  notificationType: NotificationType
  channel: NotificationChannel
  title: string
  body: string
  status: NotificationStatus
  scheduledAt?: string | null
  deliveredAt?: string | null
  readAt?: string | null
  payload?: JsonObject
  relatedResourceIds?: Record<string, string>
  recipientUserId?: string
  createdAt?: string
}

export type ListMyNotificationsParams = {
  unreadOnly?: boolean
  cursor?: string
}
