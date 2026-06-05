export type StudyGroupStatus = 'DRAFT' | 'ONBOARDING' | 'READY_TO_START' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

export type GroupMemberPermission = 'OWNER' | 'MEMBER'

export type GroupMemberStatus = 'PENDING_ONBOARDING' | 'ACTIVE' | 'LEFT'

export type StudyGroup = {
  id: string
  name: string
  topic: string
  detailKeywords: string[]
  status: StudyGroupStatus
  maxMembers: number
  inviteCode: string
  startsAt: string
  endsAt: string
}

export type CreateGroupRequest = {
  name: string
  topic: string
  detailKeywords: string[]
  maxMembers: number
  startsAt: string
  endsAt: string
  description?: string
}

export type SuggestDetailKeywordsRequest = {
  topic: string
  hintKeywords?: string[]
  maxCandidates?: number
}

export type DetailKeywordSuggestionsResponse = {
  keywords: string[]
}

export type JoinGroupRequest = {
  inviteCode: string
}

export type GroupMember = {
  id: string
  groupId: string
  userId: string
  permission: GroupMemberPermission
  status: GroupMemberStatus
  displayName?: string | null
  nickname?: string | null
  email?: string | null
  onboardingStatus?: 'DRAFT' | 'SUBMITTED' | null
}

export type UpdateGroupMemberProfileRequest = {
  displayName: string
}

export type GroupMemberOnboardingSummary = {
  submitted: boolean
  skillLevel?: number | null
  submittedAt?: string | null
}

export type GroupMemberCurrentWeekSummary = {
  weekId: string
  weekNumber: number
  sprintGoal?: string | null
  startsAt?: string | null
  endsAt?: string | null
  progressStatus: string
}

export type GroupMemberTaskCompletionSummary = {
  totalCount: number
  doneCount: number
  incompleteCount: number
  skippedCount: number
}

export type GroupMemberRetrospectiveSummary = {
  feedbackReady: boolean
}
