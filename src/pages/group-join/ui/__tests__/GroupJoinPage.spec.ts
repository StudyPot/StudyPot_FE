import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GroupJoinPage from '../GroupJoinPage.vue'

const groupId = '018f7a4e-0000-7000-9000-000000000010'
const joinedMember = {
  id: '018f7a4e-1000-7000-9000-000000000099',
  groupId,
  userId: '018f7a4e-0000-7000-9000-000000000001',
  permission: 'MEMBER',
  status: 'PENDING_ONBOARDING',
  displayName: 'user1',
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/groups',
        name: 'groups',
        component: { template: '<main />' },
      },
      {
        path: '/groups/join',
        name: 'group-join',
        component: GroupJoinPage,
      },
      {
        path: '/groups/:groupId/join',
        name: 'group-join-with-id',
        component: GroupJoinPage,
      },
      {
        path: '/groups/:groupId/onboarding',
        name: 'group-onboarding',
        component: { template: '<main />' },
      },
    ],
  })
}

describe('GroupJoinPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows validation errors and does not submit without join values', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/join')
    await router.isReady()

    const wrapper = mount(GroupJoinPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('form').trigger('submit')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('초대 링크 또는 그룹 ID를 확인해주세요.')
    expect(wrapper.text()).toContain('초대 코드를 입력해주세요.')
  })

  it('submits an invite link and redirects to onboarding', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(joinedMember), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/join')
    await router.isReady()

    const wrapper = mount(GroupJoinPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper
      .get('input[name="groupReference"]')
      .setValue(`https://studypot.dev/groups/${groupId}/join`)
    await wrapper.get('input[name="inviteCode"]').setValue(' INVITE-0001 ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/groups/${groupId}/join`,
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(JSON.parse(requestInit.body as string)).toEqual({
      inviteCode: 'INVITE-0001',
    })
    expect(router.currentRoute.value.name).toBe('group-onboarding')
    expect(router.currentRoute.value.params.groupId).toBe(groupId)
  })

  it('prefills the group id and invite code from the invite route', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(joinedMember), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push(`/groups/${groupId}/join?inviteCode=INVITE-0001`)
    await router.isReady()

    const wrapper = mount(GroupJoinPage, {
      global: {
        plugins: [router],
      },
    })

    expect((wrapper.get('input[name="groupReference"]').element as HTMLInputElement).value).toBe(
      groupId,
    )
    expect((wrapper.get('input[name="inviteCode"]').element as HTMLInputElement).value).toBe(
      'INVITE-0001',
    )

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/groups/${groupId}/join`,
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
  })

  it('shows the API error when joining is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Conflict',
            detail: 'invite code does not match the study group.',
            status: 409,
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    const router = createTestRouter()
    await router.push('/groups/join')
    await router.isReady()

    const wrapper = mount(GroupJoinPage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('input[name="groupReference"]').setValue(groupId)
    await wrapper.get('input[name="inviteCode"]').setValue('WRONG-CODE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'invite code does not match the study group.',
    )
    expect(router.currentRoute.value.name).toBe('group-join')
  })
})
