<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getGroup, getGroupStatusLabel, listGroupMembers, type GroupMember, type StudyGroup } from '@/entities/group'
import { getMyOnboarding } from '@/entities/onboarding'
import { LogoutButton } from '@/features/auth/logout'
import { LogoutAllButton } from '@/features/auth/logout-all'
import { useSessionStore } from '@/features/auth/session'
import { ApiError } from '@/shared/api'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

type WorkspaceNavItem = {
  routeName: string
  label: string
  detail: string
}

const route = useRoute()
const sessionStore = useSessionStore()

const groupId = computed(() => String(route.params.groupId ?? ''))
const shortGroupId = computed(() => groupId.value.slice(-8).toUpperCase())
const group = ref<StudyGroup | null>(null)
const isGroupLoading = ref(false)
const groupErrorMessage = ref('')
const myOnboardingSubmitted = ref(false)
const members = ref<GroupMember[]>([])

const showOnboarding = computed(() => {
  if (!group.value) return false
  if (group.value.status === 'ACTIVE' || group.value.status === 'COMPLETED' || group.value.status === 'ARCHIVED') {
    return false
  }
  return !myOnboardingSubmitted.value
})

const baseNavItems: WorkspaceNavItem[] = [
  {
    routeName: 'group-overview',
    label: '홈',
    detail: '그룹 흐름',
  },
  {
    routeName: 'group-todo',
    label: 'Todo',
    detail: '주차별 학습',
  },
  {
    routeName: 'group-ai',
    label: 'AI 팀장',
    detail: '대화',
  },
  {
    routeName: 'group-notifications',
    label: '알림',
    detail: '활동',
  },
  {
    routeName: 'group-board',
    label: '게시판',
    detail: '공지·토론',
  },
  {
    routeName: 'group-rules',
    label: '규칙',
    detail: '운영',
  },
  {
    routeName: 'group-my',
    label: '마이페이지',
    detail: '내 정보',
  },
]

const navItems = computed<WorkspaceNavItem[]>(() => {
  if (!showOnboarding.value) return baseNavItems

  return [
    baseNavItems[0],
    {
      routeName: 'group-onboarding',
      label: '온보딩',
      detail: '준비도',
    },
    ...baseNavItems.slice(1),
  ]
})

watch(
  groupId,
  () => {
    void loadGroup()
  },
  { immediate: true },
)

provide(groupWorkspaceContextKey, {
  groupId,
  group,
  isGroupLoading,
  groupErrorMessage,
  reloadGroup: loadGroup,
  members,
})

async function loadGroup(): Promise<void> {
  if (!groupId.value) {
    return
  }

  isGroupLoading.value = true
  groupErrorMessage.value = ''
  group.value = null

  try {
    group.value = await getGroup(groupId.value)
    void loadSidebarData()
  } catch (error) {
    groupErrorMessage.value =
      error instanceof ApiError ? error.message : '그룹 정보를 불러오지 못했습니다.'
  } finally {
    isGroupLoading.value = false
  }
}

async function loadSidebarData(): Promise<void> {
  await Promise.allSettled([loadMyOnboardingStatus(), loadMembers()])
}

async function loadMyOnboardingStatus(): Promise<void> {
  try {
    const onboarding = await getMyOnboarding(groupId.value)
    myOnboardingSubmitted.value = onboarding.status === 'SUBMITTED'
  } catch {
    myOnboardingSubmitted.value = false
  }
}

async function loadMembers(): Promise<void> {
  try {
    members.value = await listGroupMembers(groupId.value)
  } catch {
    members.value = []
  }
}

function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <main class="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <header
        class="rounded-lg border border-[var(--color-line)] bg-white/85 p-5 shadow-[var(--shadow-soft)]"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <RouterLink
              :to="{ name: 'groups' }"
              class="inline-flex h-9 items-center rounded-md border border-[var(--color-line)] bg-white px-3 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
            >
              그룹 목록
            </RouterLink>
            <div class="mt-4">
              <p class="text-sm font-semibold text-[var(--color-primary)]">
                {{ group?.topic ?? 'StudyPot' }}
              </p>
              <h1 class="mt-1 text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
                {{ group?.name ?? '그룹 워크스페이스' }}
              </h1>
              <div class="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span
                  v-if="isGroupLoading"
                  class="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-[var(--color-muted)]"
                >
                  그룹 정보 확인 중
                </span>
                <span
                  v-if="group"
                  class="rounded-md bg-[var(--color-card)] px-2.5 py-1 text-[var(--color-primary-deep)]"
                >
                  {{ getGroupStatusLabel(group.status) }}
                </span>
                <span
                  v-if="group"
                  class="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-[var(--color-muted)]"
                >
                  {{ formatDateRange(group.startsAt, group.endsAt) }}
                </span>
                <span
                  v-if="group"
                  class="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-[var(--color-muted)]"
                >
                  초대 코드 {{ group.inviteCode }}
                </span>
                <span
                  v-if="!group && !isGroupLoading"
                  class="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-[var(--color-muted)]"
                >
                  {{ shortGroupId || groupId }}
                </span>
              </div>
              <p
                v-if="groupErrorMessage"
                role="alert"
                class="mt-3 text-sm font-semibold text-red-700"
              >
                {{ groupErrorMessage }}
              </p>
            </div>
          </div>

          <div
            v-if="sessionStore.user"
            class="grid gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-sm"
          >
            <div>
              <p class="font-semibold text-[var(--color-ink)]">{{ sessionStore.user.nickname }}</p>
              <p class="mt-1 text-[var(--color-muted)]">{{ sessionStore.user.email }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <LogoutButton />
              <LogoutAllButton />
            </div>
          </div>
        </div>
      </header>

      <div class="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          class="rounded-lg border border-[var(--color-line)] bg-white/85 p-3 shadow-[var(--shadow-soft)]"
        >
          <nav class="grid gap-1" aria-label="그룹 기능">
            <RouterLink
              v-for="item in navItems"
              :key="item.routeName"
              :to="{ name: item.routeName, params: { groupId } }"
              class="grid min-h-14 rounded-md px-3 py-2 text-sm transition hover:bg-[var(--color-card)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
              active-class="bg-[var(--color-card)] text-[var(--color-primary-deep)]"
            >
              <span class="font-semibold">{{ item.label }}</span>
              <span class="text-xs text-[var(--color-muted)]">{{ item.detail }}</span>
            </RouterLink>
          </nav>
        </aside>

        <section class="min-w-0">
          <RouterView />
        </section>
      </div>
    </div>
  </main>
</template>
