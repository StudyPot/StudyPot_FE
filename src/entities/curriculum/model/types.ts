import type { JsonObject } from '@/shared/model/json'

export type CurriculumStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED'

export type CurriculumWeekStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export type WeeklyTaskType = 'READING' | 'PRACTICE' | 'ASSIGNMENT' | 'PROJECT' | 'CUSTOM'

export type MemberWeekProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'FEEDBACK_READY'

export type TaskCompletionStatus = 'TODO' | 'DONE' | 'INCOMPLETE' | 'SKIPPED'

export type CurriculumWeekSummary = {
  id: string
  weekNumber: number
  title: string
  status: CurriculumWeekStatus
}

export type Curriculum = {
  id: string
  groupId: string
  title: string
  totalWeeks: number
  onboardingSummary?: JsonObject | null
  status: CurriculumStatus
  weeks?: CurriculumWeekSummary[]
}

export type CurriculumWeek = {
  id: string
  groupId?: string
  curriculumId: string
  weekNumber: number
  title: string
  sprintGoal?: string | null
  retrospectivePrompt?: string | null
  focus?: string | null
  status: CurriculumWeekStatus
  startsAt?: string | null
  endsAt?: string | null
  progress?: {
    status: MemberWeekProgressStatus
    completedTaskCount: number
    totalTaskCount: number
    incompleteTaskCount: number
  }
}

export type WeeklyTask = {
  id: string
  curriculumWeekId: string
  weekId?: string
  displayOrder: number
  taskType: WeeklyTaskType
  title: string
  description?: string | null
  required: boolean
  dueAt?: string | null
  completion?: TaskCompletionResponse
}

export type UpdateWeekProgressRequest = {
  status: MemberWeekProgressStatus
  completionNote?: string
  incompleteReason?: string
}

export type MemberWeekProgress = {
  id: string
  status: MemberWeekProgressStatus
  completedAt?: string | null
  incompleteReason?: string | null
}

export type TaskCompletionRequest = {
  status: TaskCompletionStatus
  completionNote?: string
  incompleteReason?: string
  evidenceUrl?: string
}

export type DoneTaskRequest = {
  completionNote?: string
  evidenceUrl?: string
}

export type IncompleteTaskRequest = {
  incompleteReason: string
}

export type TaskCompletionResponse = {
  id: string
  taskId?: string
  status: TaskCompletionStatus
  completedAt?: string | null
  reasonSubmittedAt?: string | null
  completionNote?: string | null
  incompleteReason?: string | null
  evidenceUrl?: string | null
}

export type TaskCompletionSummary = {
  totalCount: number
  doneCount: number
  incompleteCount: number
  skippedCount: number
}

export type CurrentLearningActivityTaskCompletion = {
  id: string | null
  taskId: string
  status: TaskCompletionStatus
  completedAt: string | null
  reasonSubmittedAt: string | null
  completionNote: string | null
  incompleteReason: string | null
  evidenceUrl: string | null
}

export type CurrentLearningActivityTask = {
  task: WeeklyTask
  completion: CurrentLearningActivityTaskCompletion
}

export type CurrentLearningActivity = {
  groupId: string
  currentWeek: CurriculumWeek
  progress: MemberWeekProgress | null
  progressStatus: MemberWeekProgressStatus
  taskCompletion: TaskCompletionSummary
  tasks: CurrentLearningActivityTask[]
}

export type DailyActivity = {
  date: string
  count: number
}

export type MemberActivityRow = {
  memberId: string
  memberNickname: string
  dailyActivity: DailyActivity[]
}
