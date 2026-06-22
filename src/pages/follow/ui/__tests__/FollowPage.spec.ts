import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { FollowUser } from '@/entities/follow'
import FollowPage from '../FollowPage.vue'

const followingUser: FollowUser = {
  userId: 'user-002',
  nickname: '박지은',
  email: 'jieun@example.com',
  bio: '프론트엔드 개발자입니다.',
  mutual: true,
  followedAt: '2026-05-01T00:00:00+09:00',
}

const followingUserOnly: FollowUser = {
  userId: 'user-003',
  nickname: '이민우',
  email: 'minwoo@example.com',
  bio: null,
  mutual: false,
  followedAt: '2026-05-10T00:00:00+09:00',
}

const followerUser: FollowUser = {
  userId: 'user-004',
  nickname: '김소현',
  email: 'sohyeon@example.com',
  bio: '알고리즘 스터디 중입니다.',
  mutual: false,
  followedAt: '2026-05-15T00:00:00+09:00',
}

function makeFetch(handlers: Array<{ match: string; method?: string; body: unknown; status?: number }>) {
  return vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const url = String(input)
    const method = (init as RequestInit | undefined)?.method?.toUpperCase() ?? 'GET'
    const handler = handlers.find((h) => {
      const methodMatch = h.method ? h.method.toUpperCase() === method : true
      return methodMatch && url.includes(h.match)
    })
    return Promise.resolve(
      new Response(JSON.stringify(handler?.body ?? {}), {
        status: handler?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
}

function mountPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/follow', name: 'follow', component: FollowPage }],
  })

  return mount(FollowPage, {
    global: { plugins: [router] },
  })
}

describe('FollowPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state on mount', () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser] },
      { match: '/me/followers', body: [followerUser] },
    ])
    const wrapper = mountPage(fetchMock)

    expect(wrapper.text()).toContain('목록을 불러오는 중입니다.')
  })

  it('renders following list with nickname and 맞팔 badge', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser, followingUserOnly] },
      { match: '/me/followers', body: [followerUser] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('박지은')
    expect(wrapper.text()).toContain('이민우')
    // 맞팔 badge for mutual user
    const badges = wrapper.findAll('span').filter((s) => s.text() === '맞팔')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows 언팔로우 button in 팔로잉 tab', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser] },
      { match: '/me/followers', body: [] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const unfollowBtn = wrapper.find(`button[aria-label="${followingUser.nickname} 언팔로우"]`)
    expect(unfollowBtn.exists()).toBe(true)
  })

  it('removes user from following list after clicking 언팔로우', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser] },
      { match: '/me/followers', body: [] },
      {
        match: `/users/${followingUser.userId}/follow`,
        method: 'POST',
        body: { userId: followingUser.userId, following: false },
      },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.findAll('li')).toHaveLength(1)

    await wrapper.find(`button[aria-label="${followingUser.nickname} 언팔로우"]`).trigger('click')
    await flushPromises()

    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).toContain('팔로잉 중인 사용자가 없습니다.')
  })

  it('switches to followers tab and shows follower list', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser] },
      { match: '/me/followers', body: [followerUser] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const followerTab = wrapper.findAll('button[role="tab"]').find((b) => b.text().includes('팔로워'))
    await followerTab!.trigger('click')

    expect(wrapper.text()).toContain('김소현')
    expect(wrapper.text()).toContain('알고리즘 스터디 중입니다.')
  })

  it('shows 팔로우 button for non-followed follower and 팔로잉 중 label for already-followed', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser] },
      { match: '/me/followers', body: [followingUser, followerUser] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const followerTab = wrapper.findAll('button[role="tab"]').find((b) => b.text().includes('팔로워'))
    await followerTab!.trigger('click')

    // followingUser is already followed → shows '팔로잉 중'
    expect(wrapper.text()).toContain('팔로잉 중')
    // followerUser is not followed → shows 팔로우 button
    const followBtn = wrapper.find(`button[aria-label="${followerUser.nickname} 팔로우"]`)
    expect(followBtn.exists()).toBe(true)
  })

  it('shows 맞팔 badge for mutual follow users in follower tab', async () => {
    const mutualFollower: FollowUser = { ...followingUser, mutual: true }
    const fetchMock = makeFetch([
      { match: '/me/following', body: [followingUser] },
      { match: '/me/followers', body: [mutualFollower] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const followerTab = wrapper.findAll('button[role="tab"]').find((b) => b.text().includes('팔로워'))
    await followerTab!.trigger('click')

    const badges = wrapper.findAll('span').filter((s) => s.text() === '맞팔')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows error state when API fails', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: { title: 'Internal Server Error', status: 500 }, status: 500 },
      { match: '/me/followers', body: [], status: 500 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('목록을 불러오지 못했습니다.')
  })

  it('shows empty state when following list is empty', async () => {
    const fetchMock = makeFetch([
      { match: '/me/following', body: [] },
      { match: '/me/followers', body: [] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('팔로잉 중인 사용자가 없습니다.')
  })
})
