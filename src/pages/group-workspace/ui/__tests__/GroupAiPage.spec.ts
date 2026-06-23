import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import {
  listAiConversationMessages,
  openAiConversation,
  type AiConversation,
  type AiConversationMessage,
} from '@/entities/ai'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupAiPage from '../GroupAiPage.vue'

vi.mock('@/entities/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/ai')>()

  return {
    ...actual,
    listAiConversationMessages: vi.fn(),
    openAiConversation: vi.fn(),
    sendAiConversationMessage: vi.fn(),
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
    expect(listAiConversationMessages).toHaveBeenCalledWith(conversation.id)
    expect(wrapper.text()).toContain('지난번에 이야기한 과제 분량 다시 보여줘.')
    expect(wrapper.text()).toContain('지난 대화에서는 필수 과제를 하나 줄이는 방향을 정리했습니다.')
    expect(wrapper.text()).not.toContain('새 대화 세션')
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]?.withCredentials).toBe(true)
  })
})
