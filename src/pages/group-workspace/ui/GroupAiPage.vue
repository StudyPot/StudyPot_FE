<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { inject, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  decideAiConversationMessageAction,
  listAiConversationMessages,
  openAiConversation,
  sendAiConversationMessage,
  subscribeToAiConversationStream,
  type AiConversation,
  type AiConversationMessage,
  type AiMessageActionDecision,
} from '@/entities/ai'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupAiPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext
const route = useRoute()

type PageState = 'opening' | 'chat' | 'error'

const pageState = ref<PageState>('opening')
const openError = ref('')
const conversation = ref<AiConversation | null>(null)
const messages = ref<AiConversationMessage[]>([])
const inputText = ref('')
const isSending = ref(false)
const sendError = ref('')
const messagesEndRef = ref<HTMLElement | null>(null)
const messagesContainerRef = ref<HTMLElement | null>(null)
const eventSource = ref<EventSource | null>(null)
const isSseActive = ref(false)
const actionBusy = ref<Record<string, boolean>>({})

function subscribeToStream(conversationId: string): void {
  closeStream()
  const es = subscribeToAiConversationStream(conversationId)

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
    const retrospectiveId =
      typeof route.query.retrospectiveId === 'string' ? route.query.retrospectiveId : undefined
    const weekId = typeof route.query.weekId === 'string' ? route.query.weekId : undefined
    conversation.value = await openAiConversation(
      groupId.value,
      retrospectiveId
        ? { conversationType: 'RETROSPECTIVE', retrospectiveId, weekId }
        : { conversationType: 'TEAM_LEAD_CHAT' },
    )
    try {
      const allMessages: AiConversationMessage[] = []
      let cursor: string | undefined = undefined
      let hasNext = true
      while (hasNext) {
        const page = await listAiConversationMessages(conversation.value.id, { cursor })
        allMessages.push(...page.items)
        hasNext = page.pageInfo.hasNext
        cursor = page.pageInfo.nextCursor ?? undefined
      }
      messages.value = allMessages
    } catch {
      // 히스토리 로드 실패 시 빈 상태로 시작
    }
    subscribeToStream(conversation.value.id)
    pageState.value = 'chat'
    await scrollToBottom()
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      openError.value = '스터디가 시작된 후에 AI 팀장과 대화할 수 있어요.'
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
    addUniqueMessage(assistantMessage)
    await scrollToBottom()
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      sendError.value = '메시지를 전송할 권한이 없어요.'
    } else {
      sendError.value = error instanceof ApiError ? error.message : '메시지를 전송하지 못했어요.'
    }
  } finally {
    isSending.value = false
  }
}

async function handleDecideAction(
  message: AiConversationMessage,
  decision: AiMessageActionDecision,
): Promise<void> {
  if (!conversation.value || actionBusy.value[message.id]) {
    return
  }
  actionBusy.value = { ...actionBusy.value, [message.id]: true }
  sendError.value = ''

  try {
    const updated = await decideAiConversationMessageAction(
      conversation.value.id,
      message.id,
      decision,
    )
    const index = messages.value.findIndex((m) => m.id === message.id)
    if (index !== -1) {
      messages.value[index] = updated
    }
    await scrollToBottom()
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      sendError.value = '이 작업을 수행할 권한이 없어요.'
    } else if (error instanceof ApiError && error.status === 409) {
      sendError.value = '이미 처리된 제안이에요.'
    } else {
      sendError.value = error instanceof ApiError ? error.message : '요청을 처리하지 못했어요.'
    }
  } finally {
    const next = { ...actionBusy.value }
    delete next[message.id]
    actionBusy.value = next
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }
  // IME 조합 중 Enter 는 전송하지 않는다(한 글자 잘림/잔류 방지).
  if (event.isComposing || event.keyCode === 229) {
    return
  }
  event.preventDefault()
  void handleSendMessage()
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const container = messagesContainerRef.value
  if (container) container.scrollTop = container.scrollHeight
}

onUnmounted(() => {
  closeStream()
})

onMounted(() => {
  void handleOpenConversation()
})

const INTERNAL_FIELDS = ['observedDbEvidence', 'recommendedNextAction']

function stripInternalFields(content: string): string {
  const trimmed = content.trim()

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      INTERNAL_FIELDS.forEach((key) => delete parsed[key])
      const remaining = Object.values(parsed)
        .filter((v) => typeof v === 'string')
        .join('\n\n')
      return remaining || trimmed
    } catch {
      // JSON 파싱 실패 시 아래 regex 방식으로 폴백
    }
  }

  return INTERNAL_FIELDS.reduce((text, field) => {
    return text.replace(new RegExp(`"${field}"\\s*:\\s*(?:"[^"]*"|\\{[^}]*\\}),?\\s*`, 'g'), '')
  }, content)
}

function renderMarkdown(content: string): string {
  const html = marked.parse(stripInternalFields(content), { async: false }) as string
  return DOMPurify.sanitize(html)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- opening -->
    <ScreenState
      v-if="pageState === 'opening'"
      variant="loading"
      title="대화를 불러오는 중입니다."
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
    <template v-else-if="pageState === 'chat'">
      <!-- 메시지 목록 -->
      <div
        ref="messagesContainerRef"
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2"
      >
        <div v-if="messages.length === 0" class="mt-10 text-center">
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 15l-1.6-5L6 8.4l4.4-1.6L12 2z" />
            </svg>
          </div>
          <p class="mt-3 text-sm text-[var(--color-muted)]">
            무엇이든 물어보세요. AI 팀장이 도와드릴게요.
          </p>
        </div>

        <template v-for="message in messages" :key="message.id">
          <!-- USER (우측 그린 버블) -->
          <div v-if="message.senderType === 'USER'" class="flex justify-end">
            <p
              class="max-w-[78%] rounded-2xl rounded-tr-md bg-[var(--color-primary)] px-4 py-2.5 text-sm leading-6 text-white"
            >
              {{ message.content }}
            </p>
          </div>

          <!-- ASSISTANT (좌측 아바타 + 흰 버블) -->
          <div v-else-if="message.senderType === 'ASSISTANT'" class="flex items-start gap-2.5">
            <span
              class="mt-0.5 flex h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-[var(--color-primary)]"
              aria-hidden="true"
            >
              <img src="/AIbot.png" alt="" class="h-full w-full object-cover" />
            </span>
            <div class="flex max-w-[78%] flex-col gap-2">
              <div
                class="ai-markdown rounded-2xl rounded-tl-none bg-[var(--color-surface)] px-4 py-2.5 text-sm leading-6 text-[var(--color-ink)] shadow-[var(--shadow-soft)]"
                v-html="renderMarkdown(message.content)"
              />

              <!-- 제안 액션: 질문 게시판 공유 (확인 후 실행) -->
              <div
                v-if="message.action?.type === 'SHARE_QUESTION' && message.action.status === 'PENDING'"
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p class="text-xs font-medium text-[var(--color-muted)]">
                  이 질문을 ‘질문’ 게시판에 올릴까요?
                </p>
                <p
                  v-if="message.action.title"
                  class="text-sm font-semibold text-[var(--color-ink)]"
                >
                  {{ message.action.title }}
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'CONFIRM')"
                  >
                    올리기
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'REJECT')"
                  >
                    올리지 않기
                  </button>
                </div>
              </div>

              <p
                v-else-if="message.action?.type === 'SHARE_QUESTION' && message.action.status === 'EXECUTED'"
                class="text-xs font-medium text-[var(--color-primary)]"
              >
                ✅ 질문 게시판에 올렸어요.
              </p>
            </div>
          </div>
        </template>

        <!-- 전송 중 -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="
              isSending &&
              messages.length > 0 &&
              messages[messages.length - 1]?.senderType === 'USER'
            "
            class="flex items-start gap-2.5"
          >
            <span
              class="mt-0.5 flex h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-[var(--color-primary)]"
              aria-hidden="true"
            >
              <img src="/AIbot.png" alt="" class="h-full w-full object-cover" />
            </span>
            <div
              class="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]"
            >
              <span
                class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-muted)]"
                style="animation-delay: 0ms"
              />
              <span
                class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-muted)]"
                style="animation-delay: 150ms"
              />
              <span
                class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-muted)]"
                style="animation-delay: 300ms"
              />
            </div>
          </div>
        </Transition>

        <div ref="messagesEndRef" aria-hidden="true" />
      </div>

      <p
        v-if="sendError"
        role="alert"
        class="px-1 pb-2 text-sm font-semibold text-[var(--color-danger)]"
      >
        {{ sendError }}
      </p>

      <!-- 입력창 -->
      <div class="flex items-end gap-2 pt-2">
        <textarea
          v-model="inputText"
          rows="1"
          placeholder="AI 팀장에게 물어보기..."
          :disabled="isSending"
          class="max-h-32 min-h-[48px] flex-1 resize-none rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-6 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-50"
          @keydown="handleKeydown"
        />
        <button
          type="button"
          :disabled="isSending || !inputText.trim()"
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
          aria-label="전송"
          @click="handleSendMessage"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </template>
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
.ai-markdown :deep(h1) {
  font-size: 1.125rem;
}
.ai-markdown :deep(h2) {
  font-size: 1rem;
}
.ai-markdown :deep(h3) {
  font-size: 0.9375rem;
}

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
.ai-markdown :deep(ul) {
  list-style-type: disc;
}
.ai-markdown :deep(ol) {
  list-style-type: decimal;
}
.ai-markdown :deep(li) {
  margin-bottom: 0.125rem;
}

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

.ai-markdown :deep(strong) {
  font-weight: 700;
}
.ai-markdown :deep(em) {
  font-style: italic;
}

.ai-markdown :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-line);
  margin: 0.75rem 0;
}
</style>
