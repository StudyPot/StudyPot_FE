<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { listFollowers, listFollowing, toggleFollow, type FollowUser } from '@/entities/follow'
import { ApiError } from '@/shared/api'
import { ScreenState } from '@/shared/ui'

type Tab = 'following' | 'followers'
type PageState = 'loading' | 'loaded' | 'error'

const activeTab = ref<Tab>('following')
const pageState = ref<PageState>('loading')
const errorMessage = ref('')

const followingList = ref<FollowUser[]>([])
const followerList = ref<FollowUser[]>([])
const togglingUserIds = ref(new Set<string>())

onMounted(() => {
  void loadAll()
})

async function loadAll(): Promise<void> {
  pageState.value = 'loading'
  errorMessage.value = ''
  try {
    const [following, followers] = await Promise.all([listFollowing(), listFollowers()])
    followingList.value = following
    followerList.value = followers
    pageState.value = 'loaded'
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '목록을 불러오지 못했습니다.'
    pageState.value = 'error'
  }
}

async function handleToggle(userId: string): Promise<void> {
  if (togglingUserIds.value.has(userId)) return
  togglingUserIds.value.add(userId)
  try {
    const result = await toggleFollow(userId)

    if (!result.following) {
      // 언팔 → 팔로잉 목록에서 제거, 팔로워 목록의 mutual 갱신
      followingList.value = followingList.value.filter((u) => u.userId !== userId)
      followerList.value = followerList.value.map((u) =>
        u.userId === userId ? { ...u, mutual: false } : u,
      )
    } else {
      // 팔로우 → 팔로워 목록의 mutual 갱신
      followerList.value = followerList.value.map((u) =>
        u.userId === userId ? { ...u, mutual: true } : u,
      )
    }
  } catch {
    // 토글 실패 시 상태 유지
  } finally {
    togglingUserIds.value.delete(userId)
  }
}

function isFollowing(userId: string): boolean {
  return followingList.value.some((u) => u.userId === userId)
}
</script>

<template>
  <div class="grid gap-4">
    <!-- 헤더 -->
    <div>
      <h2 class="text-lg font-bold text-[var(--color-ink)]">팔로우</h2>
      <p class="mt-0.5 text-sm text-[var(--color-muted)]">팔로잉·팔로워 목록을 확인하세요.</p>
    </div>

    <!-- 탭 -->
    <div class="flex border-b border-[var(--color-line)]" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'following'"
        :class="[
          'px-4 py-2.5 text-sm font-semibold transition focus:outline-none',
          activeTab === 'following'
            ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
            : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
        ]"
        @click="activeTab = 'following'"
      >
        팔로잉
        <span
          v-if="pageState === 'loaded'"
          class="ml-1.5 rounded-full bg-[var(--color-active)] px-1.5 py-0.5 text-xs"
        >
          {{ followingList.length }}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'followers'"
        :class="[
          'px-4 py-2.5 text-sm font-semibold transition focus:outline-none',
          activeTab === 'followers'
            ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
            : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
        ]"
        @click="activeTab = 'followers'"
      >
        팔로워
        <span
          v-if="pageState === 'loaded'"
          class="ml-1.5 rounded-full bg-[var(--color-active)] px-1.5 py-0.5 text-xs"
        >
          {{ followerList.length }}
        </span>
      </button>
    </div>

    <ScreenState
      v-if="pageState === 'loading'"
      variant="loading"
      title="목록을 불러오는 중입니다."
      description="잠시만 기다려 주세요."
    />

    <ScreenState
      v-else-if="pageState === 'error'"
      variant="error"
      title="목록을 불러오지 못했습니다."
      :description="errorMessage"
      action-label="다시 시도"
      @action="loadAll"
    />

    <template v-else>
      <!-- 팔로잉 탭 -->
      <template v-if="activeTab === 'following'">
        <ScreenState
          v-if="followingList.length === 0"
          variant="empty"
          title="팔로잉 중인 사용자가 없어요."
          description="다른 사용자를 팔로우하면 여기에 나타나요."
        />
        <ul v-else class="grid gap-3">
          <li
            v-for="user in followingList"
            :key="user.userId"
            class="flex items-center gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-[var(--color-ink)]">{{ user.nickname }}</span>
                <span
                  v-if="user.mutual"
                  class="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-white"
                >
                  맞팔
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-[var(--color-muted)]">{{ user.email }}</p>
              <p v-if="user.bio" class="mt-1 truncate text-sm text-[var(--color-muted)]">
                {{ user.bio }}
              </p>
            </div>
            <button
              type="button"
              :aria-label="`${user.nickname} 언팔로우`"
              :disabled="togglingUserIds.has(user.userId)"
              class="shrink-0 inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
              @click="handleToggle(user.userId)"
            >
              {{ togglingUserIds.has(user.userId) ? '처리 중…' : '언팔로우' }}
            </button>
          </li>
        </ul>
      </template>

      <!-- 팔로워 탭 -->
      <template v-else>
        <ScreenState
          v-if="followerList.length === 0"
          variant="empty"
          title="팔로워가 없어요."
          description="아직 나를 팔로우한 사용자가 없어요."
        />
        <ul v-else class="grid gap-3">
          <li
            v-for="user in followerList"
            :key="user.userId"
            class="flex items-center gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-[var(--color-ink)]">{{ user.nickname }}</span>
                <span
                  v-if="user.mutual"
                  class="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-white"
                >
                  맞팔
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-[var(--color-muted)]">{{ user.email }}</p>
              <p v-if="user.bio" class="mt-1 truncate text-sm text-[var(--color-muted)]">
                {{ user.bio }}
              </p>
            </div>
            <button
              v-if="!isFollowing(user.userId)"
              type="button"
              :aria-label="`${user.nickname} 팔로우`"
              :disabled="togglingUserIds.has(user.userId)"
              class="shrink-0 inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
              @click="handleToggle(user.userId)"
            >
              {{ togglingUserIds.has(user.userId) ? '처리 중…' : '팔로우' }}
            </button>
            <span
              v-else
              class="shrink-0 rounded-full bg-[var(--color-active)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]"
            >
              팔로잉 중
            </span>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
