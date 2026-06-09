import { computed, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupBoardPage from '../GroupBoardPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000011'
const myUserId = '018f7a4e-0000-7000-9000-000000000001'
const otherUserId = 'user-002'

const boardNotice = {
  id: 'board-id-001',
  groupId,
  boardType: 'NOTICE',
  name: '공지',
  description: '',
  displayOrder: 1,
  defaultBoard: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const boardQuestion = {
  id: 'board-id-002',
  groupId,
  boardType: 'QUESTION',
  name: '질문',
  description: '',
  displayOrder: 2,
  defaultBoard: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const myPost = {
  id: 'post-my-001',
  groupId,
  boardId: 'board-id-001',
  author: { memberId: 'member-001', userId: myUserId, displayName: 'user1' },
  title: '내 게시글',
  contentPreview: '내용 미리보기',
  content: '내 게시글 전체 내용입니다.',
  pinned: false,
  commentCount: 1,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
}

const otherPost = {
  id: 'post-other-001',
  groupId,
  boardId: 'board-id-002',
  author: { memberId: 'member-002', userId: otherUserId, displayName: 'minji' },
  title: '다른 사람 게시글',
  contentPreview: '다른 내용',
  content: '다른 사람 게시글 내용입니다.',
  pinned: false,
  commentCount: 0,
  createdAt: '2026-05-02T00:00:00Z',
  updatedAt: '2026-05-02T00:00:00Z',
}

const myComment = {
  id: 'c-my-001',
  groupId,
  postId: myPost.id,
  author: { memberId: 'member-001', userId: myUserId, displayName: 'user1' },
  content: '내 댓글입니다.',
  createdAt: '2026-05-01T01:00:00Z',
  updatedAt: '2026-05-01T01:00:00Z',
}

const otherComment = {
  id: 'c-other-001',
  groupId,
  postId: myPost.id,
  author: { memberId: 'member-002', userId: otherUserId, displayName: 'minji' },
  content: '다른 사람 댓글',
  createdAt: '2026-05-01T02:00:00Z',
  updatedAt: '2026-05-01T02:00:00Z',
}

type Handler = { match: string | RegExp; method?: string; body: unknown; status?: number }

// regex 또는 string includes 매칭, method + match 길이 기준 특이도 정렬
function makeFetch(handlers: Handler[]) {
  return vi.fn<typeof fetch>().mockImplementation((input, init) => {
    const url = String(input)
    const method = (init as RequestInit | undefined)?.method?.toUpperCase() ?? 'GET'
    const handler = [...handlers]
      .sort((a, b) => {
        const aLen = a.match instanceof RegExp ? a.match.source.length : a.match.length
        const bLen = b.match instanceof RegExp ? b.match.source.length : b.match.length
        const aScore = (a.method ? 1000 : 0) + aLen
        const bScore = (b.method ? 1000 : 0) + bLen
        return bScore - aScore
      })
      .find((h) => {
        const methodOk = h.method ? h.method.toUpperCase() === method : true
        const urlOk =
          h.match instanceof RegExp ? h.match.test(url) : url.includes(h.match)
        return methodOk && urlOk
      })
    // 204 등 null body status 코드에는 body를 전달하면 Fetch spec 위반 TypeError가 발생함
    const status = handler?.status ?? 200
    const nullBodyStatuses = [101, 204, 205, 304]
    if (nullBodyStatuses.includes(status)) {
      return Promise.resolve(new Response(null, { status }))
    }
    return Promise.resolve(
      new Response(JSON.stringify(handler?.body ?? {}), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
}

let confirmSpy: ReturnType<typeof vi.spyOn>
let currentWrapper: ReturnType<typeof mount> | null = null

function mountPage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/board', component: GroupBoardPage }],
  })

  const pinia = createPinia()
  setActivePinia(pinia)
  const sessionStore = useSessionStore()
  sessionStore.$patch({
    user: {
      id: myUserId,
      email: 'user@example.com',
      nickname: 'user1',
      bio: null,
      preferredTopics: [],
    },
    status: 'authenticated',
  })

  currentWrapper = mount(GroupBoardPage, {
    global: {
      plugins: [pinia, router],
      provide: {
        [groupWorkspaceContextKey as symbol]: {
          groupId: computed(() => groupId),
        },
      },
    },
  })
  return currentWrapper
}

// URL 패턴 상수
// listBoards    : /.../{groupId}/boards            (ends with /boards)
// listBoardPosts: /.../{groupId}/boards/{boardId}/posts  (ends with /posts)
// getBoardPost  : /.../{groupId}/posts/{postId}    (ends with /{postId})
// listComments  : /.../{groupId}/posts/{postId}/comments (ends with /comments)

const boardsEndRe = /\/boards$/

describe('GroupBoardPage', () => {
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    currentWrapper?.unmount()
    currentWrapper = null
    confirmSpy.mockRestore()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows loading state on mount', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [], pageInfo: { nextCursor: null, hasNext: false } } },
    ])
    const wrapper = mountPage(fetchMock)
    // onMounted sets isLoadingBoards = true; wait one tick for Vue to re-render
    await nextTick()
    expect(wrapper.text()).toContain('게시글을 불러오는 중입니다.')
  })

  it('renders posts with category badge after loading', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice, boardQuestion] },
      {
        match: 'board-id-001/posts',
        method: 'GET',
        body: { items: [myPost, otherPost], pageInfo: { nextCursor: null, hasNext: false } },
      },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    expect(wrapper.text()).toContain('내 게시글')
    expect(wrapper.text()).toContain('다른 사람 게시글')

    // 카테고리 뱃지 (공지=NOTICE)
    const badges = wrapper.findAll('span').filter((s) => ['공지', '질문'].includes(s.text()))
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders sort selector with default 최신순 option', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      {
        match: 'board-id-001/posts',
        method: 'GET',
        body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } },
      },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const select = wrapper.find('select[aria-label="정렬 기준"]')
    expect(select.exists()).toBe(true)
    expect((select.element as HTMLSelectElement).value).toBe('createdAt:desc')
  })

  it('calls listBoardPosts with commentCount:desc when sort changed', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      {
        match: 'board-id-001/posts',
        method: 'GET',
        body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } },
      },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    const select = wrapper.find('select[aria-label="정렬 기준"]')
    await select.setValue('commentCount:desc')
    await flushPromises()

    const allCalls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls as Array<[string, ...unknown[]]>
    const postListCalls = allCalls.filter(([url]) =>
      String(url).includes('board-id-001/posts'),
    )
    const lastCall = postListCalls[postListCalls.length - 1]!
    expect(String(lastCall[0])).toContain('sort=commentCount')
    expect(String(lastCall[0])).toContain('order=desc')
  })

  it('shows edit/delete buttons for my post only', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}/comments`, method: 'GET', body: { items: [], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}`, method: 'GET', body: myPost },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    expect(wrapper.find('button[aria-label="게시글 수정"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="게시글 삭제"]').exists()).toBe(true)
  })

  it('does not show edit/delete for other user post', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardQuestion] },
      { match: 'board-id-002/posts', method: 'GET', body: { items: [otherPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${otherPost.id}/comments`, method: 'GET', body: { items: [], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${otherPost.id}`, method: 'GET', body: otherPost },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    expect(wrapper.find('button[aria-label="게시글 수정"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="게시글 삭제"]').exists()).toBe(false)
  })

  it('opens edit form pre-filled on 수정 click and submits PATCH', async () => {
    const updatedPost = { ...myPost, title: '수정된 제목', content: '수정된 내용' }
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}/comments`, method: 'GET', body: { items: [], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}`, method: 'GET', body: myPost },
      { match: `posts/${myPost.id}`, method: 'PATCH', body: updatedPost },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    await wrapper.find('button[aria-label="게시글 수정"]').trigger('click')

    const titleInput = wrapper.find('input[placeholder="제목을 입력하세요"]')
    expect(titleInput.exists()).toBe(true)
    expect((titleInput.element as HTMLInputElement).value).toBe(myPost.title)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // 수정 후 상세 뷰로 복귀
    expect(wrapper.find('button[aria-label="게시글 수정"]').exists()).toBe(true)
  })

  it('calls delete API and returns to list on 삭제 click', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}/comments`, method: 'GET', body: { items: [], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}`, method: 'GET', body: myPost },
      { match: `posts/${myPost.id}`, method: 'DELETE', body: null, status: 204 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    await wrapper.find('button[aria-label="게시글 삭제"]').trigger('click')
    await flushPromises()

    // 목록 뷰로 돌아감
    expect(wrapper.text()).not.toContain('← 목록으로')
    expect(wrapper.find('select[aria-label="정렬 기준"]').exists()).toBe(true)
  })

  it('shows edit/delete buttons only for my comments', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}/comments`, method: 'GET', body: { items: [myComment, otherComment], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}`, method: 'GET', body: myPost },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    expect(
      wrapper.find(`button[aria-label="${myComment.author.displayName} 댓글 수정"]`).exists(),
    ).toBe(true)
    expect(
      wrapper.find(`button[aria-label="${myComment.author.displayName} 댓글 삭제"]`).exists(),
    ).toBe(true)
    expect(
      wrapper.find(`button[aria-label="${otherComment.author.displayName} 댓글 수정"]`).exists(),
    ).toBe(false)
  })

  it('saves edited comment inline', async () => {
    const updatedComment = { ...myComment, content: '수정된 댓글 내용' }
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}/comments`, method: 'GET', body: { items: [myComment], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}`, method: 'GET', body: myPost },
      { match: `comments/${myComment.id}`, method: 'PATCH', body: updatedComment },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    await wrapper
      .find(`button[aria-label="${myComment.author.displayName} 댓글 수정"]`)
      .trigger('click')

    const editTextarea = wrapper.find('li textarea')
    expect(editTextarea.exists()).toBe(true)
    await editTextarea.setValue('수정된 댓글 내용')

    const saveBtn = wrapper.findAll('button').find((b) => b.text() === '저장')
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('수정된 댓글 내용')
    expect(wrapper.find('li textarea').exists()).toBe(false)
  })

  it('removes comment from list after clicking 댓글 삭제', async () => {
    const fetchMock = makeFetch([
      { match: boardsEndRe, method: 'GET', body: [boardNotice] },
      { match: 'board-id-001/posts', method: 'GET', body: { items: [myPost], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}/comments`, method: 'GET', body: { items: [myComment], pageInfo: { nextCursor: null, hasNext: false } } },
      { match: `posts/${myPost.id}`, method: 'GET', body: myPost },
      { match: `comments/${myComment.id}`, method: 'DELETE', body: null, status: 204 },
    ])
    const wrapper = mountPage(fetchMock)
    await flushPromises()

    await wrapper.find('li').trigger('click')
    await flushPromises()

    await wrapper
      .find(`button[aria-label="${myComment.author.displayName} 댓글 삭제"]`)
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('첫 댓글을 남겨보세요.')
  })
})
