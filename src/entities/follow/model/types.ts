export type FollowUser = {
  userId: string
  nickname: string
  email: string
  bio?: string | null
  mutual: boolean
  followedAt: string
}

export type FollowToggleResult = {
  userId: string
  following: boolean
}
