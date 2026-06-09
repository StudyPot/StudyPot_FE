import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FollowToggleResult, FollowUser } from '../../model/types'
import { listFollowers, listFollowing, toggleFollow } from '../followApi'

const userId = 'user-002'

const followUser: FollowUser = {
  userId,
  nickname: '박지은',
  email: 'jieun@example.com',
  bio: '프론트엔드 개발자입니다.',
  mutual: true,
  followedAt: '2026-05-01T00:00:00+09:00',
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('followApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('toggleFollow', () => {
    it('calls POST /api/v1/users/:userId/follow and returns following: true when newly followed', async () => {
      const result: FollowToggleResult = { userId, following: true }
      const fetchMock = mockFetch(result)
      vi.stubGlobal('fetch', fetchMock)

      await expect(toggleFollow(userId)).resolves.toEqual(result)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/users/${userId}/follow`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )
    })

    it('returns following: false when unfollowing (second toggle)', async () => {
      const result: FollowToggleResult = { userId, following: false }
      vi.stubGlobal('fetch', mockFetch(result))

      await expect(toggleFollow(userId)).resolves.toEqual({ userId, following: false })
    })
  })

  describe('listFollowing', () => {
    it('calls GET /api/v1/users/me/following and returns list', async () => {
      const fetchMock = mockFetch([followUser])
      vi.stubGlobal('fetch', fetchMock)

      await expect(listFollowing()).resolves.toEqual([followUser])
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/users/me/following',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('returns empty array when following no one', async () => {
      vi.stubGlobal('fetch', mockFetch([]))

      await expect(listFollowing()).resolves.toEqual([])
    })
  })

  describe('listFollowers', () => {
    it('calls GET /api/v1/users/me/followers and returns list', async () => {
      const fetchMock = mockFetch([followUser])
      vi.stubGlobal('fetch', fetchMock)

      await expect(listFollowers()).resolves.toEqual([followUser])
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/users/me/followers',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('returns empty array when no followers', async () => {
      vi.stubGlobal('fetch', mockFetch([]))

      await expect(listFollowers()).resolves.toEqual([])
    })
  })
})
