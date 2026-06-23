import { apiClient } from '@/shared/api'
import type { CreateReviewRequest, RetroQuestion, Review, UpdateReviewRequest } from '../model/types'

export function getRetroQuestions(groupId: string): Promise<RetroQuestion[]> {
  return apiClient<RetroQuestion[]>(`/groups/${groupId}/reviews/questions`)
}

export function createReview(groupId: string, request: CreateReviewRequest): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews`, {
    method: 'POST',
    body: request,
  })
}

export function getMyReview(groupId: string): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews/me`)
}

export function updateMyReview(groupId: string, request: UpdateReviewRequest): Promise<Review> {
  return apiClient<Review>(`/groups/${groupId}/reviews/me`, {
    method: 'PATCH',
    body: request,
  })
}
