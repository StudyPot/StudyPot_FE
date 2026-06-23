import type { JsonObject } from '@/shared/model/json'

export type RetrospectiveStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type RetrospectiveQuestionType = 'LIKERT_5' | 'TEXT'

export type RetrospectiveQuestion = {
  id: string
  text: string
  type: RetrospectiveQuestionType
}

export type RetrospectiveAnswer = {
  questionId: string
  score?: number | null
  text?: string | null
}

export type Retrospective = {
  id: string
  weekId?: string
  status: RetrospectiveStatus
  aiFeedback?: JsonObject | null
  nextWeekAdjustment?: JsonObject | null
  answers?: RetrospectiveAnswer[] | null
}

/** 회고 화면의 주차별 개요: 잠금 여부(필수 TODO 완료), 작성 여부, 회고 질문 */
export type RetrospectiveWeekOverview = {
  weekId: string
  weekNumber: number
  status: string
  unlocked: boolean
  answered: boolean
  questions: RetrospectiveQuestion[]
}
