import type { StudyGroup } from '@/entities/group/model/types'

export type Bookmark = {
  groupId: string
  group: StudyGroup
  bookmarkedAt: string
}

export type BookmarkToggleResult = {
  groupId: string
  bookmarked: boolean
}
