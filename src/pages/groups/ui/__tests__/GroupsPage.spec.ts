import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GroupsPage from '../GroupsPage.vue'

const onboardingGroupId = '018f7a4e-0000-7000-9000-000000000010'
const activeGroupId = '018f7a4e-0000-7000-9000-000000000011'

const groups = [
  {
    id: onboardingGroupId,
    name: 'Backend Interview Study',
    topic: 'Spring Boot',
    detailKeywords: ['JPA', 'Security', 'Testing'],
    status: 'ONBOARDING',
    maxMembers: 6,
    inviteCode: 'sb-onboarding-2026',
    startsAt: '2026-05-12',
    endsAt: '2026-06-30',
  },
  {
    id: activeGroupId,
    name: 'Spring Boot 실전 스터디',
    topic: 'Spring Boot',
    detailKeywords: ['JPA', 'Spring Security'],
    status: 'ACTIVE',
    maxMembers: 6,
    inviteCode: 'sb-active-2026',
    startsAt: '2026-04-22',
    endsAt: '2026-06-30',
  },
]

function createFetchMock(responseBody: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups', name: 'groups', component: GroupsPage },
      { path: '/groups/new', name: 'group-create', component: { template: '<main />' } },
      { path: '/groups/join', name: 'group-join', component: { template: '<main />' } },
      { path: '/groups/:groupId', name: 'group-overview', component: { template: '<main />' } },
      { path: '/groups/:groupId/onboarding', name: 'group-onboarding', component: { template: '<main />' } },
      { path: '/groups/:groupId/todo', name: 'group-todo', component: { template: '<main />' } },
      { path: '/groups/:groupId/retrospective', name: 'group-retrospective', component: { template: '<main />' } },
    ],
  })
}

async function mountGroupsPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createTestRouter()
  await router.push('/groups')
  await router.isReady()

  const wrapper = mount(GroupsPage, {
    global: { plugins: [router] },
  })

  await flushPromises()
  return wrapper
}

describe('GroupsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('renders state-aware entry actions for each group card', async () => {
    const wrapper = await mountGroupsPage(createFetchMock(groups))

    expect(wrapper.text()).toContain('온보딩 작성')
    expect(wrapper.text()).toContain('이번 주 Todo')
    expect(wrapper.find(`a[href="/groups/${onboardingGroupId}/onboarding"]`).exists()).toBe(true)
    expect(wrapper.find(`a[href="/groups/${activeGroupId}/todo"]`).exists()).toBe(true)
  })

  it('sends sort and order query params on initial load', async () => {
    const fetchMock = createFetchMock(groups)
    await mountGroupsPage(fetchMock)

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('sort=')
    expect(url).toContain('order=')
  })

  it('sends q param when user types in the search input', async () => {
    vi.useFakeTimers()
    const fetchMock = createFetchMock(groups)
    const wrapper = await mountGroupsPage(fetchMock)

    await wrapper.get('input[name="q"]').setValue('Spring')
    vi.advanceTimersByTime(300)
    await flushPromises()

    const calls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calls.some((url) => url.includes('q=Spring'))).toBe(true)
  })

  it('sends status param when a status filter button is clicked', async () => {
    const fetchMock = createFetchMock(groups)
    const wrapper = await mountGroupsPage(fetchMock)

    const activeButton = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.text() === '진행 중')

    expect(activeButton).toBeTruthy()
    await activeButton!.trigger('click')
    await flushPromises()

    const calls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calls.some((url) => url.includes('status=ACTIVE'))).toBe(true)
  })

  it('renders only the filtered group when status filter returns one result', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify(groups), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      // loadBookmarkIds (onMounted 에서 동시 호출)
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify([groups[1]]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

    const wrapper = await mountGroupsPage(fetchMock)

    const activeButton = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.text() === '진행 중')
    await activeButton!.trigger('click')
    await flushPromises()

    const articles = wrapper.findAll('article')
    expect(articles).toHaveLength(1)
    expect(articles[0].text()).toContain('Spring Boot 실전 스터디')
    expect(wrapper.text()).not.toContain('Backend Interview Study')
  })

  it('shows empty-filter state when no groups match the search query', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify(groups), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

    vi.useFakeTimers()
    const wrapper = await mountGroupsPage(fetchMock)

    await wrapper.get('input[name="q"]').setValue('존재하지않는그룹')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('검색 결과가 없습니다.')
    expect(wrapper.text()).toContain('필터 초기화')
  })

  it('resets filters and reloads all groups when reset button is clicked', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify(groups), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      // loadBookmarkIds (onMounted 에서 동시 호출)
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(groups), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

    vi.useFakeTimers()
    const wrapper = await mountGroupsPage(fetchMock)

    await wrapper.get('input[name="q"]').setValue('없는그룹')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('검색 결과가 없습니다.')

    const resetButton = wrapper.findAll('button').find((b) => b.text() === '필터 초기화')
    expect(resetButton).toBeTruthy()
    await resetButton!.trigger('click')
    await flushPromises()

    const searchInput = wrapper.get('input[name="q"]')
    expect((searchInput.element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('article')).toHaveLength(2)
  })

  it('sends updated sort params when sort select changes', async () => {
    const fetchMock = createFetchMock(groups)
    const wrapper = await mountGroupsPage(fetchMock)

    const sortSelect = wrapper.get('select[name="sort"]')
    await sortSelect.setValue(1)
    await flushPromises()

    const calls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calls.some((url) => url.includes('sort=startsAt') && url.includes('order=asc'))).toBe(true)
  })

  it('shows the active filter tab as pressed', async () => {
    const fetchMock = createFetchMock(groups)
    const wrapper = await mountGroupsPage(fetchMock)

    const allButton = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.text() === '전체')

    expect(allButton?.attributes('aria-pressed')).toBe('true')

    const onboardingButton = wrapper
      .findAll('button[aria-pressed]')
      .find((b) => b.text() === '온보딩')

    await onboardingButton!.trigger('click')
    await flushPromises()

    expect(onboardingButton?.attributes('aria-pressed')).toBe('true')
    expect(allButton?.attributes('aria-pressed')).toBe('false')
  })
})
