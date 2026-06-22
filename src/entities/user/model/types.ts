export type User = {
  id: string
  email: string
  nickname: string
  bio?: string | null
  preferredTopics?: string[]
}

export type UpdateUserRequest = {
  nickname: string
  bio?: string
  preferredTopics?: string[]
}
