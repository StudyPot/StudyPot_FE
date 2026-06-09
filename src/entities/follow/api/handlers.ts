import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { FollowToggleResult, FollowUser } from '../model/types'

type FollowData = {
  followingUserIds: string[]
  following: FollowUser[]
  followers: FollowUser[]
}

const data = mockMswData.follows as FollowData

const followingUserIds = new Set<string>(data.followingUserIds)

function buildFollowingList(): FollowUser[] {
  return data.following.map((u) => ({
    ...u,
    mutual: data.followers.some((f) => f.userId === u.userId),
  }))
}

function buildFollowerList(): FollowUser[] {
  return data.followers.map((u) => ({
    ...u,
    mutual: followingUserIds.has(u.userId),
  }))
}

export const followHandlers = [
  http.post(`${apiBaseUrl}/users/:userId/follow`, ({ params }) => {
    const userId = String(params.userId)
    const wasFollowing = followingUserIds.has(userId)

    if (wasFollowing) {
      followingUserIds.delete(userId)
    } else {
      followingUserIds.add(userId)
    }

    const result: FollowToggleResult = { userId, following: !wasFollowing }
    return HttpResponse.json(result)
  }),

  http.get(`${apiBaseUrl}/users/me/following`, () => {
    const list = buildFollowingList().filter((u) => followingUserIds.has(u.userId))
    return HttpResponse.json(list)
  }),

  http.get(`${apiBaseUrl}/users/me/followers`, () => {
    return HttpResponse.json(buildFollowerList())
  }),
]
