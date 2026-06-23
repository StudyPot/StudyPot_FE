export type ScaleQuestion = {
  id: string
  type: 'scale'
  label: string
  required: boolean
  minLabel: string
  maxLabel: string
}

export type TextQuestion = {
  id: string
  type: 'text'
  label: string
  required: boolean
  placeholder?: string
}

export type RetroQuestion = ScaleQuestion | TextQuestion

export type RetroAnswers = Record<string, number | string>

export type Review = {
  id: string
  groupId: string
  userId: string
  displayName: string | null
  answers: RetroAnswers
  createdAt: string
}

export type CreateReviewRequest = {
  answers: RetroAnswers
}

export type UpdateReviewRequest = {
  answers: RetroAnswers
}
