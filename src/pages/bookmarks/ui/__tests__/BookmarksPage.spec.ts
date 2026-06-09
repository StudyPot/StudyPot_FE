import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Bookmark } from '@/entities/bookmark'
import BookmarksPage from '../BookmarksPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000010'

const mockBookmark: Bookmark = {
  groupId,
  group: {
    id: groupId,
    name: 'Backend Interview Study',
    topic: 'Spring Boot',
    detailKeywords: ['JPA', 'Security', 'Testing'],
    status: 'ONBOARDING',
    maxMembers: 6,
    inviteCode: 'sb-onboarding-2026',
    startsAt: '2026-05-12',
    endsAt: '2026-06-30',
  },
  bookmarkedAt: '2026-06-01T00:00:00+09:00',
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
    routes: [
      { path: '/bookmarks', name: 'bookmarks', component: BookmarksPage },
      { path: '/groups/:groupId', name: 'group-overview', component: { template: '<main />' } },
    ],
  })

  return mount(BookmarksPage, {
    global: { plugins: [router] },
  })
}

describe('BookmarksPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state on mount', () => {
    const fetchMock = makeFetch([{ match: '/bookmarks', body: [mockBookmark] }])
    const wrapper = mountPage(fetchMock)

    expect(wrapper.text()).toContain('찜 목록을 불러오는 중입니다.')
  })

  it('renders bookmarked group name and topic after load', async () => {
    const fetchMock = makeFetch([{ match: '/bookmarks', body: [mockBookmark] }])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('Backend Interview Study')
    expect(wrapper.text()).toContain('Spring Boot')
    expect(wrapper.text()).toContain('JPA')
  })

  it('shows empty state when there are no bookmarks', async () => {
    const fetchMock = makeFetch([{ match: '/bookmarks', body: [] }])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('아직 찜한 스터디가 없어요.')
    expect(wrapper.findAll('article')).toHaveLength(0)
  })

  it('shows error state when API call fails', async () => {
    const fetchMock = makeFetch([
      { match: '/bookmarks', body: { title: 'Internal Server Error', status: 500 }, status: 500 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('목록을 불러오지 못했습니다.')
  })

  it('removes group card from list after clicking the ★ (찜 해제) button', async () => {
    const fetchMock = makeFetch([
      { match: '/bookmarks', method: 'GET', body: [mockBookmark] },
      {
        match: `/groups/${groupId}/bookmark`,
        method: 'POST',
        body: { groupId, bookmarked: false },
      },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(1)

    const toggleButton = wrapper.find(`button[aria-label="${mockBookmark.group.name} 찜 해제"]`)
    expect(toggleButton.exists()).toBe(true)

    await toggleButton.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(0)
    expect(wrapper.text()).toContain('아직 찜한 스터디가 없어요.')
  })

  it('shows multiple bookmarked groups', async () => {
    const secondGroupId = '018f7a4e-0000-7000-9000-000000000011'
    const secondBookmark: Bookmark = {
      groupId: secondGroupId,
      group: {
        id: secondGroupId,
        name: 'Spring Boot 실전 스터디',
        topic: 'Spring Boot',
        detailKeywords: ['JPA', 'Spring Security'],
        status: 'ACTIVE',
        maxMembers: 6,
        inviteCode: 'sb-active-2026',
        startsAt: '2026-04-22',
        endsAt: '2026-06-30',
      },
      bookmarkedAt: '2026-06-02T00:00:00+09:00',
    }

    const fetchMock = makeFetch([
      { match: '/bookmarks', body: [mockBookmark, secondBookmark] },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('Backend Interview Study')
    expect(wrapper.text()).toContain('Spring Boot 실전 스터디')
  })
})
