import { apiClient, type CursorPageResponse } from '@/shared/api'
import { apiBaseUrl } from '@/shared/config/api'
import type {
  AiConversation,
  AiConversationMessage,
  CreateMessageRequest,
  OpenConversationRequest,
} from '../model/types'

export function openAiConversation(
  groupId: string,
  request: OpenConversationRequest,
): Promise<AiConversation> {
  return apiClient<AiConversation>(`/groups/${groupId}/ai-conversations`, {
    method: 'POST',
    body: request,
  })
}

export function sendAiConversationMessage(
  conversationId: string,
  request: CreateMessageRequest,
): Promise<AiConversationMessage> {
  return apiClient<AiConversationMessage>(`/ai-conversations/${conversationId}/messages`, {
    method: 'POST',
    body: request,
  })
}

export type ListAiMessagesParams = {
  cursor?: string
  pageSize?: number
}

export function listAiConversationMessages(
  conversationId: string,
  params: ListAiMessagesParams = {},
): Promise<CursorPageResponse<AiConversationMessage>> {
  const searchParams = new URLSearchParams()
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  const query = searchParams.toString()
  return apiClient<CursorPageResponse<AiConversationMessage>>(
    `/ai-conversations/${conversationId}/messages${query ? `?${query}` : ''}`,
  )
}

export function subscribeToAiConversationStream(conversationId: string): EventSource {
  const base = apiBaseUrl.replace(/\/$/, '')
  return new EventSource(`${base}/ai-conversations/${conversationId}/stream`, {
    withCredentials: true,
  })
}
