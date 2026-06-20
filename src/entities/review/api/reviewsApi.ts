import { apiClient } from '@/shared/api'
import type { CreateReviewRequest, Review, ReviewStats } from '../model/types'

export function createReview(groupId: string, request: CreateReviewRequest): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews`, {
    method: 'POST',
    body: request,
  })
}

export function listReviews(groupId: string): Promise<Review[]> {
  return apiClient<Review[]>(`/groups/${groupId}/reviews`)
}

export function getMyReview(groupId: string): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews/me`)
}

export function getReviewStats(groupId: string): Promise<ReviewStats> {
  return apiClient<ReviewStats>(`/groups/${groupId}/reviews/stats`)
}

