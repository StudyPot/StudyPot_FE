export type OnboardingStatus = 'DRAFT' | 'SUBMITTED'

export type AvailabilitySlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
  timezone: string
}

export type SubmitOnboardingRequest = {
  skillLevel: number
  additionalNote?: string
  availabilitySlots: AvailabilitySlot[]
}

export type OnboardingResponse = {
  id: string
  groupId: string
  memberId: string
  skillLevel: number
  additionalNote?: string | null
  availabilitySlots: AvailabilitySlot[]
  status: OnboardingStatus
  submittedAt?: string | null
}
