export type AiConversationType = 'TEAM_LEAD_CHAT' | 'RETROSPECTIVE'

export type AiConversationStatus = 'OPEN' | 'CLOSED'

export type AiConversationMessageSenderType = 'USER' | 'ASSISTANT' | 'SYSTEM'

export type OpenConversationRequest = {
  conversationType: AiConversationType
  weekId?: string
  retrospectiveId?: string
}

export type AiConversation = {
  id: string
  conversationType: AiConversationType
  status: AiConversationStatus
  summary?: string | null
  groupId?: string
  createdAt?: string
}

export type CreateMessageRequest = {
  content: string
}

export type AiConversationMessage = {
  id: string
  conversationId?: string
  senderType: AiConversationMessageSenderType
  content: string
  createdAt: string
}
