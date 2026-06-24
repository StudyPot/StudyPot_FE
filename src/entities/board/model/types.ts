export type GroupBoardType = 'NOTICE' | 'QUESTION' | 'RESOURCE' | 'RETROSPECTIVE' | 'LEADER_REPORT'

export type GroupBoard = {
  id: string
  groupId: string
  boardType: GroupBoardType
  name: string
  description: string
  displayOrder: number
  defaultBoard: boolean
  createdAt: string
  updatedAt: string
}

export type BoardAuthor = {
  memberId: string
  userId: string
  displayName: string
}

export type BoardPostSummary = {
  id: string
  groupId: string
  boardId: string
  author: BoardAuthor
  title: string
  contentPreview: string
  pinned: boolean
  commentCount: number
  createdAt: string
  updatedAt: string
}

export type BoardPost = {
  id: string
  groupId: string
  boardId: string
  author: BoardAuthor
  title: string
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export type BoardComment = {
  id: string
  groupId: string
  postId: string
  author: BoardAuthor
  content: string
  createdAt: string
  updatedAt: string
}

export type CreatePostRequest = {
  title: string
  content: string
  pinned?: boolean
}

export type UpdatePostRequest = {
  boardId?: string
  title?: string
  content?: string
  pinned?: boolean
}
