<script setup lang="ts">
import { inject, onMounted, reactive, ref } from 'vue'

import {
  deactivateRule,
  deleteRule,
  listRules,
  listViolations,
  resolveViolation,
  saveRule,
  waiveViolation,
  type GroupRule,
  type GroupRuleType,
  type RuleViolation,
  type RuleViolationStatus,
  type RuleViolationType,
} from '@/entities/rule'
import { ApiError } from '@/shared/api'
import type { JsonObject } from '@/shared/model/json'
import { ScreenState } from '@/shared/ui'
import { groupWorkspaceContextKey } from '../model/workspaceContext'

const RULE_TYPE_LABEL: Record<GroupRuleType, string> = {
  TASK_DEADLINE: '과제 마감',
  RETROSPECTIVE_REQUIRED: '회고 필수',
  CUSTOM_NOTE: '커스텀',
}

const VIOLATION_TYPE_LABEL: Record<RuleViolationType, string> = {
  INCOMPLETE_REASON_MISSING: '미완료 사유 누락',
  RETROSPECTIVE_MISSING: '회고 미제출',
  CUSTOM: '직접 입력',
}

const VIOLATION_STATUS_LABEL: Record<RuleViolationStatus, string> = {
  OPEN: '미처리',
  RESOLVED: '해결됨',
  WAIVED: '면제됨',
}

const DEFAULT_CONFIG: Record<GroupRuleType, JsonObject> = {
  TASK_DEADLINE: { graceHours: 24, requiredTaskOnly: true },
  RETROSPECTIVE_REQUIRED: { required: true },
  CUSTOM_NOTE: { note: '' },
}

const NOTE_MAX_LENGTH = 500

type Tab = 'rules' | 'violations'
type LoadState = 'loading' | 'loaded' | 'error'

const workspaceContext = inject(groupWorkspaceContextKey)

if (!workspaceContext) {
  throw new Error('GroupRulesPage must be used inside GroupWorkspacePage.')
}

const { groupId } = workspaceContext

const activeTab = ref<Tab>('rules')

// 규칙 목록
const rules = ref<GroupRule[]>([])
const rulesState = ref<LoadState>('loading')
const rulesError = ref('')
const actionError = reactive<Record<string, string>>({})
const pendingRuleId = ref<string | null>(null)

// 규칙 저장 폼
const showSaveForm = ref(false)
const saveForm = reactive({
  ruleType: 'TASK_DEADLINE' as GroupRuleType,
  description: '',
})
const isSaving = ref(false)
const saveError = ref('')

// 위반 목록
const violations = ref<RuleViolation[]>([])
const violationsState = ref<LoadState>('loading')
const violationsError = ref('')
const expandedViolationId = ref<string | null>(null)
const violationNote = reactive<Record<string, string>>({})
const pendingViolationId = ref<string | null>(null)
const violationActionError = reactive<Record<string, string>>({})

onMounted(() => {
  void loadRules()
})

function switchTab(tab: Tab): void {
  activeTab.value = tab

  if (tab === 'violations' && violationsState.value === 'loading') {
    void loadViolations()
  }
}

async function loadRules(): Promise<void> {
  rulesState.value = 'loading'
  rulesError.value = ''

  try {
    rules.value = await listRules(groupId.value)
    rulesState.value = 'loaded'
  } catch (error) {
    rulesError.value = error instanceof ApiError ? error.message : '규칙을 불러오지 못했습니다.'
    rulesState.value = 'error'
  }
}

async function loadViolations(): Promise<void> {
  violationsState.value = 'loading'
  violationsError.value = ''

  try {
    violations.value = await listViolations(groupId.value)
    violationsState.value = 'loaded'
  } catch (error) {
    violationsError.value =
      error instanceof ApiError ? error.message : '위반 기록을 불러오지 못했습니다.'
    violationsState.value = 'error'
  }
}

async function handleDeactivate(rule: GroupRule): Promise<void> {
  pendingRuleId.value = rule.id
  delete actionError[rule.id]

  try {
    await deactivateRule(groupId.value, rule.id)
    const index = rules.value.findIndex((r) => r.id === rule.id)

    if (index !== -1) {
      rules.value[index] = { ...rules.value[index]!, active: false }
    }
  } catch (error) {
    actionError[rule.id] = toErrorMessage(error, '비활성화에 실패했습니다.')
  } finally {
    pendingRuleId.value = null
  }
}

async function handleDelete(rule: GroupRule): Promise<void> {
  pendingRuleId.value = rule.id
  delete actionError[rule.id]

  try {
    await deleteRule(groupId.value, rule.id)
    rules.value = rules.value.filter((r) => r.id !== rule.id)
  } catch (error) {
    actionError[rule.id] = toErrorMessage(error, '삭제에 실패했습니다.')
  } finally {
    pendingRuleId.value = null
  }
}

async function handleSaveRule(): Promise<void> {
  isSaving.value = true
  saveError.value = ''

  try {
    const saved = await saveRule(groupId.value, saveForm.ruleType, {
      config: DEFAULT_CONFIG[saveForm.ruleType],
      description: saveForm.description || undefined,
      active: true,
    })

    const index = rules.value.findIndex((r) => r.ruleType === saved.ruleType)

    if (index !== -1) {
      rules.value[index] = saved
    } else {
      rules.value.push(saved)
    }

    showSaveForm.value = false
    saveForm.description = ''
  } catch (error) {
    saveError.value = toErrorMessage(error, '규칙 저장에 실패했습니다.')
  } finally {
    isSaving.value = false
  }
}

function toggleViolationExpand(violationId: string): void {
  expandedViolationId.value =
    expandedViolationId.value === violationId ? null : violationId
}

async function handleResolve(violation: RuleViolation): Promise<void> {
  pendingViolationId.value = violation.id
  delete violationActionError[violation.id]

  try {
    const updated = await resolveViolation(groupId.value, violation.id, {
      note: violationNote[violation.id] || undefined,
    })

    updateViolation(updated)
    expandedViolationId.value = null
  } catch (error) {
    violationActionError[violation.id] = toErrorMessage(error, '해결 처리에 실패했습니다.')
  } finally {
    pendingViolationId.value = null
  }
}

async function handleWaive(violation: RuleViolation): Promise<void> {
  pendingViolationId.value = violation.id
  delete violationActionError[violation.id]

  try {
    const updated = await waiveViolation(groupId.value, violation.id, {
      note: violationNote[violation.id] || undefined,
    })

    updateViolation(updated)
    expandedViolationId.value = null
  } catch (error) {
    violationActionError[violation.id] = toErrorMessage(error, '면제 처리에 실패했습니다.')
  } finally {
    pendingViolationId.value = null
  }
}

function updateViolation(updated: RuleViolation): void {
  const index = violations.value.findIndex((v) => v.id === updated.id)

  if (index !== -1) {
    violations.value[index] = updated
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return '그룹장 권한이 필요합니다.'
    }

    if (error.status === 404) {
      return '대상을 찾을 수 없습니다.'
    }

    if (error.status === 409) {
      return '이미 처리된 항목입니다.'
    }

    return error.message
  }

  return fallback
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function shortId(value: string): string {
  return value.slice(-8).toUpperCase()
}
</script>

<template>
  <div class="grid gap-5">
    <section
      class="rounded-lg border border-[var(--color-line)] bg-white/85 shadow-[var(--shadow-soft)]"
    >
      <div class="px-5 pt-5">
        <p class="text-sm font-semibold text-[var(--color-primary)]">규칙</p>
        <p class="mt-1 text-xs text-[var(--color-muted)]">그룹 운영 규칙과 위반 내역을 관리합니다.</p>
      </div>

      <!-- 탭 -->
      <nav class="mt-4 flex border-b border-[var(--color-line)]" aria-label="규칙 탭">
        <button
          v-for="tab in ([{ id: 'rules', label: '규칙 목록' }, { id: 'violations', label: '위반 기록' }] as const)"
          :key="tab.id"
          type="button"
          :class="[
            'relative px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[rgba(54,92,255,0.2)]',
            activeTab === tab.id
              ? 'text-[var(--color-primary-deep)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-primary)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
          ]"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- 규칙 목록 탭 -->
      <div v-if="activeTab === 'rules'" class="p-5">
        <ScreenState
          v-if="rulesState === 'loading'"
          variant="loading"
          title="규칙을 불러오는 중입니다."
        />

        <ScreenState
          v-else-if="rulesState === 'error'"
          variant="error"
          title="규칙을 불러오지 못했습니다."
          :description="rulesError"
          action-label="다시 시도"
          @action="loadRules"
        />

        <template v-else>
          <!-- 규칙 추가 폼 -->
          <div class="mb-5">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-line)] bg-white px-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
              @click="showSaveForm = !showSaveForm"
            >
              {{ showSaveForm ? '닫기' : '+ 규칙 추가' }}
            </button>

            <form
              v-if="showSaveForm"
              class="mt-4 grid gap-4 rounded-md border border-[var(--color-line)] bg-[var(--color-card)] p-4"
              @submit.prevent="handleSaveRule"
            >
              <div>
                <label class="text-sm font-semibold text-[var(--color-ink)]" for="ruleType">
                  규칙 유형
                </label>
                <select
                  id="ruleType"
                  v-model="saveForm.ruleType"
                  class="mt-2 w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
                >
                  <option
                    v-for="(label, type) in RULE_TYPE_LABEL"
                    :key="type"
                    :value="type"
                  >
                    {{ label }}
                  </option>
                </select>
              </div>

              <div>
                <label class="text-sm font-semibold text-[var(--color-ink)]" for="ruleDesc">
                  설명 <span class="font-normal text-[var(--color-muted)]">(선택)</span>
                </label>
                <textarea
                  id="ruleDesc"
                  v-model="saveForm.description"
                  rows="2"
                  class="mt-2 w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.14)]"
                />
              </div>

              <p v-if="saveError" role="alert" class="text-sm font-semibold text-red-700">
                {{ saveError }}
              </p>

              <button
                type="submit"
                :disabled="isSaving"
                class="inline-flex h-10 w-fit items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
              >
                {{ isSaving ? '저장 중…' : '규칙 저장' }}
              </button>
            </form>
          </div>

          <!-- 규칙 목록 -->
          <ul v-if="rules.length > 0" class="grid gap-3">
            <li
              v-for="rule in rules"
              :key="rule.id"
              class="rounded-md border border-[var(--color-line)] bg-white p-4"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded border border-[var(--color-line)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
                      {{ RULE_TYPE_LABEL[rule.ruleType] }}
                    </span>
                    <span
                      :class="[
                        'rounded px-2 py-0.5 text-xs font-semibold',
                        rule.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-[var(--color-card)] text-[var(--color-muted)]',
                      ]"
                    >
                      {{ rule.active ? '활성' : '비활성' }}
                    </span>
                  </div>

                  <p v-if="rule.description" class="mt-2 text-sm leading-6 text-[var(--color-ink)]">
                    {{ rule.description }}
                  </p>

                  <p class="mt-1 text-xs text-[var(--color-muted)]">
                    업데이트: {{ formatDateTime(rule.updatedAt) }}
                  </p>
                </div>

                <div class="flex shrink-0 gap-2">
                  <button
                    v-if="rule.active"
                    type="button"
                    :disabled="pendingRuleId === rule.id"
                    class="inline-flex h-8 items-center rounded border border-[var(--color-line)] bg-white px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:border-amber-400 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
                    @click="handleDeactivate(rule)"
                  >
                    비활성화
                  </button>

                  <button
                    type="button"
                    :disabled="pendingRuleId === rule.id"
                    class="inline-flex h-8 items-center rounded border border-[var(--color-line)] bg-white px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:border-red-400 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
                    @click="handleDelete(rule)"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <p v-if="actionError[rule.id]" role="alert" class="mt-2 text-xs font-semibold text-red-700">
                {{ actionError[rule.id] }}
              </p>
            </li>
          </ul>

          <p v-else class="text-sm text-[var(--color-muted)]">등록된 규칙이 없습니다.</p>
        </template>
      </div>

      <!-- 위반 기록 탭 -->
      <div v-else-if="activeTab === 'violations'" class="p-5">
        <ScreenState
          v-if="violationsState === 'loading'"
          variant="loading"
          title="위반 기록을 불러오는 중입니다."
        />

        <ScreenState
          v-else-if="violationsState === 'error'"
          variant="error"
          title="위반 기록을 불러오지 못했습니다."
          :description="violationsError"
          action-label="다시 시도"
          @action="loadViolations"
        />

        <template v-else>
          <ul v-if="violations.length > 0" class="grid gap-3">
            <li
              v-for="violation in violations"
              :key="violation.id"
              class="rounded-md border border-[var(--color-line)] bg-white p-4"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded border border-[var(--color-line)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
                      {{ VIOLATION_TYPE_LABEL[violation.violationType] }}
                    </span>
                    <span
                      :class="[
                        'rounded px-2 py-0.5 text-xs font-semibold',
                        violation.status === 'OPEN'
                          ? 'bg-red-50 text-red-700'
                          : violation.status === 'RESOLVED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-[var(--color-card)] text-[var(--color-muted)]',
                      ]"
                    >
                      {{ VIOLATION_STATUS_LABEL[violation.status] }}
                    </span>
                  </div>

                  <p class="mt-2 text-sm text-[var(--color-ink)]">
                    멤버 <span class="font-semibold">{{ shortId(violation.memberId) }}</span>
                  </p>

                  <p class="mt-1 text-xs text-[var(--color-muted)]">
                    발생: {{ formatDateTime(violation.occurredAt) }}
                  </p>

                  <p
                    v-if="violation.resolvedNote"
                    class="mt-1 text-xs text-[var(--color-muted)]"
                  >
                    처리 메모: {{ violation.resolvedNote }}
                  </p>
                </div>

                <button
                  v-if="violation.status === 'OPEN'"
                  type="button"
                  class="shrink-0 inline-flex h-8 items-center rounded border border-[var(--color-line)] bg-white px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)]"
                  @click="toggleViolationExpand(violation.id)"
                >
                  {{ expandedViolationId === violation.id ? '닫기' : '처리' }}
                </button>
              </div>

              <!-- 해결/면제 액션 영역 -->
              <div
                v-if="expandedViolationId === violation.id && violation.status === 'OPEN'"
                class="mt-3 grid gap-3 rounded-md bg-[var(--color-card)] p-3"
              >
                <div>
                  <label
                    :for="`note-${violation.id}`"
                    class="text-xs font-semibold text-[var(--color-muted)]"
                  >
                    처리 메모 <span class="font-normal">(선택, 최대 {{ NOTE_MAX_LENGTH }}자)</span>
                  </label>
                  <textarea
                    :id="`note-${violation.id}`"
                    v-model="violationNote[violation.id]"
                    rows="2"
                    :maxlength="NOTE_MAX_LENGTH"
                    class="mt-1.5 w-full rounded border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.14)]"
                  />
                </div>

                <div class="flex gap-2">
                  <button
                    type="button"
                    :disabled="pendingViolationId === violation.id"
                    class="inline-flex h-8 items-center rounded-md bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
                    @click="handleResolve(violation)"
                  >
                    {{ pendingViolationId === violation.id ? '처리 중…' : '해결' }}
                  </button>
                  <button
                    type="button"
                    :disabled="pendingViolationId === violation.id"
                    class="inline-flex h-8 items-center rounded-md border border-[var(--color-line)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(54,92,255,0.2)] disabled:opacity-50"
                    @click="handleWaive(violation)"
                  >
                    면제
                  </button>
                </div>

                <p
                  v-if="violationActionError[violation.id]"
                  role="alert"
                  class="text-xs font-semibold text-red-700"
                >
                  {{ violationActionError[violation.id] }}
                </p>
              </div>
            </li>
          </ul>

          <p v-else class="text-sm text-[var(--color-muted)]">위반 기록이 없습니다.</p>
        </template>
      </div>
    </section>
  </div>
</template>
