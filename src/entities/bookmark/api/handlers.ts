import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { Bookmark, BookmarkToggleResult } from '../model/types'

type BookmarkData = { bookmarkedGroupIds: string[]; bookmarkList: Bookmark[] }

const data = mockMswData.bookmarks as BookmarkData

const bookmarkedGroupIds = new Set<string>(data.bookmarkedGroupIds)

export const bookmarkHandlers = [
  http.post(`${apiBaseUrl}/groups/:groupId/bookmark`, ({ params }) => {
    const groupId = String(params.groupId)
    const wasBookmarked = bookmarkedGroupIds.has(groupId)

    if (wasBookmarked) {
      bookmarkedGroupIds.delete(groupId)
    } else {
      bookmarkedGroupIds.add(groupId)
    }

    const result: BookmarkToggleResult = {
      groupId,
      bookmarked: !wasBookmarked,
    }

    return HttpResponse.json(result)
  }),

  http.get(`${apiBaseUrl}/bookmarks`, () => {
    const list = data.bookmarkList.filter((b) => bookmarkedGroupIds.has(b.groupId))
    return HttpResponse.json(list)
  }),
]
