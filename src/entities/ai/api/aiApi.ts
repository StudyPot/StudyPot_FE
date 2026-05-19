import { apiClient } from '@/shared/api'
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
