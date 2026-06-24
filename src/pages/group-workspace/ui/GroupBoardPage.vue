<script setup lang="ts">
/*
 * SSAFY Coach backend evidence (framework_back_hw_09_2@4abd8ecc94a9551896e1d7193ddf1f37973b662b):
 * #01 board CRUD: src/main/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardController.java,
 *     src/main/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardService.java,
 *     src/main/java/com/studypot/aistudyleader/studygroup/board/repository/GroupBoardJdbcSql.java.
 * #10/#11 board list/detail: controller + service validate board lookup, post ownership, sorting,
 *     cursor page metadata, 404 not-found, and comment counts through GroupBoardControllerTest.
 */
import { inject, onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  listBoards,
  listBoardPosts,
  listAllPosts,
  getBoardPost,
  createBoardPost,
  updateBoardPost,
  deleteBoardPost,
  listPostComments,
  createPostComment,
  updatePostComment,
  deletePostComment,
} from '@/entities/board/api/boardApi'
import type { BoardSortField } from '@/entities/board/api/boardApi'
import type {
  GroupBoard,
  BoardPostSummary,
  BoardPost,
  BoardComment,
} from '@/entities/board/model/types'
import { useSessionStore } from '@/features/auth/session'
import { ApiError } from '@/shared/api'
import { ScreenState, SelectDropdown } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const workspaceContext = inject(groupWorkspaceContextKey)
if (!workspaceContext) throw new Error('GroupBoardPage must be inside GroupWorkspacePage.')

const { groupId } = workspaceContext
const sessionStore = useSessionStore()
const route = useRoute()
const router = useRouter()

type ViewMode = 'list' | 'detail' | 'create' | 'edit'

const viewMode = ref<ViewMode>('list')
const isLoadingBoards = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const boards = ref<GroupBoard[]>([])
const selectedBoard = ref<GroupBoard | null>(null)
const isAllBoards = ref(false)
const posts = ref<BoardPostSummary[]>([])
const selectedPost = ref<BoardPost | null>(null)
const comments = ref<BoardComment[]>([])
const isLoadingComments = ref(false)
const newCommentText = ref('')
const isSubmittingComment = ref(false)
const isDeletingPost = ref(false)
const showDeletePostDialog = ref(false)

const sortField = ref<BoardSortField>('createdAt')
const sortOrder = ref<'asc' | 'desc'>('desc')

type SortValue = 'createdAt:desc' | 'createdAt:asc' | 'commentCount:desc'

const sortOptions: { value: SortValue; label: string }[] = [
  { value: 'createdAt:desc', label: '최신순' },
  { value: 'createdAt:asc', label: '오래된순' },
  { value: 'commentCount:desc', label: '댓글 많은순' },
]

const sortValue = computed({
  get: () => `${sortField.value}:${sortOrder.value}` as SortValue,
  set: (val: string) => {
    const [f, o] = val.split(':')
    void changeSort(f as BoardSortField, o as 'asc' | 'desc')
  },
})

const newPostForm = ref({ title: '', content: '', pinned: false })
const newPostBoardId = ref('')
const isCreating = ref(false)
const createError = ref('')

const editPostForm = ref({ title: '', content: '', pinned: false })
const editPostBoardId = ref('')
const isUpdatingPost = ref(false)
const editPostError = ref('')

const editingCommentId = ref<string | null>(null)
const editingCommentText = ref('')
const isSavingComment = ref(false)
const isDeletingCommentId = ref<string | null>(null)

const previewContent = ref('')
const markdownPreviewHtml = computed(() => renderMarkdown(previewContent.value))
const editPreviewContent = ref('')
const editMarkdownPreviewHtml = computed(() => renderMarkdown(editPreviewContent.value))

const currentUserId = computed(() => sessionStore.user?.id ?? null)

const boardTypeLabel: Record<string, string> = {
  NOTICE: '공지',
  QUESTION: '질문',
  RESOURCE: '자료',
  RETROSPECTIVE: '회고',
  LEADER_REPORT: '팀장 리포트',
}

// 팀장 리포트 보드는 AI 팀장이 자동 게시하는 곳이라 사용자가 글을 쓸 수 없다.
const writableBoards = computed<GroupBoard[]>(() =>
  boards.value.filter((board) => board.boardType !== 'LEADER_REPORT'),
)

const boardMap = computed<Record<string, GroupBoard>>(() => {
  const map: Record<string, GroupBoard> = {}
  for (const board of boards.value) {
    map[board.id] = board
  }
  return map
})

function getBoardBadgeLabel(boardId: string): string {
  const board = boardMap.value[boardId]
  if (!board) return ''
  return boardTypeLabel[board.boardType] ?? board.name
}

function isMyPost(post: BoardPostSummary | BoardPost | null): boolean {
  if (!post || !currentUserId.value) return false
  return post.author.userId === currentUserId.value
}

function isMyComment(comment: BoardComment): boolean {
  if (!currentUserId.value) return false
  return comment.author.userId === currentUserId.value
}

function syncPreview(event: Event): void {
  previewContent.value = (event.target as HTMLTextAreaElement).value
}

function syncEditPreview(event: Event): void {
  editPreviewContent.value = (event.target as HTMLTextAreaElement).value
}

// 상대시간 라벨 실시간 갱신용 (30초마다 now 갱신)
const nowMs = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void loadBoards()
  nowTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 30_000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})

// postId 쿼리 파라미터로 딥링크 진입 시 해당 게시글을 자동으로 열기
watch(
  () => route.query.postId,
  async (postId) => {
    if (!postId) {
      if (viewMode.value === 'detail') backToList()
      return
    }
    if (viewMode.value === 'detail') return
    const id = String(postId)
    viewMode.value = 'detail'
    selectedPost.value = null
    comments.value = []
    isLoadingComments.value = true
    try {
      const [post, commentPage] = await Promise.all([
        getBoardPost(groupId.value, id),
        listPostComments(groupId.value, id),
      ])
      selectedPost.value = post
      comments.value = commentPage.items
    } catch {
      viewMode.value = 'list'
      void router.replace({ query: { ...route.query, postId: undefined } })
    } finally {
      isLoadingComments.value = false
    }
  },
  // 다른 페이지(AI 팀장 등)에서 ?postId= 로 바로 진입할 때도 상세를 열도록 초기 실행.
  { immediate: true },
)

async function loadBoards(): Promise<void> {
  isLoadingBoards.value = true
  errorMessage.value = ''
  try {
    boards.value = await listBoards(groupId.value)
    if (boards.value.length > 0) {
      isAllBoards.value = true
      selectedBoard.value = null
      await loadPosts()
    }
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '게시판을 불러오지 못했습니다.'
  } finally {
    isLoadingBoards.value = false
  }
}

async function selectAllBoards(): Promise<void> {
  isAllBoards.value = true
  selectedBoard.value = null
  viewMode.value = 'list'
  await loadPosts()
}

async function selectBoard(board: GroupBoard): Promise<void> {
  isAllBoards.value = false
  selectedBoard.value = board
  viewMode.value = 'list'
  await loadPosts()
}

async function loadPosts(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = { sort: sortField.value, order: sortOrder.value }
    const result = isAllBoards.value
      ? await listAllPosts(groupId.value, params)
      : selectedBoard.value
        ? await listBoardPosts(groupId.value, selectedBoard.value.id, params)
        : { items: [] }
    posts.value = 'items' in result ? result.items : []
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '게시글을 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

async function changeSort(field: BoardSortField, order: 'asc' | 'desc'): Promise<void> {
  sortField.value = field
  sortOrder.value = order
  await loadPosts()
}

async function openPost(summary: BoardPostSummary): Promise<void> {
  void router.replace({ query: { ...route.query, postId: summary.id } })
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

function backToList(): void {
  void router.replace({ query: { ...route.query, postId: undefined } })
  viewMode.value = 'list'
}

function openEditPost(): void {
  if (!selectedPost.value) return
  editPostBoardId.value = selectedPost.value.boardId
  editPostForm.value = {
    title: selectedPost.value.title,
    content: selectedPost.value.content,
    pinned: selectedPost.value.pinned,
  }
  editPreviewContent.value = selectedPost.value.content
  editPostError.value = ''
  viewMode.value = 'edit'
}

async function submitEditPost(): Promise<void> {
  if (!selectedPost.value) return
  if (!editPostBoardId.value) {
    editPostError.value = '카테고리를 선택해주세요.'
    return
  }
  if (!editPostForm.value.title.trim() || !editPostForm.value.content.trim()) {
    editPostError.value = '제목과 내용을 입력해주세요.'
    return
  }
  isUpdatingPost.value = true
  editPostError.value = ''
  try {
    const updated = await updateBoardPost(groupId.value, selectedPost.value.id, {
      boardId: editPostBoardId.value,
      title: editPostForm.value.title.trim(),
      content: editPostForm.value.content.trim(),
      pinned: editPostForm.value.pinned,
    })
    selectedPost.value = updated
    viewMode.value = 'detail'
    await loadPosts()
  } catch (error) {
    editPostError.value = error instanceof ApiError ? error.message : '게시글 수정에 실패했습니다.'
  } finally {
    isUpdatingPost.value = false
  }
}

function deletePost(): void {
  if (!selectedPost.value) return
  showDeletePostDialog.value = true
}

async function confirmDeletePost(): Promise<void> {
  if (!selectedPost.value) return
  isDeletingPost.value = true
  try {
    await deleteBoardPost(groupId.value, selectedPost.value.id)
    showDeletePostDialog.value = false
    selectedPost.value = null
    backToList()
    await loadPosts()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '게시글 삭제에 실패했습니다.'
    showDeletePostDialog.value = false
  } finally {
    isDeletingPost.value = false
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
    const postInList = posts.value.find((p) => p.id === selectedPost.value!.id)
    if (postInList) postInList.commentCount += 1
  } catch {
    // ignore
  } finally {
    isSubmittingComment.value = false
  }
}

function startEditComment(comment: BoardComment): void {
  editingCommentId.value = comment.id
  editingCommentText.value = comment.content
}

function cancelEditComment(): void {
  editingCommentId.value = null
  editingCommentText.value = ''
}

async function saveEditComment(commentId: string): Promise<void> {
  if (!editingCommentText.value.trim()) return
  isSavingComment.value = true
  try {
    const updated = await updatePostComment(
      groupId.value,
      commentId,
      editingCommentText.value.trim(),
    )
    const index = comments.value.findIndex((c) => c.id === commentId)
    if (index !== -1) comments.value[index] = updated
    editingCommentId.value = null
    editingCommentText.value = ''
  } catch {
    // ignore
  } finally {
    isSavingComment.value = false
  }
}

async function deleteComment(commentId: string): Promise<void> {
  isDeletingCommentId.value = commentId
  try {
    await deletePostComment(groupId.value, commentId)
    comments.value = comments.value.filter((c) => c.id !== commentId)
    const postInList = posts.value.find((p) => p.id === selectedPost.value?.id)
    if (postInList && postInList.commentCount > 0) postInList.commentCount -= 1
  } catch {
    // ignore
  } finally {
    isDeletingCommentId.value = null
  }
}

function openCreatePost(): void {
  newPostBoardId.value = selectedBoard.value?.id ?? ''
  newPostForm.value = { title: '', content: '', pinned: false }
  previewContent.value = ''
  createError.value = ''
  viewMode.value = 'create'
}

async function submitNewPost(): Promise<void> {
  if (!newPostBoardId.value) {
    createError.value = '게시판을 선택해주세요.'
    return
  }
  if (!newPostForm.value.title.trim() || !newPostForm.value.content.trim()) {
    createError.value = '제목과 내용을 입력해주세요.'
    return
  }
  isCreating.value = true
  createError.value = ''
  try {
    await createBoardPost(groupId.value, newPostBoardId.value, {
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

function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return ''
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

function formatRelativeDate(value: string): string {
  const date = new Date(value)
  // nowMs(반응형)에 의존 → 30초마다 갱신돼 "방금→N분 전"이 실시간으로 흐른다.
  const diffMs = nowMs.value - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return '방금'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date)
}

function formatMonthDay(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(value))
}

const avatarPalette = [
  'bg-emerald-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-orange-400',
  'bg-rose-400',
  'bg-cyan-500',
]

function getAvatarColor(name: string): string {
  if (!name) return 'bg-gray-400'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length] ?? 'bg-gray-400'
}

function isLeaderReport(boardId: string): boolean {
  return boardMap.value[boardId]?.boardType === 'LEADER_REPORT'
}

function getCommentLabel(boardId: string): string {
  return boardMap.value[boardId]?.boardType === 'QUESTION' ? '답변' : '댓글'
}

function stripMarkdown(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
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
  <div class="flex flex-col gap-4">
    <!-- 목록 -->
    <template v-if="viewMode === 'list'">
      <!-- 탭 바 + 글쓰기 버튼 -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :class="[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition focus:outline-none',
              isAllBoards
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
            ]"
            @click="selectAllBoards"
          >
            전체
          </button>
          <button
            v-for="board in boards"
            :key="board.id"
            type="button"
            :class="[
              'inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition focus:outline-none',
              !isAllBoards && selectedBoard?.id === board.id
                ? 'bg-[var(--color-primary)] text-white'
                : board.boardType === 'LEADER_REPORT'
                  ? 'border border-[rgba(25,195,125,0.3)] bg-[rgba(25,195,125,0.08)] text-[var(--color-primary)] hover:bg-[rgba(25,195,125,0.15)]'
                  : 'border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
            ]"
            @click="selectBoard(board)"
          >
            <span v-if="board.boardType === 'LEADER_REPORT'" class="text-xs">✦</span>
            {{ board.name }}
          </button>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none"
          @click="openCreatePost"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          글쓰기
        </button>
      </div>

      <ScreenState
        v-if="isLoadingBoards || isLoading"
        variant="loading"
        title="게시글을 불러오는 중입니다."
      />
      <ScreenState
        v-else-if="errorMessage"
        variant="error"
        :title="errorMessage"
        action-label="다시 시도"
        @action="loadBoards"
      />

      <ul v-else-if="posts.length > 0" class="flex flex-col gap-3">
        <li
          v-for="post in posts"
          :key="post.id"
          class="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition hover:shadow-md"
          :class="
            isLeaderReport(post.boardId)
              ? 'border-[var(--color-tint-200)] bg-[var(--color-tint-50)] shadow-[var(--shadow-soft)]'
              : 'border-[var(--color-line)] bg-[var(--color-card)] shadow-sm'
          "
          @click="openPost(post)"
        >
          <!-- 아바타 -->
          <div
            v-if="isLeaderReport(post.boardId)"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          </div>
          <div
            v-else
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            :class="getAvatarColor(post.author.displayName)"
          >
            {{ post.author.displayName[0] }}
          </div>

          <!-- 내용 -->
          <div class="min-w-0 flex-1">
            <!-- 뱃지 -->
            <div class="flex flex-wrap items-center gap-1.5">
              <template v-if="isLeaderReport(post.boardId)">
                <span
                  class="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-bold text-white"
                  >AI 팀장</span
                >
                <span
                  class="rounded-full bg-[var(--color-tint-50)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary-text)]"
                  >주간 리포트</span
                >
              </template>
              <span
                v-else-if="boardMap[post.boardId]?.boardType === 'NOTICE'"
                class="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-600 dark:bg-teal-900/20 dark:text-teal-400"
                >공지</span
              >
              <span
                v-else-if="boardMap[post.boardId]?.boardType === 'QUESTION'"
                class="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                >질문</span
              >
              <span
                v-else-if="boardMap[post.boardId]?.boardType === 'RESOURCE'"
                class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                >자료 공유</span
              >
              <span
                v-else-if="boardMap[post.boardId]?.boardType === 'RETROSPECTIVE'"
                class="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                >회고</span
              >
            </div>

            <!-- 제목 -->
            <p class="mt-1.5 font-semibold text-[var(--color-ink)]">{{ post.title }}</p>

            <!-- 미리보기 (AI 리포트는 본문 미리보기 숨김) -->
            <p
              v-if="post.contentPreview && !isLeaderReport(post.boardId)"
              class="mt-0.5 line-clamp-1 text-sm text-[var(--color-muted)]"
            >
              {{ stripMarkdown(post.contentPreview) }}
            </p>

            <!-- 푸터 -->
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
              <template v-if="isLeaderReport(post.boardId)">
                <span>AI 팀장</span>
                <span>·</span>
                <span>자동 발행</span>
                <span>·</span>
                <span>{{ formatMonthDay(post.createdAt) }}</span>
              </template>
              <template v-else>
                <span>{{ post.author.displayName }}</span>
                <span>·</span>
                <span>{{ formatRelativeDate(post.createdAt) }}</span>
                <template v-if="post.commentCount > 0">
                  <span class="flex items-center gap-1">
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {{ getCommentLabel(post.boardId) }} {{ post.commentCount }}
                  </span>
                </template>
              </template>
            </div>
          </div>
        </li>
      </ul>

      <p v-else class="py-12 text-center text-sm text-[var(--color-muted)]">게시글이 없어요.</p>
    </template>

    <!-- 상세 -->
    <template v-else-if="viewMode === 'detail'">
      <button
        type="button"
        class="self-start text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
        @click="backToList"
      >
        ← 목록으로
      </button>

      <div class="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-sm">
        <ScreenState
          v-if="!selectedPost && isLoadingComments"
          variant="loading"
          title="게시글을 불러오는 중입니다."
          class="p-8"
        />

        <template v-else-if="selectedPost">
          <!-- 헤더 -->
          <div class="px-6 pt-6">
            <!-- 뱃지 -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-if="isLeaderReport(selectedPost.boardId)"
                class="rounded-full bg-[rgba(25,195,125,0.12)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]"
                >AI 팀장</span
              >
              <span
                v-else-if="boardMap[selectedPost.boardId]?.boardType === 'NOTICE'"
                class="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-600 dark:bg-teal-900/20 dark:text-teal-400"
                >공지</span
              >
              <span
                v-else-if="boardMap[selectedPost.boardId]?.boardType === 'QUESTION'"
                class="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                >질문</span
              >
              <span
                v-else-if="boardMap[selectedPost.boardId]?.boardType === 'RESOURCE'"
                class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                >자료 공유</span
              >
              <span
                v-else-if="boardMap[selectedPost.boardId]?.boardType === 'RETROSPECTIVE'"
                class="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                >회고</span
              >
            </div>

            <!-- 제목 -->
            <h2 class="mt-3 text-xl font-bold text-[var(--color-ink)]">
              {{ selectedPost.title }}
            </h2>

            <!-- 작성자 행 -->
            <div class="mt-4 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  :class="getAvatarColor(selectedPost.author.displayName)"
                >
                  {{ selectedPost.author.displayName[0] }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-[var(--color-ink)]">
                    {{ selectedPost.author.displayName }}
                  </p>
                  <p class="text-xs text-[var(--color-muted)]">
                    {{ formatRelativeDate(selectedPost.createdAt) }}
                  </p>
                </div>
              </div>
              <div v-if="isMyPost(selectedPost)" class="flex shrink-0 gap-2">
                <button
                  type="button"
                  class="inline-flex h-8 items-center rounded-md border border-[var(--color-line-strong)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none"
                  aria-label="게시글 수정"
                  @click="openEditPost"
                >
                  수정
                </button>
                <button
                  type="button"
                  :disabled="isDeletingPost"
                  class="inline-flex h-8 items-center rounded-md border border-[var(--color-danger)] px-3 text-xs font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)] hover:text-white focus:outline-none disabled:opacity-50"
                  aria-label="게시글 삭제"
                  @click="deletePost"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>

          <div class="mt-5 border-t border-[var(--color-line)]" />

          <!-- 본문 -->
          <div class="px-6 py-5">
            <article class="markdown-body" v-html="renderMarkdown(selectedPost.content)" />
          </div>

          <!-- 댓글 -->
          <div class="border-t border-[var(--color-line)] px-6 pb-6 pt-5">
            <h3 class="text-base font-bold text-[var(--color-primary)]">
              댓글 {{ comments.length }}
            </h3>

            <ScreenState v-if="isLoadingComments" variant="loading" title="댓글을 불러오는 중…" />

            <ul v-else-if="comments.length > 0" class="mt-4 flex flex-col gap-3">
              <li
                v-for="comment in comments"
                :key="comment.id"
                class="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      :class="getAvatarColor(comment.author.displayName)"
                    >
                      {{ comment.author.displayName[0] }}
                    </div>
                    <p class="text-sm font-semibold text-[var(--color-ink)]">
                      {{ comment.author.displayName }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="text-xs text-[var(--color-muted)]">{{
                      formatRelativeDate(comment.createdAt)
                    }}</span>
                    <template v-if="isMyComment(comment)">
                      <button
                        type="button"
                        class="text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
                        :aria-label="`${comment.author.displayName} 댓글 수정`"
                        @click="startEditComment(comment)"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        :disabled="isDeletingCommentId === comment.id"
                        class="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] focus:outline-none disabled:opacity-50"
                        :aria-label="`${comment.author.displayName} 댓글 삭제`"
                        @click="deleteComment(comment.id)"
                      >
                        삭제
                      </button>
                    </template>
                  </div>
                </div>

                <!-- 댓글 인라인 수정 -->
                <template v-if="editingCommentId === comment.id">
                  <textarea
                    v-model="editingCommentText"
                    rows="2"
                    class="mt-3 w-full resize-none rounded-md border border-[var(--color-line)] bg-[var(--color-active)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.14)]"
                  />
                  <div class="mt-1 flex gap-2">
                    <button
                      type="button"
                      :disabled="isSavingComment"
                      class="text-xs font-semibold text-[var(--color-primary)] hover:underline focus:outline-none disabled:opacity-50"
                      @click="saveEditComment(comment.id)"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      class="text-xs text-[var(--color-muted)] hover:underline focus:outline-none"
                      @click="cancelEditComment"
                    >
                      취소
                    </button>
                  </div>
                </template>
                <p v-else class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  {{ comment.content }}
                </p>
              </li>
            </ul>

            <!-- 댓글 입력 -->
            <div class="mt-4 flex gap-2">
              <input
                v-model="newCommentText"
                type="text"
                placeholder="댓글남기기..."
                class="flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-input)] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.14)]"
                @keydown.enter.prevent="submitComment"
              />
              <button
                type="button"
                :disabled="isSubmittingComment || !newCommentText.trim()"
                class="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none disabled:opacity-50"
                @click="submitComment"
              >
                등록
              </button>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- 글쓰기 -->
    <template v-else-if="viewMode === 'create'">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <button
          type="button"
          class="mb-4 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
          @click="viewMode = 'list'"
        >
          ← 목록으로
        </button>
        <p class="text-sm font-semibold text-[var(--color-primary)]">게시판</p>
        <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">새 글 작성</h2>

        <form class="mt-5 grid gap-4" @submit.prevent="submitNewPost">
          <!-- 카테고리 선택 -->
          <div class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">
              카테고리 <span class="text-[var(--color-danger)]">*</span>
            </span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="board in writableBoards"
                :key="board.id"
                type="button"
                :class="[
                  'rounded-md border px-3 py-1.5 text-xs font-semibold transition focus:outline-none',
                  newPostBoardId === board.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                ]"
                @click="newPostBoardId = board.id"
              >
                {{ board.name }}
              </button>
            </div>
          </div>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">제목</span>
            <input
              v-model="newPostForm.title"
              type="text"
              maxlength="200"
              placeholder="제목을 입력하세요"
              class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            />
          </label>

          <div class="grid gap-4 lg:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-[var(--color-ink)]">Markdown</span>
              <textarea
                v-model="newPostForm.content"
                rows="18"
                placeholder="내용을 입력하세요"
                class="min-h-[28rem] resize-y rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 py-3 font-mono text-sm leading-6 text-[var(--color-ink)] outline-none transition placeholder:font-sans focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
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
                class="min-h-[28rem] overflow-y-auto rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 py-3"
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

          <p
            v-if="createError"
            role="alert"
            class="text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ createError }}
          </p>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.16)]"
              @click="viewMode = 'list'"
            >
              취소
            </button>
            <button
              type="submit"
              :disabled="isCreating"
              class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-50"
            >
              {{ isCreating ? '등록 중…' : '등록' }}
            </button>
          </div>
        </form>
      </section>
    </template>

    <!-- 게시글 수정 -->
    <template v-else-if="viewMode === 'edit'">
      <section
        class="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <button
          type="button"
          class="mb-4 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none"
          @click="viewMode = 'detail'"
        >
          ← 게시글로
        </button>
        <h2 class="mt-2 text-xl font-bold text-[var(--color-ink)]">게시글 수정</h2>

        <form class="mt-5 grid gap-4" @submit.prevent="submitEditPost">
          <!-- 카테고리 선택 -->
          <div class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">
              카테고리 <span class="text-[var(--color-danger)]">*</span>
            </span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="board in writableBoards"
                :key="board.id"
                type="button"
                :class="[
                  'rounded-md border px-3 py-1.5 text-xs font-semibold transition focus:outline-none',
                  editPostBoardId === board.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-line-strong)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                ]"
                @click="editPostBoardId = board.id"
              >
                {{ board.name }}
              </button>
            </div>
          </div>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-[var(--color-ink)]">제목</span>
            <input
              v-model="editPostForm.title"
              type="text"
              maxlength="200"
              placeholder="제목을 입력하세요"
              class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            />
          </label>

          <div class="grid gap-4 lg:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-[var(--color-ink)]">Markdown</span>
              <textarea
                v-model="editPostForm.content"
                rows="18"
                placeholder="내용을 입력하세요"
                class="min-h-[28rem] resize-y rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 py-3 font-mono text-sm leading-6 text-[var(--color-ink)] outline-none transition placeholder:font-sans focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
                @input="syncEditPreview"
                @compositionupdate="syncEditPreview"
              />
            </label>

            <section class="grid gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-[var(--color-ink)]">미리보기</span>
                <span class="text-xs font-semibold text-[var(--color-muted)]"
                  >{{ editPostForm.content.length }}자</span
                >
              </div>
              <div
                class="min-h-[28rem] overflow-y-auto rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 py-3"
              >
                <article
                  v-if="editMarkdownPreviewHtml"
                  class="markdown-body"
                  v-html="editMarkdownPreviewHtml"
                />
                <p v-else class="text-sm text-[var(--color-muted)]">미리보기</p>
              </div>
            </section>
          </div>

          <p
            v-if="editPostError"
            role="alert"
            class="text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ editPostError }}
          </p>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.16)]"
              @click="viewMode = 'detail'"
            >
              취소
            </button>
            <button
              type="submit"
              :disabled="isUpdatingPost"
              class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(25,195,125,0.2)] disabled:opacity-50"
            >
              {{ isUpdatingPost ? '저장 중…' : '저장' }}
            </button>
          </div>
        </form>
      </section>
    </template>
  </div>

  <!-- 게시글 삭제 확인 모달 -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDeletePostDialog"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-post-dialog-title"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="showDeletePostDialog = false"
        />
        <div class="relative w-full max-w-sm rounded-xl bg-[var(--color-card)] p-6 shadow-2xl">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(237,66,69,0.12)] text-[var(--color-danger)]"
          >
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <polyline points="3 6 5 6 21 6" stroke-linecap="round" stroke-linejoin="round" />
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h2 id="delete-post-dialog-title" class="mt-4 text-lg font-bold text-[var(--color-ink)]">
            게시글을 삭제하시겠습니까?
          </h2>
          <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            삭제된 게시글은 복구할 수 없습니다.
          </p>
          <div class="mt-5 flex gap-3">
            <button
              type="button"
              :disabled="isDeletingPost"
              class="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-4 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] disabled:opacity-50"
              @click="showDeletePostDialog = false"
            >
              취소
            </button>
            <button
              type="button"
              :disabled="isDeletingPost"
              class="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-danger)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              @click="confirmDeletePost"
            >
              {{ isDeletingPost ? '삭제 중…' : '삭제' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
