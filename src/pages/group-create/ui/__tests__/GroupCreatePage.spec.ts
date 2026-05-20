import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import GroupCreatePage from '../GroupCreatePage.vue'

const createdGroup = {
  id: '018f7a4e-0000-7000-9000-000000000020',
  name: 'Backend Interview Study',
  topic: 'Spring Boot',
  detailKeywords: ['JPA', 'Security', 'Testing'],
  status: 'ONBOARDING',
  maxMembers: 8,
  inviteCode: 'STUDY123',
  startsAt: '2026-06-01',
  endsAt: '2026-07-01',
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
        path: '/groups/new',
        name: 'group-create',
        component: GroupCreatePage,
      },
      {
        path: '/groups/:groupId/onboarding',
        name: 'group-onboarding',
        component: { template: '<main />' },
      },
    ],
  })
}

describe('GroupCreatePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows validation errors and does not submit when required values are missing', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/new')
    await router.isReady()

    const wrapper = mount(GroupCreatePage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('form').trigger('submit')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('그룹 이름을 입력해주세요.')
    expect(wrapper.text()).toContain('스터디 주제를 입력해주세요.')
    expect(wrapper.text()).toContain('세부 키워드를 하나 이상 입력해주세요.')
  })

  it('submits a create group request and redirects to onboarding', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(createdGroup), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const router = createTestRouter()
    await router.push('/groups/new')
    await router.isReady()

    const wrapper = mount(GroupCreatePage, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('input[name="name"]').setValue('Backend Interview Study')
    await wrapper.get('input[name="topic"]').setValue('Spring Boot')
    await wrapper.get('textarea[name="detailKeywords"]').setValue('JPA, Security\nTesting')
    await wrapper.get('input[name="maxMembers"]').setValue(8)
    await wrapper.get('input[name="startsAt"]').setValue('2026-06-01')
    await wrapper.get('input[name="endsAt"]').setValue('2026-07-01')
    await wrapper
      .get('textarea[name="description"]')
      .setValue('매주 백엔드 면접 주제를 정리합니다.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/groups',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(JSON.parse(requestInit.body as string)).toEqual({
      name: 'Backend Interview Study',
      topic: 'Spring Boot',
      detailKeywords: ['JPA', 'Security', 'Testing'],
      maxMembers: 8,
      startsAt: '2026-06-01',
      endsAt: '2026-07-01',
      description: '매주 백엔드 면접 주제를 정리합니다.',
    })
    expect(router.currentRoute.value.name).toBe('group-onboarding')
    expect(router.currentRoute.value.params.groupId).toBe(createdGroup.id)
  })
})
