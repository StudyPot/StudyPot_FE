<script setup lang="ts">
import { inject, onMounted, ref, computed } from 'vue'

import {
  listBoards,
  listBoardPosts,
  getBoardPost,
  createBoardPost,
  listPostComments,
  createPostComment,
} from '@/entities/board/api/boardApi'
import type { GroupBoard, BoardPostSummary, BoardPost, BoardComment } from '@/entities/board/model/types'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupBoardPage must be inside GroupWorkspacePage.')

const { groupId } = workspaceContext

type ViewMode = 'list' | 'detail' | 'create'

const viewMode = ref<ViewMode>('list')
const isLoadingBoards = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const boards = ref<GroupBoard[]>([])
const selectedBoard = ref<GroupBoard | null>(null)
const posts = ref<BoardPostSummary[]>([])
const selectedPost = ref<BoardPost | null>(null)
const comments = ref<BoardComment[]>([])
const isLoadingComments = ref(false)
const newCommentText = ref('')
const isSubmittingComment = ref(false)

const newPostForm = ref({ title: '', content: '', pinned: false })
const isCreating = ref(false)
const createError = ref('')

const previewContent = ref('')
const markdownPreviewHtml = computed(() => renderMarkdown(previewContent.value))

function syncPreview(event: Event): void {
  previewContent.value = (event.target as HTMLTextAreaElement).value
}

onMounted(() => {
  void loadBoards()
})

async function loadBoards(): Promise<void> {
  isLoadingBoards.value = true
  errorMessage.value = ''
  try {
    boards.value = await listBoards(groupId.value)
    if (boards.value.length > 0) {
      selectedBoard.value = boards.value.find((b) => b.defaultBoard) ?? boards.value[0] ?? null
      await loadPosts()
    }
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '게시판을 불러오지 못했습니다.'
  } finally {
    isLoadingBoards.value = false
  }
}

async function selectBoard(board: GroupBoard): Promise<void> {
  selectedBoard.value = board
  viewMode.value = 'list'
  await loadPosts()
}

async function loadPosts(): Promise<void> {
  if (!selectedBoard.value) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const result = await listBoardPosts(groupId.value, selectedBoard.value.id)
    posts.value = result.items
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '게시글을 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

async function openPost(summary: BoardPostSummary): Promise<void> {
  viewMode.value = 'detail'
  selectedPost.value = null
  comments.value = []
  isLoadingComments.value = true
  try {
    const [post, commentPage] = await Promise.all([
      getBoardPost(groupId.value, summary.id),
      listPostComments(groupId.value, summary.id),
    ])
    selectedPost.value = post
    comments.value = commentPage.items
  } catch {
    // ignore
  } finally {
    isLoadingComments.value = false
  }
}

async function submitComment(): Promise<void> {
  if (!selectedPost.value || !newCommentText.value.trim()) return
  isSubmittingComment.value = true
  try {
    const comment = await createPostComment(
      groupId.value,
      selectedPost.value.id,
      newCommentText.value.trim(),
    )
    comments.value.push(comment)
    newCommentText.value = ''
  } catch {
    // ignore
  } finally {
    isSubmittingComment.value = false
  }
}

async function submitNewPost(): Promise<void> {
  if (!selectedBoard.value) return
  if (!newPostForm.value.title.trim() || !newPostForm.value.content.trim()) {
    createError.value = '제목과 내용을 입력해주세요.'
    return
  }
  isCreating.value = true
  createError.value = ''
  try {
    await createBoardPost(groupId.value, selectedBoard.value.id, {
      title: newPostForm.value.title.trim(),
      content: newPostForm.value.content.trim(),
      pinned: newPostForm.value.pinned || undefined,
    })
    newPostForm.value = { title: '', content: '', pinned: false }
    previewContent.value = ''
    await loadPosts()
    viewMode.value = 'list'
  } catch (error) {
    createError.value = error instanceof ApiError ? error.message : '게시글 작성에 실패했습니다.'
  } finally {
    isCreating.value = false
  }
}

function renderMarkdown(markdown: string): string {
  const source = markdown.replace(/\r\n?/g, '\n').trim()
  if (!source) return ''

  const lines = source.split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[index] ?? '')
        index += 1
      }

      if (index < lines.length) index += 1
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      const headingMarker = headingMatch[1] ?? ''
      const headingText = headingMatch[2] ?? ''
      const level = headingMarker.length
      blocks.push(`<h${level}>${renderInline(headingText)}</h${level}>`)
      index += 1
      continue
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push('<hr>')
      index += 1
      continue
    }

    if (isTableStart(lines, index)) {
      const table = renderTable(lines, index)
      blocks.push(table.html)
      index = table.nextIndex
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = []

      while (index < lines.length) {
        const quoteMatch = /^>\s?(.*)$/.exec(lines[index] ?? '')
        if (!quoteMatch) break
        quoteLines.push(quoteMatch[1] ?? '')
        index += 1
      }

      blocks.push(`<blockquote>${renderMarkdown(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const list = renderList(lines, index, false)
      blocks.push(list.html)
      index = list.nextIndex
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const list = renderList(lines, index, true)
      blocks.push(list.html)
      index = list.nextIndex
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length && (lines[index] ?? '').trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index] ?? '')
      index += 1
    }

    blocks.push(`<p>${renderInline(paragraphLines.join('\n'))}</p>`)
  }

  return blocks.join('\n')
}

function renderList(
  lines: string[],
  startIndex: number,
  ordered: boolean,
): { html: string; nextIndex: number } {
  const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*]\s+(.+)$/
  const items: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const match = pattern.exec(lines[index] ?? '')
    if (!match) break
    items.push(`<li>${renderInline(match[1] ?? '')}</li>`)
    index += 1
  }

  const tag = ordered ? 'ol' : 'ul'
  return { html: `<${tag}>${items.join('')}</${tag}>`, nextIndex: index }
}

function renderTable(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const headers = splitTableRow(lines[startIndex] ?? '')
  const rows: string[][] = []
  let index = startIndex + 2

  while (
    index < lines.length &&
    (lines[index] ?? '').includes('|') &&
    (lines[index] ?? '').trim()
  ) {
    rows.push(splitTableRow(lines[index] ?? ''))
    index += 1
  }

  const headerHtml = headers.map((header) => `<th>${renderInline(header)}</th>`).join('')
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${headers.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] ?? '')}</td>`).join('')}</tr>`,
    )
    .join('')

  return {
    html: `<div class="markdown-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
    nextIndex: index,
  }
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? ''
  const trimmed = line.trim()

  return (
    trimmed.startsWith('```') ||
    /^(#{1,4})\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^(-{3,}|\*{3,})$/.test(trimmed) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    isTableStart(lines, index)
  )
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index] ?? ''
  const divider = lines[index + 1] ?? ''
  return header.includes('|') && isTableDivider(divider)
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderInline(text: string): string {
  const placeholders: string[] = []
  const stashHtml = (html: string) => {
    const token = `@@MARKDOWN_HTML_${placeholders.length}@@`
    placeholders.push(html)
    return token
  }

  let prepared = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    return stashHtml(`<code>${escapeHtml(code)}</code>`)
  })

  prepared = prepared.replace(
    /\[([^\]\n]+)]\(([^)\s]+)\)/g,
    (match, label: string, url: string) => {
      const safeUrl = getSafeUrl(url)
      if (!safeUrl) return match

      return stashHtml(
        `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer noopener">${renderInlineText(label)}</a>`,
      )
    },
  )

  let html = renderInlineText(prepared)
  placeholders.forEach((placeholder, placeholderIndex) => {
    html = html.split(`@@MARKDOWN_HTML_${placeholderIndex}@@`).join(placeholder)
  })

  return html.replace(/\n/g, '<br>')
}

function renderInlineText(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
}

function getSafeUrl(rawUrl: string): string {
  const url = rawUrl.trim()
  if (/^(https?:\/\/|mailto:)/i.test(url) || url.startsWith('/') || url.startsWith('#')) {
    return url
  }
  return ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <div class="grid gap-5">
    <!-- 게시판 탭 -->
    <div
      v-if="boards.length > 0"
      class="flex flex-wrap gap-1 rounded-lg border border-[var(--color-line)] bg-white/85 px-4 py-2 shadow-[var(--shadow-soft)]"
    >
      <button
        v-for="board in boards"
        :key="board.id"
        type="button"
        :class="[
          'rounded-md px-3 py-1.5 text-xs font-semibold transition focus:outline-none',
          selectedBoard?.id === board.id
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-ink)]',
        ]"
        @click="selectBoard(board)"
      >
        {{ board.name }}
      </button>
    </div>

    <!-- 목록 -->
    <template v-if="viewMode === 'list'">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-white/85 shadow-[var(--shadow-soft)]"
      >
        <div
          class="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4"
        >
          <div>
            <p class="text-sm font-semibold text-[var(--color-primary)]">게시판</p>
            <h2 class="mt-1 text-lg font-bold text-[var(--color-ink)]">
              {{ selectedBoard?.name ?? '그룹 게시판' }}
            </h2>
          </div>
          <button
            v-if="selectedBoard"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
            @click="viewMode = 'create'"
          >
            글 쓰기
          </button>
        </div>

        <ScreenState
          v-if="isLoadingBoards || isLoading"
          variant="loading"
          title="게시글을 불러오는 중입니다."
          class="p-8"
        />
        <ScreenState
          v-else-if="errorMessage"
          variant="error"
          :title="errorMessage"
          action-label="다시 시도"
          @action="loadBoards"
          class="p-8"
        />

        <ul v-else-if="posts.length > 0" class="divide-y divide-[var(--color-line)]">
          <li
            v-for="post in posts"
            :key="post.id"
            class="flex cursor-pointer items-start gap-3 px-5 py-4 transition hover:bg-[var(--color-card)]"
            @click="openPost(post)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span v-if="post.pinned" class="text-sm">📌</span>
                <span class="font-semibold text-[var(--color-ink)]">{{ post.title }}</span>
              </div>
              <div class="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
                <span>{{ post.author.displayName }}</span>
                <span>{{ formatDate(post.createdAt) }}</span>
                <span v-if="post.commentCount > 0">댓글 {{ post.commentCount }}</span>
              </div>
              <p class="mt-1 truncate text-xs text-[var(--color-muted)]">{{ post.contentPreview }}</p>
            </div>
          </li>
        </ul>

        <p v-else class="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
          게시글이 없습니다.
        </p>
      </section>
    </template>

    <!-- 상세 -->
    <template v-else-if="viewMode === 'detail'">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-white/85 shadow-[var(--shadow-soft)]"
      >
        <div class="border-b border-[var(--color-line)] px-5 py-4">
          <button
            type="button"
            class="mb-3 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
            @click="viewMode = 'list'"
          >
            ← 목록으로
          </button>
          <ScreenState
            v-if="!selectedPost && isLoadingComments"
            variant="loading"
            title="게시글을 불러오는 중입니다."
            class="py-4"
          />
          <template v-else-if="selectedPost">
            <div class="flex flex-wrap items-center gap-2">
              <span v-if="selectedPost.pinned" class="text-sm">📌</span>
            </div>
            <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">{{ selectedPost.title }}</h2>
            <p class="mt-1 text-xs text-[var(--color-muted)]">
              {{ selectedPost.author.displayName }} · {{ formatDate(selectedPost.createdAt) }}
            </p>
          </template>
        </div>

        <div v-if="selectedPost" class="px-5 py-4">
          <article class="markdown-body" v-html="renderMarkdown(selectedPost.content)" />
        </div>

        <!-- 댓글 -->
        <div v-if="selectedPost" class="border-t border-[var(--color-line)] px-5 py-4">
          <h3 class="text-sm font-bold text-[var(--color-ink)]">댓글 {{ comments.length }}</h3>

          <ScreenState v-if="isLoadingComments" variant="loading" title="댓글을 불러오는 중…" />

          <ul v-else-if="comments.length > 0" class="mt-3 grid gap-3">
            <li
              v-for="comment in comments"
              :key="comment.id"
              class="rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
            >
              <p class="font-semibold text-[var(--color-ink)]">
                {{ comment.author.displayName }}
                <span class="ml-2 text-xs font-normal text-[var(--color-muted)]">{{
                  formatDate(comment.createdAt)
                }}</span>
              </p>
              <p class="mt-1 leading-6 text-[var(--color-muted)]">{{ comment.content }}</p>
            </li>
          </ul>

          <p v-else class="mt-3 text-sm text-[var(--color-muted)]">첫 댓글을 남겨보세요.</p>

          <div class="mt-4 flex gap-2">
            <textarea
              v-model="newCommentText"
              rows="2"
              placeholder="댓글을 입력하세요"
              class="flex-1 resize-none rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
            />
            <button
              type="button"
              :disabled="isSubmittingComment || !newCommentText.trim()"
              class="inline-flex items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
              @click="submitComment"
            >
              등록
            </button>
          </div>
        </div>
      </section>
    </template>

    <!-- 글쓰기 -->
    <template v-else-if="viewMode === 'create'">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <button
          type="button"
          class="mb-4 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
          @click="viewMode = 'list'"
        >
          ← 목록으로
        </button>
        <p class="text-sm font-semibold text-[var(--color-primary)]">{{ selectedBoard?.name }}</p>
        <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">새 글 작성</h2>

        <form class="mt-5 grid gap-4" @submit.prevent="submitNewPost">
          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">제목</span>
            <input
              v-model="newPostForm.title"
              type="text"
              maxlength="200"
              placeholder="제목을 입력하세요"
              class="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            />
          </label>

          <div class="grid gap-4 lg:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-[var(--color-ink)]">Markdown</span>
              <textarea
                v-model="newPostForm.content"
                rows="18"
                placeholder="내용을 입력하세요"
                class="min-h-[28rem] resize-y rounded-md border border-[var(--color-line)] bg-white px-3 py-3 font-mono text-sm leading-6 text-[var(--color-ink)] outline-none transition placeholder:font-sans focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
                @input="syncPreview"
                @compositionupdate="syncPreview"
              />
            </label>

            <section class="grid gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-[var(--color-ink)]">미리보기</span>
                <span class="text-xs font-semibold text-[var(--color-muted)]"
                  >{{ newPostForm.content.length }}자</span
                >
              </div>
              <div
                class="min-h-[28rem] overflow-y-auto rounded-md border border-[var(--color-line)] bg-white px-4 py-3"
              >
                <article
                  v-if="markdownPreviewHtml"
                  class="markdown-body"
                  v-html="markdownPreviewHtml"
                />
                <p v-else class="text-sm text-[var(--color-muted)]">미리보기</p>
              </div>
            </section>
          </div>

          <p v-if="createError" role="alert" class="text-sm font-semibold text-red-700">
            {{ createError }}
          </p>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
              @click="viewMode = 'list'"
            >
              취소
            </button>
            <button
              type="submit"
              :disabled="isCreating"
              class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
            >
              {{ isCreating ? '등록 중…' : '등록' }}
            </button>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>

<style scoped>
.markdown-body {
  color: var(--color-ink);
  font-size: 0.875rem;
  line-height: 1.75;
  word-break: break-word;
}

.markdown-body :deep(*) {
  max-width: 100%;
}

.markdown-body :deep(p) {
  margin: 0;
}

.markdown-body :deep(p + p) {
  margin-top: 0.875rem;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1.4rem 0 0.75rem;
  color: var(--color-ink);
  font-weight: 800;
  line-height: 1.3;
}

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child) {
  margin-top: 0;
}

.markdown-body :deep(h1) {
  font-size: 1.65rem;
}

.markdown-body :deep(h2) {
  border-bottom: 1px solid var(--color-line);
  padding-bottom: 0.35rem;
  font-size: 1.35rem;
}

.markdown-body :deep(h3) {
  font-size: 1.1rem;
}

.markdown-body :deep(h4) {
  font-size: 0.98rem;
}

.markdown-body :deep(strong) {
  font-weight: 800;
}

.markdown-body :deep(a) {
  color: var(--color-primary-deep);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.85rem 0;
  padding-left: 1.35rem;
}

.markdown-body :deep(ul) {
  list-style: disc;
}

.markdown-body :deep(ol) {
  list-style: decimal;
}

.markdown-body :deep(li + li) {
  margin-top: 0.35rem;
}

.markdown-body :deep(blockquote) {
  margin: 1rem 0;
  border-left: 3px solid var(--color-primary);
  background: var(--color-card);
  padding: 0.75rem 1rem;
  color: var(--color-muted);
}

.markdown-body :deep(code) {
  border-radius: 0.25rem;
  background: var(--color-card);
  padding: 0.1rem 0.35rem;
  color: var(--color-primary-deep);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 0.86em;
}

.markdown-body :deep(pre) {
  margin: 1rem 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  background: #111827;
  padding: 1rem;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #e5e7eb;
  font-size: 0.82rem;
}

.markdown-body :deep(hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid var(--color-line);
}

.markdown-body :deep(.markdown-table-wrap) {
  margin: 1rem 0;
  overflow-x: auto;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--color-line);
  padding: 0.55rem 0.65rem;
  text-align: left;
  vertical-align: top;
}

.markdown-body :deep(th) {
  background: var(--color-card);
  font-weight: 800;
}
</style>
