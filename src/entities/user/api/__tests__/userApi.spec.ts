import { afterEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../../model/types'
import { getCurrentUser, updateCurrentUser } from '../currentUser'

const mockUser: User = {
  id: '018f7a4e-0000-7000-9000-000000000001',
  email: 'user@example.com',
  nickname: 'user1',
  bio: 'Spring Boot와 JPA를 공부하고 있는 백엔드 개발자입니다.',
  preferredTopics: ['Spring Boot', 'JPA', '테스트 코드'],
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('userApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getCurrentUser', () => {
    it('calls GET /api/v1/users/me and returns the current user', async () => {
      const fetchMock = mockFetch(mockUser)
      vi.stubGlobal('fetch', fetchMock)

      await expect(getCurrentUser()).resolves.toEqual(mockUser)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/users/me',
        expect.objectContaining({ credentials: 'include' }),
      )
    })
  })

  describe('updateCurrentUser', () => {
    it('calls PATCH /api/v1/users/me and returns the updated user', async () => {
      const updated: User = { ...mockUser, nickname: '새닉네임', bio: '업데이트된 소개' }
      const fetchMock = mockFetch(updated)
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        updateCurrentUser({ nickname: '새닉네임', bio: '업데이트된 소개' }),
      ).resolves.toEqual(updated)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/users/me',
        expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
      )

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(init.body as string)).toEqual({
        nickname: '새닉네임',
        bio: '업데이트된 소개',
      })
    })

    it('propagates ApiError on 400 when nickname is empty', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(
          {
            title: 'Bad Request',
            detail: '닉네임은 필수 입력 값입니다.',
            status: 400,
            errors: { nickname: '닉네임은 필수 입력 값입니다.' },
          },
          400,
        ),
      )

      await expect(updateCurrentUser({ nickname: '' })).rejects.toMatchObject({
        name: 'ApiError',
        status: 400,
      })
    })
  })
})
