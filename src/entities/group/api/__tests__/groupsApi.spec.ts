import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteGroup, getGroup, suggestDetailKeywords, updateGroup } from '../groupsApi'

const group = {
  id: '018f7a4e-0000-7000-9000-000000000011',
  name: 'Spring Boot 실전 스터디',
  topic: 'Spring Boot',
  detailKeywords: ['JPA', 'Spring Security'],
  status: 'ACTIVE',
  maxMembers: 6,
  inviteCode: 'sb-active-2026',
  startsAt: '2026-04-22',
  endsAt: '2026-06-30',
}

describe('groupsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to the group list when the group detail endpoint is unavailable', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'Not Found',
            status: 404,
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([group]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    await expect(getGroup(group.id)).resolves.toEqual(group)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/v1/groups/${group.id}`,
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/groups',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('sends a PATCH request and returns the updated group', async () => {
    const updatedGroup = { ...group, name: '수정된 스터디', endsAt: '2026-08-31' }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(updatedGroup), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateGroup(group.id, {
        name: '수정된 스터디',
        topic: group.topic,
        detailKeywords: group.detailKeywords,
        maxMembers: group.maxMembers,
        startsAt: group.startsAt,
        endsAt: '2026-08-31',
      }),
    ).resolves.toEqual(updatedGroup)

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/v1/groups/${group.id}`)
    expect(requestInit.method).toBe('PATCH')
    expect(JSON.parse(requestInit.body as string)).toMatchObject({ name: '수정된 스터디' })
  })

  it('throws ApiError with status 422 when the server rejects invalid update data', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Unprocessable Entity',
          detail: '입력 값이 유효하지 않습니다.',
          status: 422,
          errors: { name: '그룹 이름은 120자 이하로 입력해주세요.' },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await updateGroup(group.id, {
      name: 'a'.repeat(121),
      topic: group.topic,
      detailKeywords: group.detailKeywords,
      maxMembers: group.maxMembers,
      startsAt: group.startsAt,
      endsAt: group.endsAt,
    }).catch((e) => e)

    expect(error.status).toBe(422)
    expect(error.payload).toMatchObject({ errors: { name: expect.any(String) } })
  })

  it('throws ApiError with status 400 when the server rejects a bad update request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Bad Request',
          detail: '그룹 이름은 필수 입력 값입니다.',
          status: 400,
          errors: { name: '그룹 이름은 필수 입력 값입니다.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await updateGroup(group.id, {
      name: '',
      topic: group.topic,
      detailKeywords: group.detailKeywords,
      maxMembers: group.maxMembers,
      startsAt: group.startsAt,
      endsAt: group.endsAt,
    }).catch((e) => e)

    expect(error.status).toBe(400)
    expect(error.payload).toMatchObject({ errors: { name: expect.any(String) } })
  })

  it('throws ApiError with status 404 when updating a non-existent group', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ title: 'Not Found', detail: '존재하지 않는 그룹입니다.', status: 404 }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await updateGroup('non-existent-id', {
      name: '이름',
      topic: '주제',
      detailKeywords: ['키워드'],
      maxMembers: 4,
      startsAt: '2026-06-01',
      endsAt: '2026-07-01',
    }).catch((e) => e)

    expect(error.status).toBe(404)
  })

  it('sends a DELETE request and resolves when the group is deleted', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteGroup(group.id)).resolves.toBeUndefined()

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/v1/groups/${group.id}`)
    expect(requestInit.method).toBe('DELETE')
  })

  it('throws ApiError with status 404 when deleting a non-existent group', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ title: 'Not Found', detail: '존재하지 않는 그룹입니다.', status: 404 }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await deleteGroup('non-existent-id').catch((e) => e)
    expect(error.status).toBe(404)
  })

  it('requests detail keyword suggestions', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ keywords: ['JPA', 'Spring Security'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      suggestDetailKeywords({
        topic: 'Spring Boot',
        hintKeywords: ['JPA'],
        maxCandidates: 5,
      }),
    ).resolves.toEqual({ keywords: ['JPA', 'Spring Security'] })

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/groups/detail-keyword-suggestions',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(JSON.parse(requestInit.body as string)).toEqual({
      topic: 'Spring Boot',
      hintKeywords: ['JPA'],
      maxCandidates: 5,
    })
  })
})
