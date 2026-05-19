import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type { AiConversation, AiConversationMessage, CreateMessageRequest } from '../model/types'

export const aiHandlers = [
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
  http.post(`${apiBaseUrl}/ai-conversations/:conversationId/messages`, async ({ params, request }) => {
    const body = (await request.json()) as CreateMessageRequest
    const assistantMessage = mockMswData.aiTeamLeader.messages.find(
      (message) => message.senderType === 'ASSISTANT',
    )

    return HttpResponse.json(
      {
        id: assistantMessage?.id ?? `message-${Date.now()}`,
        conversationId: String(params.conversationId),
        senderType: 'ASSISTANT',
        content: assistantMessage?.content ?? body.content,
        createdAt: assistantMessage?.createdAt ?? new Date().toISOString(),
      } satisfies AiConversationMessage,
      { status: 201 },
    )
  }),
]
