import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGroup, suggestDetailKeywords } from '../groupsApi'

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
