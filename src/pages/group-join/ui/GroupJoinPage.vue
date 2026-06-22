<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { joinGroupByInviteCode, useGroupListStore } from '@/entities/group'
import { ApiError } from '@/shared/api'

type GroupJoinForm = {
  inviteCode: string
}

const route = useRoute()
const router = useRouter()
const groupListStore = useGroupListStore()

const form = reactive<GroupJoinForm>({
  inviteCode: getInitialInviteCode(),
})

const isSubmitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})

async function submitJoin(): Promise<void> {
  errorMessage.value = ''

  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    const member = await joinGroupByInviteCode(form.inviteCode.trim())
    void groupListStore.loadGroups()
    await router.replace({
      name: 'group-onboarding',
      params: {
        groupId: member.groupId,
      },
    })
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : '그룹에 참여하지 못했어요. 초대 코드를 확인해 주세요.'
  } finally {
    isSubmitting.value = false
  }
}

function validateForm(): boolean {
  const errors: Record<string, string> = {}

  if (!form.inviteCode.trim()) {
    errors.inviteCode = '초대 코드를 입력해주세요.'
  }

  fieldErrors.value = errors

  return Object.keys(errors).length === 0
}

function getInitialInviteCode(): string {
  const inviteCode = route.query.inviteCode ?? route.query.code

  return typeof inviteCode === 'string' ? inviteCode : ''
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-3xl px-6 py-10">
    <header class="border-b border-[var(--color-line)] pb-6">
      <RouterLink
        :to="{ name: 'groups' }"
        class="inline-flex h-9 items-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-input)] px-3 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.16)]"
      >
        그룹 목록
      </RouterLink>
      <p class="mt-5 text-sm font-semibold text-[var(--color-primary)]">스터디 그룹</p>
      <h1 class="mt-2 text-3xl font-bold text-[var(--color-ink)]">초대 코드로 참여</h1>
      <p class="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        그룹장에게 받은 초대 코드를 입력하면 온보딩 단계로 이동합니다.
      </p>
    </header>

    <form class="mt-8 grid gap-6" @submit.prevent="submitJoin">
      <section
        class="grid gap-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-soft)]"
      >
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
        class="rounded-lg border border-[rgba(237,66,69,0.3)] bg-[rgba(237,66,69,0.1)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
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
