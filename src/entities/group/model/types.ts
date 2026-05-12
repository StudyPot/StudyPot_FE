export type StudyGroupStatus = 'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

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
