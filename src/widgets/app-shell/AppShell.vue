<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  getGroup,
  joinGroupByInviteCode,
  type StudyGroup,
  type StudyGroupStatus,
  useGroupListStore,
} from '@/entities/group'
import { getMyOnboarding, useOnboardingStatusStore } from '@/entities/onboarding'
import { useSessionStore } from '@/features/auth/session'
import { NotificationBell, useInAppNotificationStore } from '@/features/notification'
import { ApiError } from '@/shared/api'
import { apiOrigin } from '@/shared/config/api'

type StatusPhase = 'before' | 'active' | 'done'
type ChannelDef = {
  routeName: string
  label: string
  type: 'home' | 'todo' | 'ai' | 'board' | 'person' | 'onboard' | 'review'
}
type ChannelSection = { label: string; channels: ChannelDef[] }

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const groupListStore = useGroupListStore()
const onboardingStatusStore = useOnboardingStatusStore()
const notificationStore = useInAppNotificationStore()

const currentGroupId = computed(() => String(route.params.groupId ?? ''))
const currentGroup = ref<StudyGroup | null>(null)
const myOnboardingSubmitted = ref(false)

// 새 그룹 팝오버 + 코드 참여 모달
const showCreateMenu = ref(false)
const createMenuPos = ref({ top: 0, left: 0 })
const showJoinModal = ref(false)
const joinCode = ref('')
const joinError = ref('')
const isJoining = ref(false)

// 레일 hover 드로어: 마우스를 올리면 그룹 목록이 옆으로 펼쳐진다.
const railHover = ref(false)
let railCloseTimer: ReturnType<typeof setTimeout> | undefined
function openRail(): void {
  if (railCloseTimer) clearTimeout(railCloseTimer)
  railHover.value = true
}
function closeRail(): void {
  // 새 그룹 팝오버(방 생성/코드 참여)가 열려 있는 동안에는 레일을 닫지 않는다.
  // 팝오버는 레일 바깥에 떠서, 거기로 마우스를 옮기면 mouseleave 로 드로어가 닫혀버리던 문제 방지.
  if (showCreateMenu.value) return
  if (railCloseTimer) clearTimeout(railCloseTimer)
  railCloseTimer = setTimeout(() => {
    railHover.value = false
  }, 120)
}
function closeRailNow(): void {
  if (railCloseTimer) clearTimeout(railCloseTimer)
  railHover.value = false
}

const loginNotice = computed(() => {
  if (route.query.error === 'oauth') return 'Google 로그인에 실패했습니다. 다시 시도해주세요.'
  if (route.query.signedOut === 'all') return '모든 기기에서 로그아웃되었습니다.'
  if (route.query.signedOut === 'current') return '로그아웃되었습니다.'
  return ''
})

const PUBLIC_CHANNELS: ChannelDef[] = [
  { routeName: 'group-overview', label: 'Home', type: 'home' },
  { routeName: 'group-board', label: '게시판', type: 'board' },
  { routeName: 'group-my', label: '팀원', type: 'person' },
]

const PRIVATE_CHANNELS: ChannelDef[] = [
  { routeName: 'group-todo', label: 'Todo', type: 'todo' },
  { routeName: 'group-ai', label: 'AI 팀장', type: 'ai' },
  { routeName: 'group-retrospective', label: '회고', type: 'review' },
]

const ONBOARD_CHANNEL: ChannelDef = {
  routeName: 'group-onboarding',
  label: '온보딩',
  type: 'onboard',
}

const showOnboarding = computed(() => {
  if (!currentGroup.value) return false
  const s = currentGroup.value.status
  if (s === 'READY_TO_START' || s === 'ACTIVE' || s === 'COMPLETED' || s === 'ARCHIVED')
    return false
  // 제출 직후엔 onboardingStatusStore 신호로(서버 재조회 없이) 즉시 탭을 숨긴다.
  if (onboardingStatusStore.submittedGroupIds.includes(currentGroupId.value)) return false
  return !myOnboardingSubmitted.value
})

const channelSections = computed<ChannelSection[]>(() => {
  const isActive = currentGroup.value?.status === 'ACTIVE'

  if (!isActive) {
    const nonActiveChannels = showOnboarding.value
      ? [PUBLIC_CHANNELS[0]!, ONBOARD_CHANNEL, PUBLIC_CHANNELS[2]!]
      : [PUBLIC_CHANNELS[0]!, PUBLIC_CHANNELS[2]!]
    return [{ label: '', channels: nonActiveChannels }]
  }

  return [
    { label: '공용 공간', channels: [...PUBLIC_CHANNELS] },
    { label: '개인 공간', channels: PRIVATE_CHANNELS },
  ]
})

const allChannels = computed(() => channelSections.value.flatMap((s) => s.channels))

const activeChannelLabel = computed(() => {
  const name = String(route.name ?? '')
  return allChannels.value.find((c) => c.routeName === name)?.label ?? ''
})

const currentGroupPhase = computed<StatusPhase | null>(() =>
  currentGroup.value ? getStatusPhase(currentGroup.value.status) : null,
)

const statusLabel: Record<StudyGroupStatus, string> = {
  DRAFT: '준비 중',
  ONBOARDING: '온보딩',
  READY_TO_START: '시작 대기',
  ACTIVE: '진행 중',
  COMPLETED: '완료',
  ARCHIVED: '보관됨',
}

const userInitial = computed(() => sessionStore.user?.nickname?.slice(0, 1)?.toUpperCase() ?? '?')

onMounted(() => {
  if (sessionStore.isAuthenticated) void groupListStore.loadGroups()
  document.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
})

watch(
  () => sessionStore.isAuthenticated,
  (ok) => {
    if (ok) void groupListStore.loadGroups()
    else groupListStore.clearGroups()
  },
)

watch(
  currentGroupId,
  () => {
    void loadCurrentGroup()
  },
  { immediate: true },
)

// 페이지 이동 시 레일 hover 드로어를 닫는다.
watch(
  () => route.fullPath,
  () => {
    closeRailNow()
  },
)

// 실시간 알림(SSE)으로 스터디 시작/주차 시작 등 현재 그룹 이벤트가 오면
// 그룹 상태를 다시 불러와 사이드바 탭(Todo·AI 팀장·회고 등)이 새로고침 없이 즉시 나타나게 한다.
const LIVE_REFRESH_TYPES = new Set([
  'MEMBER_JOINED',
  'ONBOARDING_REQUESTED',
  'ONBOARDING_SUBMITTED',
  'ONBOARDING_COMPLETED',
  'STUDY_STARTED',
  'WEEK_STARTED',
])

watch(
  () => notificationStore.lastEvent,
  (event) => {
    if (!event) return
    const eventGroupId =
      event.groupId ??
      (event.payload?.groupId as string | undefined) ??
      event.relatedResourceIds?.groupId
    if (eventGroupId === currentGroupId.value && LIVE_REFRESH_TYPES.has(event.notificationType)) {
      void loadCurrentGroup()
    }
  },
)

async function loadCurrentGroup(): Promise<void> {
  if (!currentGroupId.value) {
    currentGroup.value = null
    return
  }
  try {
    const [g, o] = await Promise.allSettled([
      getGroup(currentGroupId.value),
      getMyOnboarding(currentGroupId.value),
    ])
    currentGroup.value = g.status === 'fulfilled' ? g.value : null
    myOnboardingSubmitted.value = o.status === 'fulfilled' && o.value.status === 'SUBMITTED'
  } catch {
    currentGroup.value = null
  }
}

function getGroupInitials(name: string): string {
  return ([...name.trim()][0] ?? '').toUpperCase()
}

function getStatusPhase(status: StudyGroupStatus): StatusPhase {
  if (status === 'ACTIVE') return 'active'
  if (status === 'COMPLETED' || status === 'ARCHIVED') return 'done'
  return 'before'
}

// 레일 그룹 아이콘은 그룹마다 다른 카테고리 색을 쓴다. 상태는 우하단 점으로 표시.
function getIconClasses(_group: StudyGroup, isSelected: boolean): string {
  const base =
    'flex h-12 w-12 items-center justify-center text-sm font-bold text-white transition-all duration-100'
  return isSelected ? `${base} rounded-2xl` : `${base} rounded-3xl group-hover:rounded-2xl`
}

function getDotClass(status: StudyGroupStatus): string {
  const phase = getStatusPhase(status)
  if (phase === 'active') return 'bg-[var(--color-success)]'
  if (phase === 'before') return 'bg-[var(--color-warning)]'
  return 'bg-[#c0c4cc]'
}

// 레일 아이콘 배경: 시작(진행 중)=초록, 시작 전=피치, 완료/보관=회색
function getIconBg(status: StudyGroupStatus): string {
  const phase = getStatusPhase(status)
  if (phase === 'active') return 'var(--color-primary)'
  if (phase === 'before') return '#f4a259'
  return '#c0c4cc'
}

function closeMenus(): void {
  showCreateMenu.value = false
}

function toggleCreateMenu(event: MouseEvent): void {
  event.stopPropagation()
  if (!showCreateMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    createMenuPos.value = { top: rect.top, left: rect.right + 8 }
  }
  showCreateMenu.value = !showCreateMenu.value
}

function goCreateGroup(): void {
  showCreateMenu.value = false
  void router.push({ name: 'group-create' })
}

function openJoinModal(): void {
  showCreateMenu.value = false
  joinCode.value = ''
  joinError.value = ''
  showJoinModal.value = true
}

async function submitJoin(): Promise<void> {
  const code = joinCode.value.trim()
  if (!code || isJoining.value) return
  isJoining.value = true
  joinError.value = ''
  try {
    const member = await joinGroupByInviteCode(code)
    await groupListStore.loadGroups()
    notificationStore.pushToast(
      '그룹에 참여했어요',
      '온보딩을 작성하면 시작할 수 있어요.',
      'success',
    )
    showJoinModal.value = false
    await router.push({ name: 'group-onboarding', params: { groupId: member.groupId } })
  } catch (error) {
    joinError.value =
      error instanceof ApiError ? error.message : '참여하지 못했어요. 초대 코드를 확인해 주세요.'
  } finally {
    isJoining.value = false
  }
}


function startGoogleLogin(): void {
  window.location.assign(`${apiOrigin}/api/oauth2/authorization/google`)
}
</script>

<template>
  <!-- Session loading -->
  <div
    v-if="sessionStore.status === 'idle' || sessionStore.status === 'loading'"
    class="flex h-full items-center justify-center bg-[var(--color-surface)]"
  >
    <div class="flex items-center gap-2.5 text-[var(--color-muted)]">
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span class="text-sm">불러오는 중</span>
    </div>
  </div>

  <!-- Login (not authenticated) -->
  <div
    v-else-if="!sessionStore.isAuthenticated"
    class="flex h-full flex-col items-center justify-center bg-[var(--color-surface)]"
  >
    <div class="w-full max-w-[360px] px-4">
      <div class="mb-8">
        <p class="text-xs font-medium tracking-wide text-[var(--color-primary)] uppercase">
          StudyPot
        </p>
        <h1 class="mt-2 text-3xl font-bold leading-tight text-[var(--color-ink)]">
          스터디 그룹을<br />시작해보세요
        </h1>
        <p class="mt-3 text-sm text-[var(--color-muted)]">
          AI가 커리큘럼을 만들어 드려요. Google 계정으로 바로 시작할 수 있어요.
        </p>
      </div>

      <div
        v-if="loginNotice"
        class="mb-5 rounded-md border border-[rgba(237,66,69,0.25)] bg-[rgba(237,66,69,0.1)] px-4 py-3 text-sm text-[var(--color-danger)]"
      >
        {{ loginNotice }}
      </div>

      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
        @click="startGoogleLogin"
      >
        <svg
          aria-hidden="true"
          class="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21.64 12.2045C21.64 11.5668 21.5827 10.9536 21.4764 10.3636H12V14.2577H17.4145C17.1814 15.5159 16.4723 16.5818 15.4064 17.2927V19.8182H18.6618C20.5673 18.0636 21.64 15.4773 21.64 12.2045Z"
            fill="#4285F4"
          />
          <path
            d="M12 22C14.72 22 17.0018 21.0982 18.6618 19.8182L15.4064 17.2927C14.5045 17.8982 13.3509 18.2577 12 18.2577C9.37636 18.2577 7.15273 16.4855 6.36 14.1027H2.99455V16.7109C4.64545 19.9891 8.03818 22 12 22Z"
            fill="#34A853"
          />
          <path
            d="M6.36 14.1027C6.15818 13.4973 6.04364 12.8509 6.04364 12.1818C6.04364 11.5127 6.15818 10.8664 6.36 10.2609V7.65273H2.99455C2.31545 9.00545 1.93091 10.5291 1.93091 12.1818C1.93091 13.8345 2.31545 15.3582 2.99455 16.7109L6.36 14.1027Z"
            fill="#FBBC05"
          />
          <path
            d="M12 6.10545C13.4745 6.10545 14.7982 6.61273 15.84 7.60909L18.7355 4.71364C16.9973 3.06091 14.7155 2 12 2C8.03818 2 4.64545 4.01091 2.99455 7.28909L6.36 9.89727C7.15273 7.51455 9.37636 5.74227 12 5.74227V6.10545Z"
            fill="#EA4335"
          />
        </svg>
        Google로 계속하기
      </button>

      <p class="mt-5 text-center text-sm text-[var(--color-muted)]">
        계정이 없으신가요?
        <button
          type="button"
          class="font-semibold text-[var(--color-primary)] hover:underline"
          @click="startGoogleLogin"
        >
          회원가입
        </button>
      </p>
    </div>
  </div>

  <!-- Discord layout (authenticated) -->
  <div v-else class="relative flex h-full overflow-hidden">
    <!-- ── Server rail: 레이아웃 spacer (72px 고정) ── -->
    <div class="w-[72px] shrink-0" aria-hidden="true" />

    <!-- ── Server rail: 실제 nav (absolute, hover 시 너비 확장) ── -->
    <nav
      class="absolute left-0 top-0 z-40 flex h-full flex-col overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-surface)]"
      :style="{
        width: railHover ? '240px' : '72px',
        transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
      }"
      aria-label="스터디 그룹"
      @mouseenter="openRail"
      @mouseleave="closeRail"
    >
      <!-- 스크롤 영역 (그룹 목록): 스크롤바 숨김 -->
      <div
        class="flex flex-1 flex-col overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden"
        style="scrollbar-width: none"
      >
        <!-- Home -->
        <RouterLink
          :to="{ name: 'groups' }"
          class="group relative flex h-[72px] w-[240px] shrink-0 items-center hover:bg-[var(--color-active)]"
          :class="!currentGroupId ? 'bg-[var(--color-active)]' : ''"
          @click="closeRailNow"
        >
          <div
            class="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--color-primary)]"
            :class="!currentGroupId ? 'h-8' : 'h-0 group-hover:h-5'"
            style="transition: height 100ms"
          />
          <div class="flex w-[72px] shrink-0 flex-col items-center">
            <div
              :class="[
                'flex h-11 w-11 items-center justify-center overflow-hidden bg-[var(--color-primary)] transition-[border-radius] duration-100',
                !currentGroupId ? 'rounded-2xl' : 'rounded-3xl group-hover:rounded-2xl',
              ]"
            >
              <img src="/AIbot.png" alt="Home" class="h-full w-full object-cover" />
            </div>
            <span
              class="max-w-[60px] truncate text-center text-[10px] font-medium leading-[1.3]"
              :class="!currentGroupId ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted-deep)]'"
              :style="{
                marginTop: railHover ? '0px' : '2px',
                maxHeight: railHover ? '0px' : '14px',
                overflow: 'hidden',
                opacity: railHover ? 0 : 1,
                transition: 'margin-top 150ms, max-height 150ms, opacity 100ms',
              }"
            >Home</span>
          </div>
          <span
            class="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold"
            :class="!currentGroupId ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'"
            :style="{ opacity: railHover ? 1 : 0, transition: 'opacity 120ms 80ms' }"
          >Home</span>
        </RouterLink>

        <div class="mx-auto my-0.5 h-px w-8 shrink-0 bg-[var(--color-line-strong)]" />

        <!-- 그룹 목록 -->
        <RouterLink
          v-for="group in groupListStore.groups"
          :key="group.id"
          :to="{ name: 'group-overview', params: { groupId: group.id } }"
          class="group relative flex h-[72px] w-[240px] shrink-0 items-center hover:bg-[var(--color-active)]"
          :class="currentGroupId === group.id ? 'bg-[var(--color-active)]' : ''"
          @click="closeRailNow"
        >
          <div
            class="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--color-primary)]"
            :class="currentGroupId === group.id ? 'h-8' : 'h-0 group-hover:h-5'"
            style="transition: height 100ms"
          />
          <div class="flex w-[72px] shrink-0 flex-col items-center">
            <div class="relative">
              <div
                :class="getIconClasses(group, currentGroupId === group.id)"
                :style="{ backgroundColor: getIconBg(group.status) }"
              >{{ getGroupInitials(group.name) }}</div>
              <span
                :class="[
                  'pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface)]',
                  getDotClass(group.status),
                ]"
              />
            </div>
            <span
              class="max-w-[60px] truncate text-center text-[10px] font-medium leading-[1.3]"
              :class="currentGroupId === group.id ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted-deep)]'"
              :style="{
                marginTop: railHover ? '0px' : '2px',
                maxHeight: railHover ? '0px' : '14px',
                overflow: 'hidden',
                opacity: railHover ? 0 : 1,
                transition: 'margin-top 150ms, max-height 150ms, opacity 100ms',
              }"
            >{{ group.name }}</span>
          </div>
          <span
            class="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium text-[var(--color-ink)]"
            :style="{ opacity: railHover ? 1 : 0, transition: 'opacity 120ms 80ms' }"
          >{{ group.name }}</span>
        </RouterLink>

        <div class="mx-auto my-0.5 h-px w-8 shrink-0 bg-[var(--color-line-strong)]" />

        <!-- 새 그룹 추가 -->
        <button
          type="button"
          class="group relative flex h-[72px] w-[240px] shrink-0 items-center text-left hover:bg-[var(--color-hover)]"
          @click="toggleCreateMenu"
        >
          <div class="flex w-[72px] shrink-0 flex-col items-center">
            <span
              class="flex h-11 w-11 items-center justify-center rounded-3xl bg-[var(--color-active)] text-[var(--color-success)] transition-[border-radius,background-color] duration-100 group-hover:rounded-2xl group-hover:bg-[var(--color-success)] group-hover:text-white"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span
              class="max-w-[60px] truncate text-center text-[10px] font-medium leading-[1.3] text-[var(--color-muted-deep)]"
              :style="{
                marginTop: railHover ? '0px' : '2px',
                maxHeight: railHover ? '0px' : '14px',
                overflow: 'hidden',
                opacity: railHover ? 0 : 1,
                transition: 'margin-top 150ms, max-height 150ms, opacity 100ms',
              }"
            >추가</span>
          </div>
          <span
            class="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold text-[var(--color-ink)]"
            :style="{ opacity: railHover ? 1 : 0, transition: 'opacity 120ms 80ms' }"
          >새 그룹 만들기</span>
        </button>
      </div>

      <!-- 프로필 (하단 고정) -->
      <div class="shrink-0 border-t border-[var(--color-line)]">
        <RouterLink
          :to="{ name: 'profile' }"
          class="group relative flex h-[72px] w-[240px] items-center hover:bg-[var(--color-hover)]"
          @click="closeRailNow"
        >
          <div class="flex w-[72px] shrink-0 flex-col items-center">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white transition-[border-radius] duration-100 group-hover:rounded-2xl"
            >{{ userInitial }}</div>
            <span
              class="max-w-[60px] truncate text-center text-[10px] font-medium leading-[1.3] text-[var(--color-muted-deep)]"
              :style="{
                marginTop: railHover ? '0px' : '2px',
                maxHeight: railHover ? '0px' : '14px',
                overflow: 'hidden',
                opacity: railHover ? 0 : 1,
                transition: 'margin-top 150ms, max-height 150ms, opacity 100ms',
              }"
            >프로필</span>
          </div>
          <div
            class="min-w-0 flex-1"
            :style="{ opacity: railHover ? 1 : 0, transition: 'opacity 120ms 80ms' }"
          >
            <p class="truncate text-[13px] font-semibold text-[var(--color-ink)]">{{ sessionStore.user?.nickname }}</p>
            <p class="truncate text-[10px] text-[var(--color-muted-deep)]">{{ sessionStore.user?.email }}</p>
          </div>
        </RouterLink>
      </div>
    </nav>

    <!-- ── Channel panel (240px, 그룹 워크스페이스에서만) ── -->
    <div
      v-if="currentGroupId"
      class="flex w-60 shrink-0 flex-col overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-surface)]"
    >
      <!-- Panel header -->
      <div
        class="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-line)] px-3"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-[var(--color-ink)]">
            {{ currentGroup?.name ?? '...' }}
          </p>
          <!-- Status badge for current group -->
          <p
            v-if="currentGroupPhase"
            :class="[
              'text-[10px] font-medium leading-[1.3] mt-0.5',
              currentGroupPhase === 'active'
                ? 'text-[var(--color-success)]'
                : currentGroupPhase === 'before'
                  ? 'text-[#e0953a]'
                  : 'text-[var(--color-muted-deep)]',
            ]"
          >
            {{ statusLabel[currentGroup!.status] }}
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-2 py-2" :aria-label="currentGroupId ? '채널' : '메뉴'">
        <template v-if="currentGroupId">
          <template v-for="section in channelSections" :key="section.label">
            <p
              v-if="section.label"
              class="mb-1 mt-3 px-2 text-[11px] font-medium text-[var(--color-muted-deep)]"
            >
              {{ section.label }}
            </p>

            <RouterLink
              v-for="ch in section.channels"
              :key="ch.routeName"
              :to="{ name: ch.routeName, params: { groupId: currentGroupId } }"
              :class="[
                'group flex h-10 items-center gap-2 rounded px-2 text-sm transition-colors',
                ch.type === 'onboard'
                  ? 'text-[#e0953a] hover:bg-[rgba(25,195,125,0.11)] hover:text-[#f0a04b]'
                  : 'text-[var(--color-muted)] hover:bg-[rgba(25,195,125,0.11)] hover:text-[var(--color-ink)]',
              ]"
              :exact-active-class="
                ch.type === 'onboard'
                  ? '!bg-[var(--color-hover)] !text-[#f0a04b]'
                  : '!bg-[rgba(25,195,125,0.22)] !text-[var(--color-ink)]'
              "
            >
              <!-- Channel icon -->
              <svg
                class="h-4 w-4 shrink-0 opacity-60 group-[&.router-link-exact-active]:opacity-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <!-- home -->
                <template v-if="ch.type === 'home'">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </template>
                <!-- todo -->
                <template v-else-if="ch.type === 'todo'">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </template>
                <!-- ai -->
                <template v-else-if="ch.type === 'ai'">
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                  <path
                    d="M5.5 16.5l.75 2.25L8.5 19.5l-2.25.75-.75 2.25-.75-2.25L2.5 19.5l2.25-.75.75-2.25z"
                  />
                </template>
                <!-- board -->
                <template v-else-if="ch.type === 'board'">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </template>
                <!-- person -->
                <template v-else-if="ch.type === 'person'">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </template>
                <!-- onboard -->
                <template v-else-if="ch.type === 'onboard'">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </template>
                <!-- review -->
                <template v-else-if="ch.type === 'review'">
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  />
                </template>
              </svg>

              <span class="truncate">{{ ch.label }}</span>

              <!-- Onboarding action indicator -->
              <span
                v-if="ch.type === 'onboard'"
                class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#e0953a]"
              />
            </RouterLink>
          </template>
        </template>
      </nav>
    </div>

    <!-- ── Main content ── -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <div
        class="flex h-12 shrink-0 items-center border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4"
      >
        <template v-if="currentGroupId && activeChannelLabel">
          <svg
            class="mr-2 h-4 w-4 shrink-0 text-[var(--color-muted-deep)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <template
              v-if="allChannels.find((c) => c.routeName === String(route.name))?.type === 'home'"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </template>
            <template
              v-else-if="allChannels.find((c) => c.routeName === String(route.name))?.type === 'ai'"
            >
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            </template>
            <template v-else>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </template>
          </svg>
          <span class="text-sm font-semibold text-[var(--color-ink)]">{{
            activeChannelLabel
          }}</span>
          <span
            v-if="currentGroup"
            class="ml-3 hidden border-l border-[var(--color-line-strong)] pl-3 text-[13px] text-[var(--color-muted)] sm:block"
          >
            {{ currentGroup.name }}
          </span>
        </template>
        <template v-else-if="currentGroupId">
          <span class="text-sm font-semibold text-[var(--color-ink)]">{{
            currentGroup?.name ?? '...'
          }}</span>
        </template>
        <template v-else>
          <span class="text-sm font-semibold text-[var(--color-ink)]">스터디 그룹</span>
        </template>

        <div class="ml-auto flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 xl:px-[30px] 2xl:px-[60px]">
        <slot />
      </div>
    </div>
  </div>

  <!-- 새 그룹 팝오버 -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 -translate-x-1"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showCreateMenu"
        class="fixed z-50 w-44 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-1.5 shadow-[var(--shadow-strong)]"
        :style="{ top: `${createMenuPos.top}px`, left: `${createMenuPos.left}px` }"
        @click.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[var(--radius-button)] px-3 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
          @click="goCreateGroup"
        >
          <svg
            class="h-4 w-4 text-[var(--color-primary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          방 생성하기
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-[var(--radius-button)] px-3 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)]"
          @click="openJoinModal"
        >
          <svg
            class="h-4 w-4 text-[var(--color-info)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          코드로 참여하기
        </button>
      </div>
    </Transition>
  </Teleport>

  <!-- 코드로 참여하기 모달 -->
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
        v-if="showJoinModal"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-modal-title"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showJoinModal = false" />
        <div
          class="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-strong)]"
        >
          <div class="flex items-start justify-between gap-3">
            <h2 id="join-modal-title" class="text-lg font-bold text-[var(--color-ink)]">
              코드로 참여하기
            </h2>
            <button
              type="button"
              class="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
              aria-label="닫기"
              @click="showJoinModal = false"
            >
              ✕
            </button>
          </div>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            방장에게 받은 초대 코드를 입력하세요.
          </p>

          <input
            v-model="joinCode"
            type="text"
            placeholder="초대 코드 입력"
            class="mt-4 h-12 w-full rounded-[var(--radius-input)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(25,195,125,0.12)]"
            @keydown.enter.prevent="submitJoin"
          />

          <p class="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <svg
              class="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            코드는 그룹의 팀원 화면에서 복사할 수 있어요.
          </p>

          <p
            v-if="joinError"
            role="alert"
            class="mt-2 text-sm font-semibold text-[var(--color-danger)]"
          >
            {{ joinError }}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              type="button"
              :disabled="isJoining"
              class="inline-flex h-11 w-28 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] disabled:opacity-50"
              @click="showJoinModal = false"
            >
              취소
            </button>
            <button
              type="button"
              :disabled="isJoining || !joinCode.trim()"
              class="inline-flex h-11 flex-1 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] text-sm font-bold text-white transition hover:bg-[var(--color-primary-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              @click="submitJoin"
            >
              {{ isJoining ? '참여 중…' : '참여하기' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
