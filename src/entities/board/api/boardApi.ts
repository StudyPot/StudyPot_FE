import { apiClient } from '@/shared/api'
import type { CursorPageResponse } from '@/shared/api'
import type {
  GroupBoard,
  BoardPostSummary,
  BoardPost,
  BoardComment,
  CreatePostRequest,
  UpdatePostRequest,
} from '../model/types'

export type BoardSortField = 'createdAt' | 'commentCount'

export type ListBoardPostsParams = {
  cursor?: string
  pageSize?: number
  sort?: BoardSortField
  order?: 'asc' | 'desc'
}

export type ListBoardCommentsParams = {
  cursor?: string
  pageSize?: number
}

export function listBoards(groupId: string): Promise<GroupBoard[]> {
  return apiClient<GroupBoard[]>(`/groups/${groupId}/boards`)
}

export function listAllPosts(
  groupId: string,
  params?: ListBoardPostsParams,
): Promise<CursorPageResponse<BoardPostSummary>> {
  const searchParams = new URLSearchParams()
  if (params?.cursor) searchParams.set('cursor', params.cursor)
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize))
  if (params?.sort) searchParams.set('sort', params.sort)
  if (params?.order) searchParams.set('order', params.order)
  const query = searchParams.toString()
  return apiClient<CursorPageResponse<BoardPostSummary>>(
    `/groups/${groupId}/posts${query ? `?${query}` : ''}`,
  )
}

export function listBoardPosts(
  groupId: string,
  boardId: string,
  params?: ListBoardPostsParams,
): Promise<CursorPageResponse<BoardPostSummary>> {
  const searchParams = new URLSearchParams()
  if (params?.cursor) searchParams.set('cursor', params.cursor)
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize))
  if (params?.sort) searchParams.set('sort', params.sort)
  if (params?.order) searchParams.set('order', params.order)
  const query = searchParams.toString()
  return apiClient<CursorPageResponse<BoardPostSummary>>(
    `/groups/${groupId}/boards/${boardId}/posts${query ? `?${query}` : ''}`,
  )
}

export function createBoardPost(
  groupId: string,
  boardId: string,
  request: CreatePostRequest,
): Promise<BoardPost> {
  return apiClient<BoardPost>(`/groups/${groupId}/boards/${boardId}/posts`, {
    method: 'POST',
    body: request,
  })
}

export function getBoardPost(groupId: string, postId: string): Promise<BoardPost> {
  return apiClient<BoardPost>(`/groups/${groupId}/posts/${postId}`)
}

export function updateBoardPost(
  groupId: string,
  postId: string,
  request: UpdatePostRequest,
): Promise<BoardPost> {
  return apiClient<BoardPost>(`/groups/${groupId}/posts/${postId}`, {
    method: 'PATCH',
    body: request,
  })
}

export function deleteBoardPost(groupId: string, postId: string): Promise<void> {
  return apiClient<void>(`/groups/${groupId}/posts/${postId}`, { method: 'DELETE' })
}

export function listPostComments(
  groupId: string,
  postId: string,
  params?: ListBoardCommentsParams,
): Promise<CursorPageResponse<BoardComment>> {
  const searchParams = new URLSearchParams()
  if (params?.cursor) searchParams.set('cursor', params.cursor)
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize))
  const query = searchParams.toString()
  return apiClient<CursorPageResponse<BoardComment>>(
    `/groups/${groupId}/posts/${postId}/comments${query ? `?${query}` : ''}`,
  )
}

export function createPostComment(
  groupId: string,
  postId: string,
  content: string,
): Promise<BoardComment> {
  return apiClient<BoardComment>(`/groups/${groupId}/posts/${postId}/comments`, {
    method: 'POST',
    body: { content },
  })
}

export function updatePostComment(
  groupId: string,
  commentId: string,
  content: string,
): Promise<BoardComment> {
  return apiClient<BoardComment>(`/groups/${groupId}/comments/${commentId}`, {
    method: 'PATCH',
    body: { content },
  })
}

export function deletePostComment(groupId: string, commentId: string): Promise<void> {
  return apiClient<void>(`/groups/${groupId}/comments/${commentId}`, { method: 'DELETE' })
}
