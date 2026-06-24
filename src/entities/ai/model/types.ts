export type AiManager = {
  groupId: string
  persona: string
  updatedAt: string | null
  updatedByNickname: string | null
}

export type UpdateAiManagerRequest = {
  persona: string
}

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

export type AiMessageActionType = 'SHARE_QUESTION' | 'SHOW_EXISTING_POST'

export type AiMessageActionStatus = 'PENDING' | 'EXECUTED' | 'REJECTED'

export type AiMessageAction = {
  type: AiMessageActionType
  status?: AiMessageActionStatus | null
  title?: string | null
  summary?: string | null
  postId?: string | null
}

export type AiMessageActionDecision = 'CONFIRM' | 'REJECT'

export type AiConversationMessage = {
  id: string
  conversationId?: string
  senderType: AiConversationMessageSenderType
  content: string
  createdAt: string
  action?: AiMessageAction | null
}
