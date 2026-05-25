<script setup lang="ts">
import { inject, nextTick, ref } from 'vue'

import {
  openAiConversation,
  sendAiConversationMessage,
  type AiConversation,
  type AiConversationMessage,
} from '@/entities/ai'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupAiPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

type PageState = 'idle' | 'opening' | 'chat' | 'error'

const pageState = ref<PageState>('idle')
const openError = ref('')
const conversation = ref<AiConversation | null>(null)
const messages = ref<AiConversationMessage[]>([])
const inputText = ref('')
const isSending = ref(false)
const sendError = ref('')
const messagesEndRef = ref<HTMLElement | null>(null)

async function handleOpenConversation(): Promise<void> {
  pageState.value = 'opening'
  openError.value = ''

  try {
    conversation.value = await openAiConversation(groupId.value, {
      conversationType: 'TEAM_LEAD_CHAT',
    })
    pageState.value = 'chat'
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      openError.value = '대화 세션을 열 권한이 없습니다.'
    } else {
      openError.value = error instanceof ApiError ? error.message : '대화 세션을 열지 못했습니다.'
    }
    pageState.value = 'error'
  }
}

async function handleSendMessage(): Promise<void> {
  const content = inputText.value.trim()

  if (!content || !conversation.value || isSending.value) {
    return
  }

  const userMessage: AiConversationMessage = {
    id: `optimistic-${Date.now()}`,
    conversationId: conversation.value.id,
    senderType: 'USER',
    content,
    createdAt: new Date().toISOString(),
  }

  messages.value.push(userMessage)
  inputText.value = ''
  isSending.value = true
  sendError.value = ''

  await scrollToBottom()

  try {
    const assistantMessage = await sendAiConversationMessage(conversation.value.id, { content })
    messages.value.push(assistantMessage)
    await scrollToBottom()
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      sendError.value = '메시지를 전송할 권한이 없습니다.'
    } else {
      sendError.value =
        error instanceof ApiError ? error.message : '메시지 전송에 실패했습니다.'
    }
  } finally {
    isSending.value = false
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void handleSendMessage()
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
}
</script>

<template>
  <div class="grid gap-5">
    <!-- idle -->
    <section
      v-if="pageState === 'idle'"
      class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
    >
      <p class="text-sm font-semibold text-[var(--color-primary)]">AI 팀장</p>
      <h2 class="mt-2 text-2xl font-bold text-[var(--color-ink)]">AI 팀장과 대화하기</h2>
      <p class="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        현재 학습 흐름, 과제 우선순위, 다음 주 계획 등을 AI 팀장에게 물어보세요.
        새 대화 세션이 시작됩니다.
      </p>

      <button
        type="button"
        class="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
        @click="handleOpenConversation"
      >
        대화 시작
      </button>
    </section>

    <!-- opening -->
    <ScreenState
      v-else-if="pageState === 'opening'"
      variant="loading"
      title="대화 세션을 여는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <!-- error -->
    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="대화 세션을 열지 못했습니다."
      :description="openError"
      action-label="다시 시도"
      @action="handleOpenConversation"
    />

    <!-- chat -->
    <section
      v-else-if="pageState === 'chat'"
      class="rounded-lg border border-[var(--color-line)] bg-white/85 shadow-[var(--shadow-soft)]"
    >
      <div class="border-b border-[var(--color-line)] px-5 py-4">
        <p class="text-sm font-semibold text-[var(--color-primary)]">AI 팀장</p>
        <h2 class="mt-1 text-lg font-bold text-[var(--color-ink)]">대화 중</h2>
      </div>

      <!-- 메시지 목록 -->
      <div class="flex max-h-[480px] flex-col gap-4 overflow-y-auto px-5 py-4">
        <p
          v-if="messages.length === 0"
          class="text-center text-sm text-[var(--color-muted)]"
        >
          첫 메시지를 보내 대화를 시작해 보세요.
        </p>

        <template v-for="message in messages" :key="message.id">
          <!-- USER -->
          <div
            v-if="message.senderType === 'USER'"
            class="flex justify-end"
          >
            <div class="max-w-[75%]">
              <p
                class="rounded-2xl rounded-tr-sm bg-[var(--color-primary)] px-4 py-2.5 text-sm leading-6 text-white"
              >
                {{ message.content }}
              </p>
              <p class="mt-1 text-right text-xs text-[var(--color-muted)]">
                {{ formatTime(message.createdAt) }}
              </p>
            </div>
          </div>

          <!-- ASSISTANT -->
          <div
            v-else-if="message.senderType === 'ASSISTANT'"
            class="flex justify-start"
          >
            <div class="max-w-[75%]">
              <p class="mb-1 text-xs font-semibold text-[var(--color-primary)]">AI 팀장</p>
              <p
                class="rounded-2xl rounded-tl-sm bg-[var(--color-card)] px-4 py-2.5 text-sm leading-6 text-[var(--color-ink)]"
              >
                {{ message.content }}
              </p>
              <p class="mt-1 text-xs text-[var(--color-muted)]">
                {{ formatTime(message.createdAt) }}
              </p>
            </div>
          </div>
        </template>

        <!-- 전송 중 indicator -->
        <div v-if="isSending" class="flex justify-start">
          <div
            class="rounded-2xl rounded-tl-sm bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-muted)]"
          >
            <span class="animate-pulse">응답 중…</span>
          </div>
        </div>

        <div ref="messagesEndRef" aria-hidden="true" />
      </div>

      <!-- 에러 -->
      <p
        v-if="sendError"
        role="alert"
        class="mx-5 text-sm font-semibold text-red-700"
      >
        {{ sendError }}
      </p>

      <!-- 입력창 -->
      <div class="border-t border-[var(--color-line)] p-4">
        <div class="flex gap-2">
          <textarea
            v-model="inputText"
            rows="2"
            placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
            :disabled="isSending"
            class="flex-1 resize-none rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.14)] disabled:opacity-50"
            @keydown="handleKeydown"
          />
          <button
            type="button"
            :disabled="isSending || !inputText.trim()"
            class="inline-flex h-full items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
            @click="handleSendMessage"
          >
            전송
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
