export type BoardCategory = 'NOTICE' | 'QUESTION' | 'DISCUSSION'

export type BoardPost = {
  id: string
  groupId: string
  title: string
  content: string
  authorNickname: string
  category: BoardCategory
  isPinned: boolean
  commentCount: number
  createdAt: string
  updatedAt: string
}

export type BoardComment = {
  id: string
  postId: string
  authorNickname: string
  content: string
  createdAt: string
}

export type CreatePostRequest = {
  title: string
  content: string
  category: BoardCategory
}
