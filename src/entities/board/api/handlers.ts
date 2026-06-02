import { HttpResponse, http } from 'msw'

import boardData from '@/shared/api/msw/data/board.json'
import { apiBaseUrl } from '@/shared/config/api'
import type { BoardPost } from '../model/types'

const posts: BoardPost[] = boardData.posts as BoardPost[]

export const boardHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/board/posts`, ({ params }) => {
    const groupId = String(params.groupId)
    const filtered = posts.filter((p) => p.groupId === groupId)
    const sorted = [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return HttpResponse.json(sorted)
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/board/posts/:postId`, ({ params }) => {
    const post = posts.find((p) => p.id === params.postId)
    if (!post) {
      return HttpResponse.json({ title: 'Not Found', detail: 'post not found', status: 404 }, { status: 404 })
    }
    return HttpResponse.json(post)
  }),

  http.post(`${apiBaseUrl}/groups/:groupId/board/posts`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const newPost: BoardPost = {
      id: `board-${Date.now()}`,
      groupId: String(params.groupId),
      title: String(body.title ?? ''),
      content: String(body.content ?? ''),
      authorNickname: 'user1',
      category: (body.category as BoardPost['category']) ?? 'DISCUSSION',
      isPinned: false,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    posts.unshift(newPost)
    return HttpResponse.json(newPost, { status: 201 })
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/board/posts/:postId/comments`, ({ params }) => {
    const comments = (boardData.comments as Record<string, unknown[]>)[String(params.postId)] ?? []
    return HttpResponse.json(comments)
  }),

  http.post(`${apiBaseUrl}/groups/:groupId/board/posts/:postId/comments`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const comment = {
      id: `c-${Date.now()}`,
      postId: String(params.postId),
      authorNickname: 'user1',
      content: String(body.content ?? ''),
      createdAt: new Date().toISOString(),
    }
    return HttpResponse.json(comment, { status: 201 })
  }),
]
