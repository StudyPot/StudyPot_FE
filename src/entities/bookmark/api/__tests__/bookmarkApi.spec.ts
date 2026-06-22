import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Bookmark, BookmarkToggleResult } from '../../model/types'
import { listBookmarks, toggleBookmark } from '../bookmarkApi'

const groupId = '018f7a4e-0000-7000-9000-000000000010'

const mockGroup = {
  id: groupId,
  name: 'Backend Interview Study',
  topic: 'Spring Boot',
  detailKeywords: ['JPA', 'Security', 'Testing'],
  status: 'ONBOARDING' as const,
  maxMembers: 6,
  inviteCode: 'sb-onboarding-2026',
  startsAt: '2026-05-12',
  endsAt: '2026-06-30',
}

const mockBookmark: Bookmark = {
  groupId,
  group: mockGroup,
  bookmarkedAt: '2026-06-01T00:00:00+09:00',
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('bookmarkApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('toggleBookmark', () => {
    it('calls POST /api/v1/groups/:groupId/bookmark and returns bookmarked: true when newly bookmarked', async () => {
      const result: BookmarkToggleResult = { groupId, bookmarked: true }
      const fetchMock = mockFetch(result)
      vi.stubGlobal('fetch', fetchMock)

      await expect(toggleBookmark(groupId)).resolves.toEqual(result)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/bookmark`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )
    })

    it('returns bookmarked: false when bookmark is removed (second toggle)', async () => {
      const result: BookmarkToggleResult = { groupId, bookmarked: false }
      const fetchMock = mockFetch(result)
      vi.stubGlobal('fetch', fetchMock)

      await expect(toggleBookmark(groupId)).resolves.toEqual({ groupId, bookmarked: false })
    })
  })

  describe('listBookmarks', () => {
    it('calls GET /api/v1/bookmarks and returns bookmark list', async () => {
      const fetchMock = mockFetch([mockBookmark])
      vi.stubGlobal('fetch', fetchMock)

      await expect(listBookmarks()).resolves.toEqual([mockBookmark])
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/bookmarks',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('returns an empty array when there are no bookmarks', async () => {
      const fetchMock = mockFetch([])
      vi.stubGlobal('fetch', fetchMock)

      await expect(listBookmarks()).resolves.toEqual([])
    })
  })
})
