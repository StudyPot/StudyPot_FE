import { apiClient } from '@/shared/api'
import type { Bookmark, BookmarkToggleResult } from '../model/types'

export function toggleBookmark(groupId: string): Promise<BookmarkToggleResult> {
  return apiClient<BookmarkToggleResult>(`/groups/${groupId}/bookmark`, {
    method: 'POST',
  })
}

export function listBookmarks(): Promise<Bookmark[]> {
  return apiClient<Bookmark[]>('/bookmarks')
}
