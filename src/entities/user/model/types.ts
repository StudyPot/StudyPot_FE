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

export type UserPlan = 'FREE' | 'PREMIUM'

// GET /users/me/study-quota 응답. 호스트(생성자)로서 운영 중인 스터디 개수 제한 현황.
export type StudyQuota = {
  plan: UserPlan
  hostedActiveCount: number
  limit: number
  canCreate: boolean
}
