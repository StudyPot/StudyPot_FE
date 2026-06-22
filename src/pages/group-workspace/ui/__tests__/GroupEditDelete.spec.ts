import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { GroupMember, StudyGroup } from '@/entities/group'
import { useSessionStore } from '@/features/auth/session'
import { groupWorkspaceContextKey } from '../../model/workspaceContext'
import GroupOverviewPage from '../GroupOverviewPage.vue'

const ownerGroup: StudyGroup = {
  id: '018f7a4e-0000-7000-9000-000000000010',
  name: 'Backend Interview Study',
  topic: 'Spring Boot',
  detailKeywords: ['JPA', 'Security'],
  status: 'ONBOARDING',
  maxMembers: 6,
  inviteCode: 'sb-onboarding-2026',
  startsAt: '2026-05-12',
  endsAt: '2026-06-30',
}

const ownerMember: GroupMember = {
  id: '018f7a4e-1000-7000-9000-000000000001',
  groupId: ownerGroup.id,
  userId: '018f7a4e-0000-7000-9000-000000000001',
  permission: 'OWNER',
  status: 'ACTIVE',
  displayName: 'user1',
}

const memberOnlyMember: GroupMember = {
  ...ownerMember,
  permission: 'MEMBER',
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups', name: 'groups', component: { template: '<main />' } },
      { path: '/groups/:groupId', name: 'group-overview', component: GroupOverviewPage },
      { path: '/groups/:groupId/onboarding', name: 'group-onboarding', component: { template: '<main />' } },
      { path: '/groups/:groupId/curriculum', name: 'group-curriculum', component: { template: '<main />' } },
      { path: '/groups/:groupId/todo', name: 'group-todo', component: { template: '<main />' } },
      { path: '/groups/:groupId/retrospective', name: 'group-retrospective', component: { template: '<main />' } },
      { path: '/groups/:groupId/ai', name: 'group-ai', component: { template: '<main />' } },
      { path: '/groups/:groupId/board', name: 'group-board', component: { template: '<main />' } },
      { path: '/groups/:groupId/my', name: 'group-my', component: { template: '<main />' } },
    ],
  })
}

function mountWithContext(
  members: GroupMember[],
  group: StudyGroup | null = ownerGroup,
  options: { fetchMock?: ReturnType<typeof vi.fn> } = {},
) {
  const reloadGroup = vi.fn(async () => {})
  const router = createTestRouter()

  if (options.fetchMock) {
    vi.stubGlobal('fetch', options.fetchMock)
  }

  const pinia = createPinia()
  setActivePinia(pinia)
  // isOwner 판정은 세션 사용자 id 기준이므로 현재 사용자를 멤버와 동일하게 맞춘다.
  useSessionStore().$patch({
    user: { id: ownerMember.userId, email: 'user1@example.com', nickname: 'user1' },
    status: 'authenticated',
  })

  const wrapper = mount(GroupOverviewPage, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      provide: {
        [groupWorkspaceContextKey as symbol]: {
          groupId: computed(() => ownerGroup.id),
          group: ref(group),
          isGroupLoading: ref(false),
          groupErrorMessage: ref(''),
          reloadGroup,
          members: ref(members),
        },
      },
    },
  })

  return { wrapper, router, reloadGroup }
}

describe('GroupOverviewPage — edit/delete (OWNER)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows edit and delete buttons only for OWNER', () => {
    const { wrapper } = mountWithContext([ownerMember])
    expect(wrapper.text()).toContain('편집')
    expect(wrapper.text()).toContain('삭제')
  })

  it('hides edit and delete buttons for non-OWNER members', () => {
    const { wrapper } = mountWithContext([memberOnlyMember])
    expect(wrapper.text()).not.toContain('편집')
    expect(wrapper.text()).not.toContain('삭제')
  })

  it('opens the edit modal when the edit button is clicked', async () => {
    const { wrapper } = mountWithContext([ownerMember])

    const editButton = wrapper.findAll('button').find((b) => b.text() === '편집')
    expect(editButton).toBeTruthy()
    await editButton!.trigger('click')

    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
    expect(document.body.textContent).toContain('그룹 정보 수정')
  })

  it('shows validation errors in the edit modal when submitting empty name', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const { wrapper } = mountWithContext([ownerMember], ownerGroup, { fetchMock })

    const editButton = wrapper.findAll('button').find((b) => b.text() === '편집')
    await editButton!.trigger('click')
    await flushPromises()

    const nameInput = document.body.querySelector('input[name="name"]') as HTMLInputElement
    expect(nameInput).toBeTruthy()

    nameInput.value = ''
    nameInput.dispatchEvent(new Event('input'))
    await flushPromises()

    // 폼에서 이름을 지우고 제출
    const modal = document.body.querySelector('[role="dialog"]') as HTMLElement
    const form = modal.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/groups/${ownerGroup.id}`),
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(document.body.textContent).toContain('그룹 이름을 입력해주세요.')
  })

  it('calls PATCH /groups/:id and closes modal on successful update', async () => {
    const updatedGroup = { ...ownerGroup, name: '수정된 스터디 이름' }
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(updatedGroup), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const { wrapper } = mountWithContext([ownerMember], ownerGroup, { fetchMock })

    const editButton = wrapper.findAll('button').find((b) => b.text() === '편집')
    await editButton!.trigger('click')
    await flushPromises()

    const form = document.body.querySelector('[role="dialog"] form') as HTMLFormElement
    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/groups/${ownerGroup.id}`,
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows a 422 field error from the server inside the edit modal', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            title: 'Unprocessable Entity',
            detail: '입력 값이 유효하지 않습니다.',
            status: 422,
            errors: { name: '그룹 이름은 120자 이하로 입력해주세요.' },
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const { wrapper } = mountWithContext([ownerMember], ownerGroup, { fetchMock })

    const editButton = wrapper.findAll('button').find((b) => b.text() === '편집')
    await editButton!.trigger('click')
    await flushPromises()

    const form = document.body.querySelector('[role="dialog"] form') as HTMLFormElement
    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(document.body.textContent).toContain('그룹 이름은 120자 이하로 입력해주세요.')
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
  })

  it('shows a 400 error from the server inside the edit modal', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            title: 'Bad Request',
            detail: '그룹 이름은 필수 입력 값입니다.',
            status: 400,
            errors: { name: '그룹 이름은 필수 입력 값입니다.' },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const { wrapper } = mountWithContext([ownerMember], ownerGroup, { fetchMock })

    const editButton = wrapper.findAll('button').find((b) => b.text() === '편집')
    await editButton!.trigger('click')
    await flushPromises()

    const form = document.body.querySelector('[role="dialog"] form') as HTMLFormElement
    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(document.body.textContent).toContain('그룹 이름은 필수 입력 값입니다.')
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
  })

  it('opens the delete dialog when the delete button is clicked', async () => {
    const { wrapper } = mountWithContext([ownerMember])

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === '삭제')
    expect(deleteButton).toBeTruthy()
    await deleteButton!.trigger('click')

    expect(document.body.textContent).toContain('그룹을 삭제하시겠습니까?')
  })

  it('calls DELETE /groups/:id and redirects to /groups on success', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    const { wrapper, router } = mountWithContext([ownerMember], ownerGroup, { fetchMock })

    await router.push(`/groups/${ownerGroup.id}`)

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === '삭제')
    await deleteButton!.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '삭제' && b.closest('[role="dialog"]'),
    )
    expect(confirmButton).toBeTruthy()
    confirmButton!.click()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/groups/${ownerGroup.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(router.currentRoute.value.name).toBe('groups')
  })

  it('shows a 404 error in the delete dialog when the group is not found', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ title: 'Not Found', detail: '존재하지 않는 그룹입니다.', status: 404 }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const { wrapper } = mountWithContext([ownerMember], ownerGroup, { fetchMock })

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === '삭제')
    await deleteButton!.trigger('click')
    await flushPromises()

    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '삭제' && b.closest('[role="dialog"]'),
    )
    confirmButton!.click()
    await flushPromises()

    expect(document.body.textContent).toContain('그룹을 찾을 수 없습니다.')
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
  })
})
