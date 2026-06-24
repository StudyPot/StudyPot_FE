/*
 * SSAFY Coach backend evidence (framework_back_hw_09_2@4abd8ecc94a9551896e1d7193ddf1f37973b662b):
 * #02 group search/list: src/main/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupController.java,
 *     src/main/java/com/studypot/aistudyleader/studygroup/service/StudyGroupService.java,
 *     src/main/java/com/studypot/aistudyleader/studygroup/repository/StudyGroupMyBatisSqlProvider.java.
 * #03 group detail/join state: StudyGroupController.java + StudyGroupService.java + JdbcStudyGroupRepository.java.
 * #01/#10/#11 board/comment APIs: GroupBoardController.java, GroupBoardService.java, GroupBoardJdbcSql.java.
 */
import { HttpResponse, http } from 'msw'

import boardData from '@/shared/api/msw/data/board.json'
import { mockUser } from '@/shared/api/msw/fixtures'
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

const currentUserId = (mockUser as { id: string }).id

export const boardHandlers = [
  http.get(`${apiBaseUrl}/groups/:groupId/boards`, ({ params }) => {
    const groupId = String(params.groupId)
    return HttpResponse.json(boards.filter((b) => b.groupId === groupId))
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/posts`, ({ params, request }) => {
    const groupId = String(params.groupId)
    const url = new URL(request.url)
    const sort = url.searchParams.get('sort') ?? 'createdAt'
    const order = url.searchParams.get('order') ?? 'desc'

    let filtered = posts.filter((p) => p.groupId === groupId)

    filtered = filtered.slice().sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sort === 'commentCount') {
        const diff = a.commentCount - b.commentCount
        return order === 'asc' ? diff : -diff
      }
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return order === 'asc' ? diff : -diff
    })

    return HttpResponse.json({ items: filtered, pageInfo: { nextCursor: null, hasNext: false } })
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/boards/:boardId/posts`, ({ params, request }) => {
    const { groupId, boardId } = params
    const url = new URL(request.url)
    const sort = url.searchParams.get('sort') ?? 'createdAt'
    const order = url.searchParams.get('order') ?? 'desc'

    let filtered = posts.filter(
      (p) => p.groupId === String(groupId) && p.boardId === String(boardId),
    )

    filtered = filtered.slice().sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1

      if (sort === 'commentCount') {
        const diff = a.commentCount - b.commentCount
        return order === 'asc' ? diff : -diff
      }

      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return order === 'asc' ? diff : -diff
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
        author: {
          memberId: 'member-001',
          userId: currentUserId,
          displayName: (mockUser as { nickname: string }).nickname,
        },
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

    const post = posts[index]!
    if (post.author.userId !== currentUserId) {
      return HttpResponse.json(
        { title: 'Forbidden', detail: '게시글을 수정할 권한이 없습니다.', status: 403 },
        { status: 403 },
      )
    }

    const body = (await request.json()) as Record<string, unknown>
    const updated = { ...post }
    if (body.boardId !== undefined) updated.boardId = String(body.boardId)
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
    if (index === -1) {
      return HttpResponse.json(
        { title: 'Not Found', detail: 'post not found', status: 404 },
        { status: 404 },
      )
    }

    if (posts[index]!.author.userId !== currentUserId) {
      return HttpResponse.json(
        { title: 'Forbidden', detail: '게시글을 삭제할 권한이 없습니다.', status: 403 },
        { status: 403 },
      )
    }

    posts.splice(index, 1)
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
        author: {
          memberId: 'member-001',
          userId: currentUserId,
          displayName: (mockUser as { nickname: string }).nickname,
        },
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

        if (existing.author.userId !== currentUserId) {
          return HttpResponse.json(
            { title: 'Forbidden', detail: '댓글을 수정할 권한이 없습니다.', status: 403 },
            { status: 403 },
          )
        }

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
        if (comments[index]!.author.userId !== currentUserId) {
          return HttpResponse.json(
            { title: 'Forbidden', detail: '댓글을 삭제할 권한이 없습니다.', status: 403 },
            { status: 403 },
          )
        }
        comments.splice(index, 1)
        break
      }
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
