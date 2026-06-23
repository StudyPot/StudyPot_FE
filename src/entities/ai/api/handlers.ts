import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { AiConversation, AiConversationMessage, AiManager, CreateMessageRequest, UpdateAiManagerRequest } from '../model/types'

// 그룹별 AI 팀장 퍼소나 상태 (in-memory)
const aiManagerStore = new Map<string, AiManager>()

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

function sseEvent(name: string, data: unknown): Uint8Array {
  return encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
}

export const aiHandlers = [
  // AI 팀장 퍼소나 조회
  http.get(`${apiBaseUrl}/groups/:groupId/ai-manager`, ({ params }) => {
    const groupId = String(params.groupId)
    const stored = aiManagerStore.get(groupId)
    if (stored) return HttpResponse.json(stored)
    const base = mockMswData.aiTeamLeader.aiManager as AiManager
    return HttpResponse.json({ ...base, groupId })
  }),

  // AI 팀장 퍼소나 설정
  http.patch(`${apiBaseUrl}/groups/:groupId/ai-manager`, async ({ params, request }) => {
    const groupId = String(params.groupId)
    const body = (await request.json()) as UpdateAiManagerRequest
    const updated: AiManager = {
      groupId,
      persona: body.persona,
      updatedAt: new Date().toISOString(),
      updatedByNickname: 'user1',
    }
    aiManagerStore.set(groupId, updated)
    return HttpResponse.json(updated)
  }),

  http.post(`${apiBaseUrl}/groups/:groupId/ai-conversations`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<AiConversation>
    const conversation = mockMswData.aiTeamLeader.conversation as unknown as AiConversation

    return HttpResponse.json(
      {
        ...conversation,
        ...body,
        groupId: String(params.groupId),
        summary: conversation.summary ?? '',
      },
      { status: 201 },
    )
  }),

  // 메시지 목록 조회 (cursor page 형식)
  http.get(`${apiBaseUrl}/ai-conversations/:conversationId/messages`, () => {
    const messages = mockMswData.aiTeamLeader.messages as AiConversationMessage[]
    return HttpResponse.json({
      items: messages,
      pageInfo: { nextCursor: null, hasNext: false },
    })
  }),

  // 메시지 전송 — SSE 연결 중이면 SSE가 응답 전달. 여기선 폴백용으로 2초 딜레이 후 반환
  http.post(`${apiBaseUrl}/ai-conversations/:conversationId/messages`, async ({ params, request }) => {
    const body = (await request.json()) as CreateMessageRequest
    const assistantMessage = mockMswData.aiTeamLeader.messages.find(
      (message) => message.senderType === 'ASSISTANT',
    )

    await new Promise<void>((resolve) => setTimeout(resolve, 2000))

    return HttpResponse.json(
      {
        id: `msg-${Date.now()}`,
        conversationId: String(params.conversationId),
        senderType: 'ASSISTANT',
        content: assistantMessage?.content ?? `"${body.content}"에 대한 AI 팀장 응답입니다.`,
        createdAt: new Date().toISOString(),
      } satisfies AiConversationMessage,
      { status: 201 },
    )
  }),

  // AI 대화 SSE 스트림
  http.get(`${apiBaseUrl}/ai-conversations/:conversationId/stream`, ({ params }) => {
    const conversationId = String(params.conversationId)
    const assistantMessage = mockMswData.aiTeamLeader.messages.find(
      (m) => m.senderType === 'ASSISTANT',
    )

    const stream = new ReadableStream({
      start(controller) {
        // 연결 확인 이벤트
        controller.enqueue(sseEvent('connected', { stream: 'ai-conversation' }))

        // 3초 후 생성 시작 이벤트
        setTimeout(() => {
          controller.enqueue(sseEvent('assistant-generation-started', { conversationId }))
        }, 3000)

        // 5초 후 메시지 완성 이벤트
        setTimeout(() => {
          controller.enqueue(
            sseEvent('assistant-message-created', {
              id: `sse-msg-${Date.now()}`,
              conversationId,
              senderType: 'ASSISTANT',
              content: assistantMessage?.content ?? 'SSE로 전달된 AI 팀장 응답입니다.',
              createdAt: new Date().toISOString(),
            }),
          )
        }, 5000)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }),
]
