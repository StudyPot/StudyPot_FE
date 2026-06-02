import { HttpResponse, http } from 'msw'

import boardData from '@/shared/api/msw/data/board.json'
import { apiBaseUrl } from '@/shared/config/api'
import type { GroupBoard, BoardPostSummary, BoardPost, BoardComment } from '../model/types'

const boards: GroupBoard[] = boardData.boards as GroupBoard[]
const posts: (BoardPostSummary & { content: string })[] = boardData.posts as (BoardPostSummary & {
  content: string
})[]
const commentsByPost: Record<string, BoardComment[]> = boardData.comments as Record<
  string,
  BoardComment[]
>

export const boardHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/boards`, ({ params }) => {
    const groupId = String(params.groupId)
    return HttpResponse.json(boards.filter((b) => b.groupId === groupId))
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/boards/:boardId/posts`, ({ params }) => {
    const { groupId, boardId } = params
    const filtered = posts
      .filter((p) => p.groupId === String(groupId) && p.boardId === String(boardId))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    return HttpResponse.json({ items: filtered, pageInfo: { nextCursor: null, hasNext: false } })
  }),

  http.post(
    `${apiBaseUrl}/groups/:groupId/boards/:boardId/posts`,
    async ({ params, request }) => {
      const { groupId, boardId } = params
      const body = (await request.json()) as Record<string, unknown>
      const newPost: BoardPost = {
        id: `board-${Date.now()}`,
        groupId: String(groupId),
        boardId: String(boardId),
        author: { memberId: 'member-001', userId: 'user-001', displayName: 'user1' },
        title: String(body.title ?? ''),
        content: String(body.content ?? ''),
        pinned: Boolean(body.pinned ?? false),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      posts.unshift({ ...newPost, contentPreview: newPost.content.slice(0, 100), commentCount: 0 })
      return HttpResponse.json(newPost, { status: 201 })
    },
  ),

  http.get(`${apiBaseUrl}/groups/:groupId/posts/:postId`, ({ params }) => {
    const post = posts.find((p) => p.id === params.postId)
    if (!post) {
      return HttpResponse.json(
        { title: 'Not Found', detail: 'post not found', status: 404 },
        { status: 404 },
      )
    }
    const { contentPreview: _, commentCount: __, ...boardPost } = post
    return HttpResponse.json(boardPost)
  }),

  http.patch(`${apiBaseUrl}/groups/:groupId/posts/:postId`, async ({ params, request }) => {
    const index = posts.findIndex((p) => p.id === params.postId)
    if (index === -1) {
      return HttpResponse.json(
        { title: 'Not Found', detail: 'post not found', status: 404 },
        { status: 404 },
      )
    }
    const body = (await request.json()) as Record<string, unknown>
    const updated = { ...posts[index]! }
    if (body.title !== undefined) updated.title = String(body.title)
    if (body.content !== undefined) {
      updated.content = String(body.content)
      updated.contentPreview = updated.content.slice(0, 100)
    }
    if (body.pinned !== undefined) updated.pinned = Boolean(body.pinned)
    updated.updatedAt = new Date().toISOString()
    posts[index] = updated
    const { contentPreview: _, commentCount: __, ...boardPost } = updated
    return HttpResponse.json(boardPost)
  }),

  http.delete(`${apiBaseUrl}/groups/:groupId/posts/:postId`, ({ params }) => {
    const index = posts.findIndex((p) => p.id === params.postId)
    if (index !== -1) posts.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/posts/:postId/comments`, ({ params }) => {
    const comments = commentsByPost[String(params.postId)] ?? []
    return HttpResponse.json({ items: comments, pageInfo: { nextCursor: null, hasNext: false } })
  }),

  http.post(
    `${apiBaseUrl}/groups/:groupId/posts/:postId/comments`,
    async ({ params, request }) => {
      const { groupId, postId } = params
      const body = (await request.json()) as Record<string, unknown>
      const comment: BoardComment = {
        id: `c-${Date.now()}`,
        groupId: String(groupId),
        postId: String(postId),
        author: { memberId: 'member-001', userId: 'user-001', displayName: 'user1' },
        content: String(body.content ?? ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const key = String(postId)
      if (!commentsByPost[key]) commentsByPost[key] = []
      commentsByPost[key].push(comment)
      return HttpResponse.json(comment, { status: 201 })
    },
  ),

  http.patch(`${apiBaseUrl}/groups/:groupId/comments/:commentId`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    for (const comments of Object.values(commentsByPost)) {
      const index = comments.findIndex((c) => c.id === params.commentId)
      if (index !== -1) {
        const existing = comments[index]!
        comments[index] = {
          ...existing,
          content: String(body.content ?? existing.content),
          updatedAt: new Date().toISOString(),
        }
        return HttpResponse.json(comments[index])
      }
    }
    return HttpResponse.json(
      { title: 'Not Found', detail: 'comment not found', status: 404 },
      { status: 404 },
    )
  }),

  http.delete(`${apiBaseUrl}/groups/:groupId/comments/:commentId`, ({ params }) => {
    for (const comments of Object.values(commentsByPost)) {
      const index = comments.findIndex((c) => c.id === params.commentId)
      if (index !== -1) {
        comments.splice(index, 1)
        break
      }
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
