export type StudyGroupStatus =
  | 'DRAFT'
  | 'ONBOARDING'
  | 'READY_TO_START'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED'

export type GroupMemberPermission = 'OWNER' | 'MEMBER'

export type GroupMemberStatus = 'PENDING_ONBOARDING' | 'ACTIVE' | 'LEFT'

export type StudyGroup = {
  id: string
  createdBy?: string
  name: string
  topic: string
  detailKeywords: string[]
  status: StudyGroupStatus
  maxMembers: number
  inviteCode: string
  startsAt: string
  endsAt: string
  // 목록 카드용(있으면 사용, 없으면 graceful 처리). 백엔드 보강 예정.
  memberCount?: number
  progressPct?: number
  progressPercent?: number
}

export type GroupSummary = {
  groupCount: number
  weeklyActivityCount: number
}

export type GroupSortField = 'name' | 'startsAt' | 'endsAt' | 'createdAt'
export type SortOrder = 'asc' | 'desc'

export type ListGroupsParams = {
  q?: string
  status?: StudyGroupStatus
  sort?: GroupSortField
  order?: SortOrder
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

export type StudyAiSuggestion = {
  title: string
  reason: string
}

export type StudyPopularTopic = {
  topic: string
  memberCount: number
  groupCount: number
}

export type StudyRecommendationsResponse = {
  aiSuggestions: StudyAiSuggestion[]
  popularTopics: StudyPopularTopic[]
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

export type UpdateGroupRequest = {
  name: string
  topic: string
  detailKeywords: string[]
  maxMembers: number
  startsAt: string
  endsAt: string
  description?: string
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
