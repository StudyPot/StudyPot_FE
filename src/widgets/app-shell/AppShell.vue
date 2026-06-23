<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getGroup, type StudyGroup, type StudyGroupStatus, useGroupListStore } from '@/entities/group'
import { getMyOnboarding } from '@/entities/onboarding'
import { useSessionStore } from '@/features/auth/session'
import { NotificationBell } from '@/features/notification'
import { apiOrigin } from '@/shared/config/api'
import { useTheme } from '@/shared/theme/useTheme'

type StatusPhase = 'before' | 'active' | 'done'
type ChannelDef = { routeName: string; label: string; type: 'home' | 'todo' | 'ai' | 'board' | 'person' | 'onboard' | 'review' }
type ChannelSection = { label: string; channels: ChannelDef[] }

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const groupListStore = useGroupListStore()

const currentGroupId = computed(() => String(route.params.groupId ?? ''))
const currentGroup = ref<StudyGroup | null>(null)
const myOnboardingSubmitted = ref(false)
const isLoggingOut = ref(false)
const showUserMenu = ref(false)

const loginNotice = computed(() => {
  if (route.query.error === 'oauth') return 'Google 로그인에 실패했습니다. 다시 시도해주세요.'
  if (route.query.signedOut === 'all') return '모든 기기에서 로그아웃되었습니다.'
  if (route.query.signedOut === 'current') return '로그아웃되었습니다.'
  return ''
})

const PUBLIC_CHANNELS: ChannelDef[] = [
  { routeName: 'group-overview', label: '홈',    type: 'home' },
  { routeName: 'group-board',    label: '게시판', type: 'board' },
  { routeName: 'group-my',       label: '팀원',   type: 'person' },
]

const PRIVATE_CHANNELS: ChannelDef[] = [
  { routeName: 'group-todo',   label: 'Todo',   type: 'todo' },
  { routeName: 'group-ai',     label: 'AI 팀장', type: 'ai' },
  { routeName: 'group-review', label: '회고',    type: 'review' },
]

const ONBOARD_CHANNEL: ChannelDef = { routeName: 'group-onboarding', label: '온보딩', type: 'onboard' }

const showOnboarding = computed(() => {
  if (!currentGroup.value) return false
  const s = currentGroup.value.status
  if (s === 'READY_TO_START' || s === 'ACTIVE' || s === 'COMPLETED' || s === 'ARCHIVED') return false
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
const { isDark, toggle: toggleTheme } = useTheme()

onMounted(() => {
  if (sessionStore.isAuthenticated) void groupListStore.loadGroups()
  document.addEventListener('click', closeUserMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeUserMenu)
})

watch(() => sessionStore.isAuthenticated, (ok) => {
  if (ok) void groupListStore.loadGroups()
  else groupListStore.clearGroups()
})

watch(currentGroupId, () => { void loadCurrentGroup() }, { immediate: true })

async function loadCurrentGroup(): Promise<void> {
  if (!currentGroupId.value) { currentGroup.value = null; return }
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
  const words = name.trim().split(/\s+/)
  return words.length >= 2
    ? (words[0]![0]! + words[1]![0]!).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function getStatusPhase(status: StudyGroupStatus): StatusPhase {
  if (status === 'ACTIVE') return 'active'
  if (status === 'COMPLETED' || status === 'ARCHIVED') return 'done'
  return 'before'
}

function getIconClasses(group: StudyGroup, isSelected: boolean): string {
  const base = 'flex h-12 w-12 items-center justify-center text-sm font-bold transition-colors duration-100'
  const phase = getStatusPhase(group.status)
  if (phase === 'active') {
    return isSelected
      ? `${base} rounded-2xl bg-[var(--color-primary)] text-white`
      : `${base} rounded-3xl bg-[var(--color-active)] text-[var(--color-muted)] group-hover:rounded-2xl group-hover:bg-[var(--color-primary)] group-hover:text-white`
  }
  if (phase === 'before') {
    return isDark.value
      ? isSelected
        ? `${base} rounded-2xl bg-[#3d2900] text-[#f0a04b]`
        : `${base} rounded-3xl bg-[#231800] text-[#6b4a1a] group-hover:rounded-2xl group-hover:bg-[#3d2900] group-hover:text-[#f0a04b]`
      : isSelected
        ? `${base} rounded-2xl bg-[#fde68a] text-[#92400e]`
        : `${base} rounded-3xl bg-[#fef3c7] text-[#d97706] group-hover:rounded-2xl group-hover:bg-[#fde68a] group-hover:text-[#92400e]`
  }
  return isDark.value
    ? isSelected
      ? `${base} rounded-2xl bg-[#282828] text-[#505050]`
      : `${base} rounded-3xl bg-[#1c1c1c] text-[#303030] group-hover:rounded-2xl group-hover:bg-[#282828] group-hover:text-[#505050]`
    : isSelected
      ? `${base} rounded-2xl bg-[#e5e7eb] text-[#9ca3af]`
      : `${base} rounded-3xl bg-[#f3f4f6] text-[#d1d5db] group-hover:rounded-2xl group-hover:bg-[#e5e7eb] group-hover:text-[#9ca3af]`
}

function getDotClass(status: StudyGroupStatus): string {
  const phase = getStatusPhase(status)
  if (phase === 'active') return 'bg-[var(--color-success)]'
  if (phase === 'before') return 'bg-[#e0953a]'
  return isDark.value ? 'bg-[#383838]' : 'bg-[#c0c4cc]'
}

function toggleUserMenu(event: Event): void {
  event.stopPropagation()
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu(): void {
  showUserMenu.value = false
}

async function handleLogout(): Promise<void> {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await sessionStore.logoutCurrentSession()
    await router.replace({ name: 'login', query: { signedOut: 'current' } })
  } finally {
    isLoggingOut.value = false
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
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
        <p class="text-xs font-medium tracking-wide text-[var(--color-primary)] uppercase">StudyPot</p>
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
        <svg aria-hidden="true" class="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.64 12.2045C21.64 11.5668 21.5827 10.9536 21.4764 10.3636H12V14.2577H17.4145C17.1814 15.5159 16.4723 16.5818 15.4064 17.2927V19.8182H18.6618C20.5673 18.0636 21.64 15.4773 21.64 12.2045Z" fill="#4285F4" />
          <path d="M12 22C14.72 22 17.0018 21.0982 18.6618 19.8182L15.4064 17.2927C14.5045 17.8982 13.3509 18.2577 12 18.2577C9.37636 18.2577 7.15273 16.4855 6.36 14.1027H2.99455V16.7109C4.64545 19.9891 8.03818 22 12 22Z" fill="#34A853" />
          <path d="M6.36 14.1027C6.15818 13.4973 6.04364 12.8509 6.04364 12.1818C6.04364 11.5127 6.15818 10.8664 6.36 10.2609V7.65273H2.99455C2.31545 9.00545 1.93091 10.5291 1.93091 12.1818C1.93091 13.8345 2.31545 15.3582 2.99455 16.7109L6.36 14.1027Z" fill="#FBBC05" />
          <path d="M12 6.10545C13.4745 6.10545 14.7982 6.61273 15.84 7.60909L18.7355 4.71364C16.9973 3.06091 14.7155 2 12 2C8.03818 2 4.64545 4.01091 2.99455 7.28909L6.36 9.89727C7.15273 7.51455 9.37636 5.74227 12 5.74227V6.10545Z" fill="#EA4335" />
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
  <div
    v-else
    class="flex h-full overflow-hidden"
  >
    <!-- ── Server rail (72px) ── -->
    <nav
      class="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-[var(--color-rail)] py-3"
      aria-label="스터디 그룹"
    >
      <!-- Home button -->
      <RouterLink
        :to="{ name: 'groups' }"
        class="group relative mb-1 flex shrink-0 items-center justify-center"
        title="전체 그룹"
      >
        <div
          :class="[
            'flex h-12 w-12 items-center justify-center bg-[var(--color-primary)] font-bold text-white transition-[border-radius] duration-100',
            !currentGroupId ? 'rounded-2xl text-sm' : 'rounded-3xl text-xs group-hover:rounded-2xl',
          ]"
        >
          SP
        </div>
        <div
          class="absolute -left-[13px] top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-white"
          :class="!currentGroupId ? 'h-10' : 'h-0 group-hover:h-5'"
          style="transition: height 100ms"
        />
      </RouterLink>

      <div class="mx-auto h-px w-8 bg-[var(--color-line-strong)]" />

      <!-- Group server icons (status-aware) -->
      <RouterLink
        v-for="group in groupListStore.groups"
        :key="group.id"
        :to="{ name: 'group-overview', params: { groupId: group.id } }"
        class="group relative flex shrink-0 items-center justify-center"
        :title="`${group.name} · ${statusLabel[group.status]}`"
      >
        <!-- Icon -->
        <div :class="getIconClasses(group, currentGroupId === group.id)">
          {{ getGroupInitials(group.name) }}
        </div>

        <!-- Status dot (bottom-right) -->
        <span
          :class="[
            'pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-rail)]',
            getDotClass(group.status),
          ]"
        />

        <!-- Selection pill -->
        <div
          class="absolute -left-[13px] top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-white"
          :class="currentGroupId === group.id ? 'h-10' : 'h-0 group-hover:h-5'"
          style="transition: height 100ms"
        />
      </RouterLink>

      <div class="mx-auto h-px w-8 bg-[var(--color-line-strong)]" />

      <!-- Create group -->
      <RouterLink
        :to="{ name: 'group-create' }"
        class="group flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-[var(--color-active)] text-[var(--color-success)] transition-[border-radius,background-color] duration-100 hover:rounded-2xl hover:bg-[var(--color-success)] hover:text-white"
        title="새 그룹 만들기"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </RouterLink>

      <!-- Join group -->
      <RouterLink
        :to="{ name: 'group-join' }"
        class="group flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-[var(--color-active)] text-[var(--color-muted)] transition-[border-radius,background-color] duration-100 hover:rounded-2xl hover:bg-[var(--color-primary)] hover:text-white"
        title="초대 코드로 참여"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </RouterLink>
    </nav>

    <!-- ── Channel panel (240px) ── -->
    <div class="flex w-60 shrink-0 flex-col overflow-hidden bg-[var(--color-panel)]">
      <!-- Panel header -->
      <div class="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-line)] px-3">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-[var(--color-ink)]">
            {{ currentGroup?.name ?? 'StudyPot' }}
          </p>
          <!-- Status badge for current group -->
          <p
            v-if="currentGroupPhase"
            :class="[
              'text-[10px] font-medium leading-none mt-0.5',
              currentGroupPhase === 'active' ? 'text-[var(--color-success)]' :
              currentGroupPhase === 'before' ? 'text-[#e0953a]' :
              'text-[var(--color-muted-deep)]',
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
              'group flex h-8 items-center gap-2 rounded px-2 text-sm transition-colors',
              ch.type === 'onboard'
                ? 'text-[#e0953a] hover:bg-[var(--color-hover)] hover:text-[#f0a04b]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]',
            ]"
            :exact-active-class="
              ch.type === 'onboard'
                ? 'bg-[var(--color-hover)] !text-[#f0a04b]'
                : 'bg-[var(--color-active)] !text-[var(--color-ink)]'
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
                <path d="M5.5 16.5l.75 2.25L8.5 19.5l-2.25.75-.75 2.25-.75-2.25L2.5 19.5l2.25-.75.75-2.25z" />
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
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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

        <!-- No group selected: simple links -->
        <template v-else>
          <p class="mb-1 mt-1 px-2 text-[11px] font-medium text-[var(--color-muted-deep)]">메뉴</p>
          <RouterLink
            :to="{ name: 'groups' }"
            class="flex h-8 items-center gap-2 rounded px-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
            active-class="bg-[var(--color-active)] !text-[var(--color-ink)]"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            <span>그룹 목록</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'group-create' }"
            class="flex h-8 items-center gap-2 rounded px-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
            active-class="bg-[var(--color-active)] !text-[var(--color-ink)]"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
            </svg>
            <span>새 그룹 만들기</span>
          </RouterLink>
          <RouterLink
            :to="{ name: 'group-join' }"
            class="flex h-8 items-center gap-2 rounded px-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
            active-class="bg-[var(--color-active)] !text-[var(--color-ink)]"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            <span>초대 코드로 참여</span>
          </RouterLink>
        </template>
      </nav>

      <!-- User menu popup -->
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="showUserMenu"
          class="border-t border-[var(--color-line)] px-2 py-1"
          @click.stop
        >
          <RouterLink
            :to="{ name: 'profile' }"
            class="flex h-8 items-center gap-2 rounded px-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
            active-class="bg-[var(--color-active)] !text-[var(--color-ink)]"
            @click="showUserMenu = false"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>내 프로필</span>
          </RouterLink>
        </div>
      </Transition>

      <!-- User panel -->
      <div
        class="flex h-[52px] shrink-0 cursor-pointer items-center gap-2 bg-[var(--color-rail)] px-2 transition-colors hover:bg-[var(--color-hover)]"
        role="button"
        tabindex="0"
        @click="toggleUserMenu"
        @keydown.enter="toggleUserMenu"
        @keydown.space.prevent="toggleUserMenu"
      >
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
          {{ userInitial }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium text-[var(--color-ink)]">
            {{ sessionStore.user?.nickname }}
          </p>
          <p class="truncate text-[10px] text-[var(--color-muted-deep)]">
            {{ sessionStore.user?.email }}
          </p>
        </div>
        <button
          type="button"
          :disabled="isLoggingOut"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-muted-deep)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-danger)] disabled:opacity-40"
          :title="isLoggingOut ? '로그아웃 중...' : '로그아웃'"
          @click.stop="handleLogout"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Main content ── -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <div class="flex h-12 shrink-0 items-center border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4">
        <template v-if="currentGroupId && activeChannelLabel">
          <svg
            class="mr-2 h-4 w-4 shrink-0 text-[var(--color-muted-deep)]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"
          >
            <template v-if="allChannels.find(c => c.routeName === String(route.name))?.type === 'home'">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </template>
            <template v-else-if="allChannels.find(c => c.routeName === String(route.name))?.type === 'ai'">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            </template>
            <template v-else>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </template>
          </svg>
          <span class="text-sm font-semibold text-[var(--color-ink)]">{{ activeChannelLabel }}</span>
          <span
            v-if="currentGroup"
            class="ml-3 hidden border-l border-[var(--color-line-strong)] pl-3 text-[13px] text-[var(--color-muted)] sm:block"
          >
            {{ currentGroup.name }}
          </span>
        </template>
        <template v-else-if="currentGroupId">
          <span class="text-sm font-semibold text-[var(--color-ink)]">{{ currentGroup?.name ?? '...' }}</span>
        </template>
        <template v-else>
          <span class="text-sm font-semibold text-[var(--color-ink)]">스터디 그룹</span>
        </template>

        <div class="ml-auto flex items-center gap-2">
          <!-- Theme toggle switch -->
          <button
            type="button"
            class="relative flex h-8 w-14 shrink-0 items-center rounded-full bg-[var(--color-active)] p-1 transition-colors duration-200"
            :title="isDark ? '라이트 모드로 전환' : '다크 모드로 전환'"
            @click="toggleTheme"
          >
            <!-- Sliding thumb -->
            <span
              class="absolute left-1 h-6 w-6 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200"
              :class="isDark ? 'translate-x-6' : 'translate-x-0'"
            />
            <!-- Sun icon (left = light mode) -->
            <span
              class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center transition-colors duration-200"
              :class="isDark ? 'text-[var(--color-muted-deep)]' : 'text-[var(--color-primary)]'"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
              </svg>
            </span>
            <!-- Moon icon (right = dark mode) -->
            <span
              class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center transition-colors duration-200"
              :class="isDark ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-deep)]'"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </span>
          </button>
          <NotificationBell />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <slot />
      </div>
    </div>
  </div>
</template>
