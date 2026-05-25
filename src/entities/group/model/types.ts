export type StudyGroupStatus = 'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

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
}
