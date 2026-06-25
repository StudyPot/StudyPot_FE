import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import {
  decideAiConversationMessageAction,
  listAiConversationMessages,
  openAiConversation,
  sendAiConversationMessage,
  type AiConversation,
  type AiConversationMessage,
} from '@/entities/ai'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupAiPage from '../GroupAiPage.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/entities/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/ai')>()

  return {
    ...actual,
    listAiConversationMessages: vi.fn(),
    openAiConversation: vi.fn(),
    sendAiConversationMessage: vi.fn(),
    decideAiConversationMessageAction: vi.fn(),
  }
})

const groupId = '018f7a4e-0000-7000-9000-000000000010'
const conversation: AiConversation = {
  id: '018f7a4e-3000-7000-9000-000000000001',
  groupId,
  conversationType: 'TEAM_LEAD_CHAT',
  status: 'OPEN',
  summary: '',
  createdAt: '2026-06-04T01:00:00Z',
}
const recoveredMessages: AiConversationMessage[] = [
  {
    id: '018f7a4e-4000-7000-9000-000000000001',
    conversationId: conversation.id,
    senderType: 'USER',
    content: '지난번에 이야기한 과제 분량 다시 보여줘.',
    createdAt: '2026-06-04T01:01:00Z',
  },
  {
    id: '018f7a4e-4000-7000-9000-000000000002',
    conversationId: conversation.id,
    senderType: 'ASSISTANT',
    content: '지난 대화에서는 필수 과제를 하나 줄이는 방향을 정리했습니다.',
    createdAt: '2026-06-04T01:02:00Z',
  },
]

class FakeEventSource {
  static instances: FakeEventSource[] = []

  readonly url: string
  readonly withCredentials: boolean
  readonly addEventListener = vi.fn()
  readonly close = vi.fn()
  onerror: ((event: Event) => void) | null = null

  constructor(url: string, init?: EventSourceInit) {
    this.url = url
    this.withCredentials = init?.withCredentials === true
    FakeEventSource.instances.push(this)
  }

  emit(type: string, payload: unknown): void {
    for (const call of this.addEventListener.mock.calls) {
      if (call[0] === type) {
        ;(call[1] as (event: unknown) => void)(payload)
      }
    }
  }
}

function mountPage() {
  return mount(GroupAiPage, {
    global: {
      provide: {
        [groupWorkspaceContextKey as symbol]: {
          groupId: computed(() => groupId),
          group: ref(null),
          isGroupLoading: ref(false),
          groupErrorMessage: ref(''),
          reloadGroup: vi.fn(async () => {}),
          members: ref([]),
        },
      },
    },
  })
}

describe('GroupAiPage', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource)
    // scrollToBottom 이 requestAnimationFrame 을 await 하므로, 테스트에서 즉시 실행되게 해
    // 메시지 전송 흐름(await scrollToBottom 이후 send 호출)이 flushPromises 안에서 결정적으로 진행되게 한다.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0)
      return 0
    })
    FakeEventSource.instances = []
    vi.mocked(openAiConversation).mockResolvedValue(conversation)
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: recoveredMessages,
      pageInfo: { nextCursor: null, hasNext: false },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('recovers the ordinary team-lead conversation and renders previous messages on mount', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(openAiConversation).toHaveBeenCalledWith(groupId, {
      conversationType: 'TEAM_LEAD_CHAT',
    })
    expect(listAiConversationMessages).toHaveBeenCalledWith(conversation.id, { cursor: undefined })
    expect(wrapper.text()).toContain('지난번에 이야기한 과제 분량 다시 보여줘.')
    expect(wrapper.text()).toContain('지난 대화에서는 필수 과제를 하나 줄이는 방향을 정리했습니다.')
    expect(wrapper.text()).not.toContain('새 대화 세션')
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]?.withCredentials).toBe(true)
  })

  it('confirms a SHARE_QUESTION action and marks it shared', async () => {
    const actionMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-000000000009',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '영속성 컨텍스트는 ... 게시판에 올려둘까요?',
      createdAt: '2026-06-04T01:03:00Z',
      action: {
        type: 'SHARE_QUESTION',
        status: 'PENDING',
        title: 'JPA 영속성 컨텍스트란?',
        summary: '질문과 답변 요약입니다.',
      },
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [actionMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })
    vi.mocked(decideAiConversationMessageAction).mockResolvedValue({
      ...actionMessage,
      action: { ...actionMessage.action!, status: 'EXECUTED', postId: 'post-123' },
    })

    const wrapper = mountPage()
    await flushPromises()

    const confirmButton = wrapper.findAll('button').find((b) => b.text() === '올리기')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(decideAiConversationMessageAction).toHaveBeenCalledWith(
      conversation.id,
      actionMessage.id,
      'CONFIRM',
      undefined,
    )
    expect(wrapper.text()).toContain('질문 게시판에 올렸어요')
    expect(wrapper.findAll('button').some((b) => b.text() === '올리기')).toBe(false)
    // 완료 모달 + 게시판 이동 버튼
    expect(wrapper.findAll('button').some((b) => b.text() === '게시판으로 가기')).toBe(true)
  })

  it('renders a link to an existing post for SHOW_EXISTING_POST', async () => {
    const actionMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-00000000000b',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '이미 비슷한 글이 있어요.',
      createdAt: '2026-06-04T01:04:00Z',
      action: { type: 'SHOW_EXISTING_POST', status: null, title: 'JPA 영속성 컨텍스트', postId: 'post-7' },
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [actionMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('JPA 영속성 컨텍스트')
    expect(wrapper.findAll('button').some((b) => b.text() === '게시물 보러가기')).toBe(true)
    // 확인 API 는 호출되지 않아야 함(표시 전용)
    expect(decideAiConversationMessageAction).not.toHaveBeenCalled()
  })

  it('confirms a COMPLETE_TASK action', async () => {
    const actionMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-00000000000c',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '수고했어요! 완료로 표시할까요?',
      createdAt: '2026-06-04T01:05:00Z',
      action: { type: 'COMPLETE_TASK', status: 'PENDING', title: 'JPA 실습', completionStatus: 'DONE' },
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [actionMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })
    vi.mocked(decideAiConversationMessageAction).mockResolvedValue({
      ...actionMessage,
      action: { ...actionMessage.action!, status: 'EXECUTED' },
    })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('JPA 실습')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === '완료 처리')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(decideAiConversationMessageAction).toHaveBeenCalledWith(
      conversation.id,
      actionMessage.id,
      'CONFIRM',
      undefined,
    )
    expect(wrapper.text()).toContain('완료로 처리했어요')
    // 과제 완료는 질문 공유 완료 모달을 띄우면 안 됨
    expect(wrapper.text()).not.toContain('질문 게시판에 올렸어요')
    expect(wrapper.findAll('button').some((b) => b.text() === '게시판으로 가기')).toBe(false)
  })

  it('confirms an ADD_TASK action', async () => {
    const actionMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-00000000000d',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '이번 주에 추가할까요?',
      createdAt: '2026-06-04T01:06:00Z',
      action: { type: 'ADD_TASK', status: 'PENDING', title: '트랜잭션 실습', summary: '예제 따라하기' },
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [actionMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })
    vi.mocked(decideAiConversationMessageAction).mockResolvedValue({
      ...actionMessage,
      action: { ...actionMessage.action!, status: 'EXECUTED' },
    })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('트랜잭션 실습')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === '추가하기')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(decideAiConversationMessageAction).toHaveBeenCalledWith(
      conversation.id,
      actionMessage.id,
      'CONFIRM',
      undefined,
    )
    expect(wrapper.text()).toContain('이번 주 과제에 추가했어요')
  })

  it("submits a custom instruction via '기타'", async () => {
    const actionMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-00000000000a',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '답변이에요. 게시판에 올려둘까요?',
      createdAt: '2026-06-04T01:03:00Z',
      action: { type: 'SHARE_QUESTION', status: 'PENDING', title: '제목', summary: '요약' },
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [actionMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })
    vi.mocked(decideAiConversationMessageAction).mockResolvedValue({
      ...actionMessage,
      action: { ...actionMessage.action!, status: 'EXECUTED', postId: 'post-9' },
    })

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === '기타')!.trigger('click')
    const input = wrapper
      .findAll('input')
      .find((t) => (t.element as HTMLInputElement).placeholder.includes('원하는 방식'))
    expect(input).toBeTruthy()
    await input!.setValue('예시 코드 포함해서 더 짧게')
    await wrapper.findAll('button').find((b) => b.text() === '전송')!.trigger('click')
    await flushPromises()

    expect(decideAiConversationMessageAction).toHaveBeenCalledWith(
      conversation.id,
      actionMessage.id,
      'CONFIRM',
      '예시 코드 포함해서 더 짧게',
    )
  })

  it('renders the assistant reply directly when the API returns it (sync mode)', async () => {
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNext: false },
    })
    const assistantMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-0000000000b2',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '동기 모드 응답입니다.',
      createdAt: '2026-06-04T01:11:00Z',
    }
    vi.mocked(sendAiConversationMessage).mockResolvedValue(assistantMessage)

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('textarea').setValue('동기 질문이에요')
    await wrapper.find('button[aria-label="전송"]').trigger('click')
    await flushPromises()

    expect(sendAiConversationMessage).toHaveBeenCalledWith(conversation.id, {
      content: '동기 질문이에요',
    })
    expect(wrapper.text()).toContain('동기 모드 응답입니다.')
  })

  it('waits for the SSE assistant reply when the API returns the saved user message (async MQ mode)', async () => {
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNext: false },
    })
    const savedUserMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-0000000000a1',
      conversationId: conversation.id,
      senderType: 'USER',
      content: '이번 주 과제 줄여줘',
      createdAt: '2026-06-04T01:10:00Z',
    }
    vi.mocked(sendAiConversationMessage).mockResolvedValue(savedUserMessage)

    const wrapper = mountPage()
    await flushPromises()

    const es = FakeEventSource.instances[0]!

    await wrapper.find('textarea').setValue('이번 주 과제 줄여줘')
    await wrapper.find('button[aria-label="전송"]').trigger('click')
    await flushPromises()

    expect(sendAiConversationMessage).toHaveBeenCalledWith(conversation.id, {
      content: '이번 주 과제 줄여줘',
    })
    // 비동기 모드: 반환된 사용자 메시지를 또 추가하지 않으므로 사용자 말풍선은 1개(중복 없음)다.
    expect(wrapper.text().split('이번 주 과제 줄여줘').length - 1).toBe(1)
    // assistant 는 아직 도착 전: 동기 모드처럼 즉시 렌더되지 않는다.
    expect(wrapper.text()).not.toContain('필수 과제를 하나 줄였어.')

    // SSE 로 assistant 응답이 도착하면 렌더된다.
    const assistantMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-0000000000a2',
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      content: '필수 과제를 하나 줄였어.',
      createdAt: '2026-06-04T01:10:05Z',
    }
    es.emit('assistant-message-created', { data: JSON.stringify(assistantMessage) })
    await flushPromises()

    expect(wrapper.text()).toContain('필수 과제를 하나 줄였어.')
  })

  it('restores the loading indicator on remount while an async assistant reply is still pending', async () => {
    // 답변 생성 대기 중에 새로고침/탭 이동(리마운트)된 상황: 히스토리의 마지막이 최근 사용자 메시지.
    const pendingUserMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-0000000000c1',
      conversationId: conversation.id,
      senderType: 'USER',
      content: '아직 답 안 온 질문',
      createdAt: new Date().toISOString(),
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [pendingUserMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })

    const wrapper = mountPage()
    await flushPromises()

    // 로딩 상태가 복원되어 입력창이 비활성(isSending)이어야 한다.
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).disabled).toBe(true)

    // 이후 SSE 로 assistant 응답이 도착하면 로딩이 해제되고 답이 렌더된다.
    const es = FakeEventSource.instances[0]!
    es.emit('assistant-message-created', {
      data: JSON.stringify({
        id: '018f7a4e-4000-7000-9000-0000000000c2',
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        content: '늦었지만 답이야.',
        createdAt: new Date().toISOString(),
      }),
    })
    await flushPromises()

    expect(wrapper.text()).toContain('늦었지만 답이야.')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).disabled).toBe(false)
  })

  it('does not show loading on mount for an old unanswered user message', async () => {
    const oldUserMessage: AiConversationMessage = {
      id: '018f7a4e-4000-7000-9000-0000000000d1',
      conversationId: conversation.id,
      senderType: 'USER',
      content: '오래 전 질문',
      createdAt: '2026-06-04T01:00:00Z',
    }
    vi.mocked(listAiConversationMessages).mockResolvedValue({
      items: [oldUserMessage],
      pageInfo: { nextCursor: null, hasNext: false },
    })

    const wrapper = mountPage()
    await flushPromises()

    // 오래된 미응답은 생성 대기로 보지 않으므로 로딩(입력창 비활성)이 없어야 한다.
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).disabled).toBe(false)
  })
})
