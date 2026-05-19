export type OnboardingStatus = 'DRAFT' | 'SUBMITTED'

export type TaskPreferenceType = 'READING' | 'PRACTICE' | 'ASSIGNMENT' | 'PROJECT' | 'CUSTOM'

export type AvailabilitySlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
  timezone: string
}

export type SaveOnboardingRequest = {
  keywordSkillLevels: Record<string, number>
  taskPreferences: Partial<Record<TaskPreferenceType | string, number>>
  additionalNote?: string
  availabilitySlots: AvailabilitySlot[]
}

export type OnboardingResponse = {
  id: string
  groupId: string
  memberId: string
  keywordSkillLevels: Record<string, number>
  taskPreferences: Record<string, number>
  additionalNote?: string | null
  availabilitySlots: AvailabilitySlot[]
  status: OnboardingStatus
  submittedAt?: string | null
}
