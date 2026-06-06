<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { joinGroup } from '@/entities/group'
import { ApiError } from '@/shared/api'

type GroupJoinForm = {
  groupReference: string
  inviteCode: string
}

const uuidPatternText =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const uuidPattern = new RegExp(`^${uuidPatternText}$`, 'i')
const groupPathPattern = new RegExp(`/groups/(${uuidPatternText})(?:/|$)`, 'i')

const route = useRoute()
const router = useRouter()

const form = reactive<GroupJoinForm>({
  groupReference: getInitialGroupReference(),
  inviteCode: getInitialInviteCode(),
})

const isSubmitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})

async function submitJoin(): Promise<void> {
  errorMessage.value = ''
  const groupId = validateForm()

  if (!groupId) {
    return
  }

  isSubmitting.value = true

  try {
    const member = await joinGroup(groupId, {
      inviteCode: form.inviteCode.trim(),
    })
    await router.replace({
      name: 'group-onboarding',
      params: {
        groupId: member.groupId,
      },
    })
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹에 참여하지 못했습니다. 다시 시도해주세요.'
  } finally {
    isSubmitting.value = false
  }
}

function validateForm(): string | null {
  const errors: Record<string, string> = {}
  const groupId = extractGroupId(form.groupReference)

  if (!groupId) {
    errors.groupReference = '초대 링크 또는 그룹 ID를 확인해주세요.'
  }

  if (!form.inviteCode.trim()) {
    errors.inviteCode = '초대 코드를 입력해주세요.'
  }

  fieldErrors.value = errors

  return Object.keys(errors).length === 0 ? groupId : null
}

function getInitialGroupReference(): string {
  const groupId = route.params.groupId

  return typeof groupId === 'string' ? groupId : ''
}

function getInitialInviteCode(): string {
  const inviteCode = route.query.inviteCode ?? route.query.code

  return typeof inviteCode === 'string' ? inviteCode : ''
}

function extractGroupId(value: string): string | null {
  const trimmedValue = value.trim()

  if (uuidPattern.test(trimmedValue)) {
    return trimmedValue
  }

  try {
    const url = new URL(trimmedValue, 'http://studypot.local')
    const queryGroupId = url.searchParams.get('groupId')

    if (queryGroupId && uuidPattern.test(queryGroupId)) {
      return queryGroupId
    }

    const pathGroupId = groupPathPattern.exec(url.pathname)?.[1]

    return pathGroupId && uuidPattern.test(pathGroupId) ? pathGroupId : null
  } catch {
    return null
  }
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-3xl px-6 py-10">
    <header class="border-b border-[var(--color-line)] pb-6">
      <RouterLink
        :to="{ name: 'groups' }"
        class="inline-flex h-9 items-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
      >
        그룹 목록
      </RouterLink>
      <p class="mt-5 text-sm font-semibold text-[var(--color-primary)]">스터디 그룹</p>
      <h1 class="mt-2 text-3xl font-bold text-[var(--color-ink)]">초대 코드로 참여</h1>
      <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        공유받은 초대 링크나 그룹 ID와 초대 코드를 입력하면 온보딩 단계로 이동합니다.
      </p>
    </header>

    <form class="mt-8 grid gap-6" @submit.prevent="submitJoin">
      <section
        class="grid gap-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">초대 링크 또는 그룹 ID</span>
          <input
            v-model="form.groupReference"
            name="groupReference"
            type="text"
            class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            placeholder="https://studypot.dev/groups/{groupId}/join"
          />
          <span class="text-xs text-[var(--color-muted)]">
            초대 링크를 받았다면 그대로 붙여넣을 수 있습니다.
          </span>
          <span v-if="fieldErrors.groupReference" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.groupReference }}
          </span>
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-[var(--color-ink)]">초대 코드</span>
          <input
            v-model="form.inviteCode"
            name="inviteCode"
            type="text"
            class="h-11 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[rgba(54,92,255,0.12)]"
            placeholder="SPRING-AB12"
          />
          <span v-if="fieldErrors.inviteCode" class="text-xs font-semibold text-[var(--color-danger)]">
            {{ fieldErrors.inviteCode }}
          </span>
        </label>
      </section>

      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
      >
        {{ errorMessage }}
      </p>

      <div class="flex flex-wrap justify-end gap-3">
        <RouterLink
          :to="{ name: 'groups' }"
          class="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-active)] px-5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
        >
          취소
        </RouterLink>
        <button
          type="submit"
          class="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '참여 중' : '그룹 참여' }}
        </button>
      </div>
    </form>
  </main>
</template>
