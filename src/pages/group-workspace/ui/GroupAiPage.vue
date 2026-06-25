<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { inject, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
const router = useRouter()

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
const sharedPostId = ref<string | null>(null)
const showShareDoneModal = ref(false)
const customMessageId = ref<string | null>(null)
const customText = ref('')
// 비동기(MQ) 모드 안전장치: assistant 응답은 SSE 로 도착한다. SSE 가 끊겼거나 이벤트가 유실돼도
// 멈추지 않도록, 일정 시간(OpenAI 최대 응답시간 고려) 후 메시지를 재조회하고 입력중 표시를 해제한다.
const ASSISTANT_WAIT_TIMEOUT_MS = 130000
let assistantWaitTimer: ReturnType<typeof setTimeout> | null = null

// SSE 자동 재연결(백오프). 탭 백그라운드 등으로 끊겨도 영구 중단하지 않고 다시 붙는다.
const SSE_RECONNECT_INITIAL_DELAY_MS = 1000
const SSE_RECONNECT_MAX_DELAY_MS = 15000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
let shouldReconnect = false
let activeConversationId: string | null = null

function subscribeToStream(conversationId: string): void {
  closeStream()
  shouldReconnect = true
  activeConversationId = conversationId
  connectStream(conversationId)
}

function connectStream(conversationId: string): void {
  const es = subscribeToAiConversationStream(conversationId)

  es.addEventListener('connected', () => {
    isSseActive.value = true
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
    // 재연결 직후: 끊겨 있는 동안 도착했을 수 있는 응답을 맞춘다.
    if (isSending.value) void syncPendingAssistant()
  })

  es.addEventListener('assistant-message-created', (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data as string) as AiConversationMessage
      addUniqueMessage(message)
      void scrollToBottom()
    } catch {
      // JSON 파싱 실패 시 무시
    }
    clearAssistantWait()
    isSending.value = false
  })

  es.addEventListener('assistant-generation-failed', () => {
    if (isSending.value) {
      sendError.value = 'AI 응답 생성에 실패했습니다.'
      isSending.value = false
    }
    clearAssistantWait()
  })

  es.onerror = () => {
    if (eventSource.value !== es) return
    isSseActive.value = false
    es.close()
    eventSource.value = null
    // 탭 백그라운드 등으로 끊겨도 영구 중단하지 않고 백오프로 다시 붙는다.
    scheduleReconnect()
  }

  eventSource.value = es
}

function scheduleReconnect(): void {
  if (!shouldReconnect || reconnectTimer || !activeConversationId) {
    return
  }
  const delayMs = reconnectDelayMs
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, SSE_RECONNECT_MAX_DELAY_MS)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!shouldReconnect || eventSource.value || !activeConversationId) {
      return
    }
    connectStream(activeConversationId)
  }, delayMs)
}

function closeStream(): void {
  shouldReconnect = false
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
  eventSource.value?.close()
  eventSource.value = null
  isSseActive.value = false
}

function addUniqueMessage(message: AiConversationMessage): void {
  if (!messages.value.some((m) => m.id === message.id)) {
    messages.value.push(message)
  }
}

function clearAssistantWait(): void {
  if (assistantWaitTimer) {
    clearTimeout(assistantWaitTimer)
    assistantWaitTimer = null
  }
}

// SSE 로 assistant 응답이 끝내 도착하지 않을 때를 대비한 폴백: 메시지를 서버에서 다시 불러와 동기화한다.
async function reloadMessages(): Promise<void> {
  if (!conversation.value) {
    return
  }
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
    void scrollToBottom()
  } catch {
    // 재조회 실패 시 조용히 무시
  }
}

function lastMessageIsAssistant(): boolean {
  const last = messages.value[messages.value.length - 1]
  return last?.senderType === 'ASSISTANT'
}

// 대기 중(isSending)일 때 서버 메시지를 다시 맞추고, 응답이 이미 와 있으면 입력중 표시를 해제한다.
async function syncPendingAssistant(): Promise<void> {
  await reloadMessages()
  if (isSending.value && lastMessageIsAssistant()) {
    clearAssistantWait()
    isSending.value = false
  }
}

function startAssistantWait(): void {
  clearAssistantWait()
  assistantWaitTimer = setTimeout(() => {
    assistantWaitTimer = null
    if (!isSending.value) {
      return
    }
    void reloadMessages().finally(() => {
      // 재조회 후에도 응답이 없으면 '로딩'이 아니라 실패임을 분명히 알린다.
      if (!lastMessageIsAssistant()) {
        sendError.value = 'AI 응답이 도착하지 않았어요. 잠시 후 다시 시도해 주세요.'
      }
      isSending.value = false
    })
  }, ASSISTANT_WAIT_TIMEOUT_MS)
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
    const returned = await sendAiConversationMessage(conversation.value.id, { content })
    if (returned.senderType === 'ASSISTANT') {
      // 동기 모드: 응답(assistant)이 바로 도착한다.
      addUniqueMessage(returned)
      isSending.value = false
    } else {
      // 비동기(MQ) 모드: 반환값은 저장된 사용자 메시지이고, assistant 는 SSE(assistant-message-created)로 도착한다.
      // optimistic 사용자 말풍선을 유지하고 입력중 표시를 유지한 채 SSE 를 기다린다(끊김 대비 폴백 타이머 가동).
      startAssistantWait()
    }
    await scrollToBottom()
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      sendError.value = '메시지를 전송할 권한이 없어요.'
    } else {
      sendError.value = error instanceof ApiError ? error.message : '메시지를 전송하지 못했어요.'
    }
    isSending.value = false
  }
}

function openCustomShare(message: AiConversationMessage): void {
  customMessageId.value = message.id
  customText.value = ''
}

function cancelCustomShare(): void {
  customMessageId.value = null
  customText.value = ''
}

async function submitCustomShare(message: AiConversationMessage): Promise<void> {
  const instruction = customText.value.trim()
  if (!instruction) {
    return
  }
  await handleDecideAction(message, 'CONFIRM', instruction)
  cancelCustomShare()
}

async function handleDecideAction(
  message: AiConversationMessage,
  decision: AiMessageActionDecision,
  instruction?: string,
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
      instruction,
    )
    const index = messages.value.findIndex((m) => m.id === message.id)
    if (index !== -1) {
      messages.value[index] = updated
    }
    if (
      decision === 'CONFIRM' &&
      updated.action?.type === 'SHARE_QUESTION' &&
      updated.action.status === 'EXECUTED'
    ) {
      sharedPostId.value = updated.action.postId ?? null
      showShareDoneModal.value = true
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

function navigateToPost(postId: string | null): void {
  void router.push({
    name: 'group-board',
    params: { groupId: groupId.value },
    query: postId ? { postId } : {},
  })
}

function goToSharedPost(): void {
  showShareDoneModal.value = false
  navigateToPost(sharedPostId.value)
}

function keepChatting(): void {
  showShareDoneModal.value = false
  sharedPostId.value = null
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

function handleVisibilityChange(): void {
  if (document.visibilityState !== 'visible') {
    return
  }
  if (pageState.value !== 'chat' || !activeConversationId) {
    return
  }
  // 탭 복귀: 끊겨 있던 SSE를 즉시 되살리고, 대기 중이면 그새 도착한 응답을 맞춘다.
  if (!isSseActive.value && !eventSource.value) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectDelayMs = SSE_RECONNECT_INITIAL_DELAY_MS
    shouldReconnect = true
    connectStream(activeConversationId)
  }
  if (isSending.value) {
    void syncPendingAssistant()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void handleOpenConversation()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  closeStream()
  clearAssistantWait()
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

// ── 채팅 타임라인(날짜 구분선 + 메시지 시간) ──────────────────────
function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatChatDate(iso: string): string {
  const d = new Date(iso)
  if (dateKey(iso) === dateKey(new Date().toISOString())) return '오늘'
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function showDateDivider(index: number): boolean {
  const cur = messages.value[index]
  if (!cur) return false
  if (index === 0) return true
  const prev = messages.value[index - 1]
  return !prev || dateKey(prev.createdAt) !== dateKey(cur.createdAt)
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
          <div class="mx-auto h-12 w-12">
            <img src="/AIbot.png" alt="AI 팀장" class="h-12 w-12 rounded-xl object-cover" />
          </div>
          <p class="mt-3 text-sm text-[var(--color-muted)]">
            무엇이든 물어보세요. AI 팀장이 도와드릴게요.
          </p>
        </div>

        <template v-for="(message, mi) in messages" :key="message.id">
          <!-- 날짜 구분선 (타임라인) -->
          <div v-if="showDateDivider(mi)" class="my-1 flex items-center justify-center">
            <span
              class="rounded-full bg-[var(--color-active)] px-3 py-1 text-xs font-bold text-[var(--color-muted)]"
            >
              {{ formatChatDate(message.createdAt) }}
            </span>
          </div>

          <!-- USER (우측 그린 버블) -->
          <div v-if="message.senderType === 'USER'" class="flex flex-col items-end mr-3">
            <p
              class="max-w-[78%] rounded-2xl rounded-tr-md bg-[var(--color-primary)] px-4 py-2.5 text-sm leading-6 text-white"
            >
              {{ message.content }}
            </p>
            <span class="mt-1 text-[11px] text-[var(--color-faint)]">{{ formatChatTime(message.createdAt) }}</span>
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
              <span class="text-[11px] text-[var(--color-faint)]">{{ formatChatTime(message.createdAt) }}</span>

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
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'CONFIRM')"
                  >
                    {{ actionBusy[message.id] ? '올리는 중…' : '올리기' }}
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'REJECT')"
                  >
                    올리지 않기
                  </button>

                  <!-- '기타': 닫혀 있으면 버튼, 열려 있으면 인라인 한 줄 입력 + 전송 -->
                  <button
                    v-if="customMessageId !== message.id"
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="openCustomShare(message)"
                  >
                    기타
                  </button>
                  <template v-else>
                    <input
                      v-model="customText"
                      type="text"
                      placeholder="원하는 방식 (예: 더 짧게)"
                      :disabled="actionBusy[message.id]"
                      class="h-8 min-w-[120px] flex-1 rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-50"
                      @keydown.enter.prevent="submitCustomShare(message)"
                    />
                    <button
                      type="button"
                      :disabled="actionBusy[message.id] || !customText.trim()"
                      class="shrink-0 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
                      @click="submitCustomShare(message)"
                    >
                      {{ actionBusy[message.id] ? '올리는 중…' : '전송' }}
                    </button>
                    <button
                      type="button"
                      :disabled="actionBusy[message.id]"
                      aria-label="취소"
                      class="shrink-0 rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] disabled:opacity-40"
                      @click="cancelCustomShare"
                    >
                      ✕
                    </button>
                  </template>
                </div>
              </div>

              <p
                v-else-if="message.action?.type === 'SHARE_QUESTION' && message.action.status === 'EXECUTED'"
                class="text-xs font-medium text-[var(--color-primary)]"
              >
                ✅ 질문 게시판에 올렸어요.
              </p>

              <!-- 기존 유사 게시물 안내 -->
              <div
                v-else-if="message.action?.type === 'SHOW_EXISTING_POST'"
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p class="text-xs font-medium text-[var(--color-muted)]">
                  이 질문은 게시판에 비슷한 글이 이미 있어요.
                </p>
                <p
                  v-if="message.action.title"
                  class="text-sm font-semibold text-[var(--color-ink)]"
                >
                  {{ message.action.title }}
                </p>
                <div>
                  <button
                    type="button"
                    class="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)]"
                    @click="navigateToPost(message.action.postId ?? null)"
                  >
                    게시물 보러가기
                  </button>
                </div>
              </div>

              <!-- 과제 완료/미완료 처리 (확인 후 실행) -->
              <div
                v-else-if="message.action?.type === 'COMPLETE_TASK' && message.action.status === 'PENDING'"
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p class="text-xs font-medium text-[var(--color-muted)]">
                  이 과제를 {{ message.action.completionStatus === 'DONE' ? '완료' : '미완료' }}로 처리할까요?
                </p>
                <p
                  v-if="message.action.title"
                  class="text-sm font-semibold text-[var(--color-ink)]"
                >
                  {{ message.action.title }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'CONFIRM')"
                  >
                    {{ actionBusy[message.id] ? '처리 중…' : (message.action.completionStatus === 'DONE' ? '완료 처리' : '미완료 처리') }}
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'REJECT')"
                  >
                    아니요
                  </button>
                </div>
              </div>

              <p
                v-else-if="message.action?.type === 'COMPLETE_TASK' && message.action.status === 'EXECUTED'"
                class="text-xs font-medium text-[var(--color-primary)]"
              >
                ✅ 과제를 {{ message.action.completionStatus === 'DONE' ? '완료' : '미완료' }}로 처리했어요.
              </p>

              <!-- 과제 추가 (그룹장, 확인 후 실행) -->
              <div
                v-else-if="message.action?.type === 'ADD_TASK' && message.action.status === 'PENDING'"
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p class="text-xs font-medium text-[var(--color-muted)]">
                  이 과제를 이번 주에 추가할까요?
                </p>
                <p
                  v-if="message.action.title"
                  class="text-sm font-semibold text-[var(--color-ink)]"
                >
                  {{ message.action.title }}
                </p>
                <p v-if="message.action.summary" class="text-xs text-[var(--color-muted)]">
                  {{ message.action.summary }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'CONFIRM')"
                  >
                    {{ actionBusy[message.id] ? '추가 중…' : '추가하기' }}
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'REJECT')"
                  >
                    아니요
                  </button>
                </div>
              </div>

              <p
                v-else-if="message.action?.type === 'ADD_TASK' && message.action.status === 'EXECUTED'"
                class="text-xs font-medium text-[var(--color-primary)]"
              >
                ✅ 이번 주 과제에 추가했어요.
              </p>

              <!-- 게시글 수정 (확인 후 실행) -->
              <div
                v-else-if="message.action?.type === 'EDIT_POST' && message.action.status === 'PENDING'"
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p class="text-xs font-medium text-[var(--color-muted)]">이 게시글을 이렇게 수정할까요?</p>
                <p v-if="message.action.title" class="text-sm font-semibold text-[var(--color-ink)]">
                  {{ message.action.title }}
                </p>
                <p v-if="message.action.summary" class="line-clamp-4 whitespace-pre-line text-xs text-[var(--color-muted)]">
                  {{ message.action.summary }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'CONFIRM')"
                  >
                    {{ actionBusy[message.id] ? '수정 중…' : '수정하기' }}
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'REJECT')"
                  >
                    아니요
                  </button>
                </div>
              </div>

              <p
                v-else-if="message.action?.type === 'EDIT_POST' && message.action.status === 'EXECUTED'"
                class="text-xs font-medium text-[var(--color-primary)]"
              >
                ✅ 게시글을 수정했어요.
              </p>

              <!-- 게시글 삭제 (확인 후 실행) -->
              <div
                v-else-if="message.action?.type === 'DELETE_POST' && message.action.status === 'PENDING'"
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p class="text-xs font-medium text-[var(--color-muted)]">이 게시글을 삭제할까요?</p>
                <p v-if="message.action.title" class="text-sm font-semibold text-[var(--color-ink)]">
                  {{ message.action.title }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] bg-[var(--color-danger)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[rgba(255,82,71,0.2)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'CONFIRM')"
                  >
                    {{ actionBusy[message.id] ? '삭제 중…' : '삭제하기' }}
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy[message.id]"
                    class="rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)] disabled:opacity-40"
                    @click="handleDecideAction(message, 'REJECT')"
                  >
                    아니요
                  </button>
                </div>
              </div>

              <p
                v-else-if="message.action?.type === 'DELETE_POST' && message.action.status === 'EXECUTED'"
                class="text-xs font-medium text-[var(--color-primary)]"
              >
                ✅ 게시글을 삭제했어요.
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

    <!-- 질문 게시판 공유 완료 모달 -->
    <div
      v-if="showShareDoneModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      @click.self="keepChatting"
    >
      <div class="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
          aria-hidden="true"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p class="text-base font-bold text-[var(--color-ink)]">질문 게시판에 올렸어요</p>
        <p class="mt-1 text-sm text-[var(--color-muted)]">다른 멤버들도 이 질문과 답변을 볼 수 있어요.</p>
        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            class="w-full rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)]"
            @click="goToSharedPost"
          >
            게시판으로 가기
          </button>
          <button
            type="button"
            class="w-full rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-bg)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.14)]"
            @click="keepChatting"
          >
            AI 팀장과 더 대화하기
          </button>
        </div>
      </div>
    </div>
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
