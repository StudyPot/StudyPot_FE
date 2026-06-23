export type Review = {
  id: string
  groupId: string
  userId: string
  displayName: string | null
  rating: number
  content?: string
  createdAt: string
}

export type ReviewStats = {
  averageRating: number
  totalCount: number
  ratingDistribution: Record<string, number>
}

export type CreateReviewRequest = {
  rating: number
  content?: string
}

export type UpdateReviewRequest = {
  rating?: number
  content?: string
}
