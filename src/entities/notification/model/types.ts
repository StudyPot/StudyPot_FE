import type { JsonObject } from '@/shared/model/json'

export type NotificationType =
  | 'GROUP_INVITE_CREATED'
  | 'MEMBER_JOINED'
  | 'ONBOARDING_REQUESTED'
  | 'ONBOARDING_SUBMITTED'
  | 'ONBOARDING_COMPLETED'
  | 'STUDY_STARTED'
  | 'WEEK_STARTED'
  | 'TASK_DUE_REMINDER'
  | 'TASK_OVERDUE_CHECK'
  | 'INCOMPLETE_REASON_REQUESTED'
  | 'RETROSPECTIVE_REMINDER'
  | 'RETROSPECTIVE_READY'
  | 'NEXT_WEEK_ADJUSTED'
  | 'NOTICE_POSTED'
  | 'LEADER_REPORT_POSTED'
  | 'GROUP_DELETED'

export type NotificationChannel = 'IN_APP'

export type NotificationStatus = 'PENDING' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED'

export type Notification = {
  id: string
  groupId?: string | null
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
