import { apiClient, getAccessToken, type CursorPageResponse } from '@/shared/api'
import { apiBaseUrl } from '@/shared/config/api'
import type {
  AiConversation,
  AiConversationMessage,
  AiManager,
  AiMessageActionDecision,
  CreateMessageRequest,
  OpenConversationRequest,
  UpdateAiManagerRequest,
} from '../model/types'

export function getAiManager(groupId: string): Promise<AiManager> {
  return apiClient<AiManager>(`/groups/${groupId}/ai-manager`)
}

export function updateAiManager(groupId: string, request: UpdateAiManagerRequest): Promise<AiManager> {
  return apiClient<AiManager>(`/groups/${groupId}/ai-manager`, {
    method: 'PATCH',
    body: request,
  })
}

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
  direction?: 'ASC' | 'DESC'
}

export function listAiConversationMessages(
  conversationId: string,
  params: ListAiMessagesParams = {},
): Promise<CursorPageResponse<AiConversationMessage>> {
  const searchParams = new URLSearchParams()
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.direction) searchParams.set('direction', params.direction)
  const query = searchParams.toString()
  return apiClient<CursorPageResponse<AiConversationMessage>>(
    `/ai-conversations/${conversationId}/messages${query ? `?${query}` : ''}`,
  )
}

export function decideAiConversationMessageAction(
  conversationId: string,
  messageId: string,
  decision: AiMessageActionDecision,
  instruction?: string,
): Promise<AiConversationMessage> {
  return apiClient<AiConversationMessage>(
    `/ai-conversations/${conversationId}/messages/${messageId}/action`,
    {
      method: 'POST',
      body: instruction ? { decision, instruction } : { decision },
    },
  )
}

export function subscribeToAiConversationStream(conversationId: string): EventSource {
  const base = apiBaseUrl.replace(/\/$/, '')
  // EventSource는 Authorization 헤더를 못 실어, 쿠키가 막힌 환경(크로스사이트)을 위해
  // access_token을 쿼리로 전달한다(쿠키는 withCredentials로 병행).
  const accessToken = getAccessToken()
  const streamUrl = `${base}/ai-conversations/${conversationId}/stream${accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : ''}`
  return new EventSource(streamUrl, {
    withCredentials: true,
  })
}
