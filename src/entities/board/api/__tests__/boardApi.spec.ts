import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  listBoardPosts,
  updateBoardPost,
  deleteBoardPost,
  updatePostComment,
  deletePostComment,
} from '../boardApi'

const groupId = '018f7a4e-0000-7000-9000-000000000011'
const postId = 'board-001'
const commentId = 'c-001-1'
const boardId = 'board-id-001'

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('boardApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listBoardPosts', () => {
    it('passes sort and order as query params', async () => {
      const fetchMock = mockFetch({ items: [], pageInfo: { nextCursor: null, hasNext: false } })
      vi.stubGlobal('fetch', fetchMock)

      await listBoardPosts(groupId, boardId, { sort: 'commentCount', order: 'desc' })

      const calledUrl = String((fetchMock.mock.calls[0] as [string, ...unknown[]])[0])
      expect(calledUrl).toContain('sort=commentCount')
      expect(calledUrl).toContain('order=desc')
    })

    it('passes sort=createdAt and order=asc correctly', async () => {
      const fetchMock = mockFetch({ items: [], pageInfo: { nextCursor: null, hasNext: false } })
      vi.stubGlobal('fetch', fetchMock)

      await listBoardPosts(groupId, boardId, { sort: 'createdAt', order: 'asc' })

      const calledUrl = String((fetchMock.mock.calls[0] as [string, ...unknown[]])[0])
      expect(calledUrl).toContain('sort=createdAt')
      expect(calledUrl).toContain('order=asc')
    })

    it('omits sort/order params when not provided', async () => {
      const fetchMock = mockFetch({ items: [], pageInfo: { nextCursor: null, hasNext: false } })
      vi.stubGlobal('fetch', fetchMock)

      await listBoardPosts(groupId, boardId)

      const calledUrl = String((fetchMock.mock.calls[0] as [string, ...unknown[]])[0])
      expect(calledUrl).not.toContain('sort=')
      expect(calledUrl).not.toContain('order=')
    })
  })

  describe('updateBoardPost', () => {
    it('calls PATCH /api/v1/groups/:groupId/posts/:postId', async () => {
      const updatedPost = {
        id: postId,
        groupId,
        boardId,
        author: { memberId: 'm1', userId: 'u1', displayName: 'user1' },
        title: '수정된 제목',
        content: '수정된 내용',
        pinned: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      }
      const fetchMock = mockFetch(updatedPost)
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        updateBoardPost(groupId, postId, { title: '수정된 제목', content: '수정된 내용' }),
      ).resolves.toEqual(updatedPost)

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/posts/${postId}`,
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('rejects with 403 when the caller is not the author', async () => {
      vi.stubGlobal('fetch', mockFetch({ title: 'Forbidden', status: 403 }, 403))

      await expect(
        updateBoardPost(groupId, postId, { title: '해킹' }),
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('deleteBoardPost', () => {
    it('calls DELETE /api/v1/groups/:groupId/posts/:postId', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      await expect(deleteBoardPost(groupId, postId)).resolves.toBeUndefined()

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/posts/${postId}`,
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('rejects with 403 when the caller is not the author', async () => {
      vi.stubGlobal('fetch', mockFetch({ title: 'Forbidden', status: 403 }, 403))

      await expect(deleteBoardPost(groupId, postId)).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('updatePostComment', () => {
    it('calls PATCH /api/v1/groups/:groupId/comments/:commentId', async () => {
      const updatedComment = {
        id: commentId,
        groupId,
        postId,
        author: { memberId: 'm1', userId: 'u1', displayName: 'user1' },
        content: '수정된 댓글',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      }
      const fetchMock = mockFetch(updatedComment)
      vi.stubGlobal('fetch', fetchMock)

      await expect(updatePostComment(groupId, commentId, '수정된 댓글')).resolves.toEqual(
        updatedComment,
      )

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/comments/${commentId}`,
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('rejects with 403 when the caller is not the comment author', async () => {
      vi.stubGlobal('fetch', mockFetch({ title: 'Forbidden', status: 403 }, 403))

      await expect(updatePostComment(groupId, commentId, '무단 수정')).rejects.toMatchObject({
        status: 403,
      })
    })
  })

  describe('deletePostComment', () => {
    it('calls DELETE /api/v1/groups/:groupId/comments/:commentId', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      await expect(deletePostComment(groupId, commentId)).resolves.toBeUndefined()

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/comments/${commentId}`,
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('rejects with 403 when the caller is not the comment author', async () => {
      vi.stubGlobal('fetch', mockFetch({ title: 'Forbidden', status: 403 }, 403))

      await expect(deletePostComment(groupId, commentId)).rejects.toMatchObject({ status: 403 })
    })
  })
})
