import { apiClient } from '@/shared/api'
import type { BoardComment, BoardPost, CreatePostRequest } from '../model/types'

export function listBoardPosts(groupId: string): Promise<BoardPost[]> {
  return apiClient<BoardPost[]>(`/groups/${groupId}/board/posts`)
}

export function getBoardPost(groupId: string, postId: string): Promise<BoardPost> {
  return apiClient<BoardPost>(`/groups/${groupId}/board/posts/${postId}`)
}

export function createBoardPost(groupId: string, request: CreatePostRequest): Promise<BoardPost> {
  return apiClient<BoardPost>(`/groups/${groupId}/board/posts`, {
    method: 'POST',
    body: request,
  })
}

export function listPostComments(groupId: string, postId: string): Promise<BoardComment[]> {
  return apiClient<BoardComment[]>(`/groups/${groupId}/board/posts/${postId}/comments`)
}

export function createPostComment(groupId: string, postId: string, content: string): Promise<BoardComment> {
  return apiClient<BoardComment>(`/groups/${groupId}/board/posts/${postId}/comments`, {
    method: 'POST',
    body: { content },
  })
}
