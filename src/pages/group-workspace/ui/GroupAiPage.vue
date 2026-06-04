<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { inject, nextTick, onUnmounted, ref } from 'vue'

import {
  listAiConversationMessages,
  openAiConversation,
  sendAiConversationMessage,
  type AiConversation,
  type AiConversationMessage,
} from '@/entities/ai'
import { ApiError } from '@/shared/api'
import { apiBaseUrl } from '@/shared/config/api'
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
const eventSource = ref<EventSource | null>(null)
const isSseActive = ref(false)

function subscribeToStream(conversationId: string): void {
  closeStream()
  const url = `${apiBaseUrl.replace(/\/$/, '')}/ai-conversations/${conversationId}/stream`
  const es = new EventSource(url, { withCredentials: true })

  es.addEventListener('connected', () => {
    isSseActive.value = true
  })

  es.addEventListener('assistant-message-created', (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data as string) as AiConversationMessage
      addUniqueMessage(message)
      void scrollToBottom()
    } catch {
      // JSON 파싱 실패 시 무시
    }
    isSending.value = false
  })

  es.addEventListener('assistant-generation-failed', () => {
    if (isSending.value) {
      sendError.value = 'AI 응답 생성에 실패했습니다.'
      isSending.value = false
    }
  })

  es.onerror = () => {
    isSseActive.value = false
    closeStream()
  }

  eventSource.value = es
}

function closeStream(): void {
  eventSource.value?.close()
  eventSource.value = null
  isSseActive.value = false
}

function addUniqueMessage(message: AiConversationMessage): void {
  if (!messages.value.some((m) => m.id === message.id)) {
    messages.value.push(message)
  }
}

async function handleOpenConversation(): Promise<void> {
  pageState.value = 'opening'
  openError.value = ''

  try {
    conversation.value = await openAiConversation(groupId.value, {
      conversationType: 'TEAM_LEAD_CHAT',
    })
    try {
      messages.value = await listAiConversationMessages(conversation.value.id)
      await scrollToBottom()
    } catch {
      // 히스토리 로드 실패 시 빈 상태로 시작
    }
    subscribeToStream(conversation.value.id)
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
    // SSE가 이미 메시지를 전달했으면 중복 추가 방지, 아니면 폴백으로 추가
    addUniqueMessage(assistantMessage)
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

onUnmounted(() => {
  closeStream()
})

function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false }) as string
  return DOMPurify.sanitize(html)
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
              <div
                class="ai-markdown rounded-2xl rounded-tl-sm bg-[var(--color-card)] px-4 py-2.5 text-sm leading-6 text-[var(--color-ink)]"
                v-html="renderMarkdown(message.content)"
              />
              <p class="mt-1 text-xs text-[var(--color-muted)]">
                {{ formatTime(message.createdAt) }}
              </p>
            </div>
          </div>
        </template>

        <!-- 전송 중 indicator: 마지막 메시지가 USER일 때만 표시 -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="isSending && messages.length > 0 && messages[messages.length - 1]?.senderType === 'USER'"
            class="flex justify-start"
          >
            <div class="max-w-[75%]">
              <p class="mb-1 text-xs font-semibold text-[var(--color-primary)]">AI 팀장</p>
              <div
                class="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-muted)]"
              >
                <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-muted)]" style="animation-delay: 0ms" />
                <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-muted)]" style="animation-delay: 150ms" />
                <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-muted)]" style="animation-delay: 300ms" />
              </div>
            </div>
          </div>
        </Transition>

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

<style scoped>
.ai-markdown :deep(h1),
.ai-markdown :deep(h2),
.ai-markdown :deep(h3),
.ai-markdown :deep(h4) {
  font-weight: 700;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
}
.ai-markdown :deep(h1) { font-size: 1.125rem; }
.ai-markdown :deep(h2) { font-size: 1rem; }
.ai-markdown :deep(h3) { font-size: 0.9375rem; }

.ai-markdown :deep(p) {
  margin-bottom: 0.5rem;
}
.ai-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
}
.ai-markdown :deep(ul) { list-style-type: disc; }
.ai-markdown :deep(ol) { list-style-type: decimal; }
.ai-markdown :deep(li) { margin-bottom: 0.125rem; }

.ai-markdown :deep(code) {
  background-color: rgba(0, 0, 0, 0.06);
  border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-size: 0.85em;
  font-family: ui-monospace, monospace;
}
.ai-markdown :deep(pre) {
  background-color: rgba(0, 0, 0, 0.06);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin-bottom: 0.5rem;
}
.ai-markdown :deep(pre code) {
  background: none;
  padding: 0;
}

.ai-markdown :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 0.75rem;
  color: var(--color-muted);
  margin-bottom: 0.5rem;
}

.ai-markdown :deep(strong) { font-weight: 700; }
.ai-markdown :deep(em) { font-style: italic; }

.ai-markdown :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-line);
  margin: 0.75rem 0;
}
</style>
