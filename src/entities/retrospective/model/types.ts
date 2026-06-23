import type { JsonObject } from '@/shared/model/json'

export type RetrospectiveStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type Retrospective = {
  id: string
  weekId?: string
  status: RetrospectiveStatus
  aiFeedback?: JsonObject | null
  nextWeekAdjustment?: JsonObject | null
}
