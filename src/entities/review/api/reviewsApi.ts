import { apiClient } from '@/shared/api'
import type { CreateReviewRequest, Review, ReviewStats, UpdateReviewRequest } from '../model/types'

export function getReviewStats(groupId: string): Promise<ReviewStats> {
  return apiClient<ReviewStats>(`/groups/${groupId}/reviews/stats`)
}

export function listReviews(groupId: string): Promise<Review[]> {
  return apiClient<Review[]>(`/groups/${groupId}/reviews`)
}

export function getMyReview(groupId: string): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews/me`)
}

export function createReview(groupId: string, request: CreateReviewRequest): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews`, {
    method: 'POST',
    body: request,
  })
}

export function updateMyReview(groupId: string, request: UpdateReviewRequest): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews/me`, {
    method: 'PATCH',
    body: request,
  })
}
