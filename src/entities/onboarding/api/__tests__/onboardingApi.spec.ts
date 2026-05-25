import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMyOnboarding, submitMyOnboarding } from '../onboardingApi'
import type { OnboardingResponse, SubmitOnboardingRequest } from '../../model/types'

const groupId = '018f7a4e-0000-7000-9000-000000000010'

const onboardingResponse: OnboardingResponse = {
  id: '018f7a4e-2000-7000-9000-000000000001',
  groupId,
  memberId: '018f7a4e-1000-7000-9000-000000000001',
  skillLevel: 3,
  additionalNote: '실전 위주 학습을 원합니다.',
  availabilitySlots: [
    { dayOfWeek: 2, startTime: '20:00', endTime: '22:00', timezone: 'Asia/Seoul' },
  ],
  status: 'SUBMITTED',
  submittedAt: '2026-05-08T14:02:00+09:00',
}

describe('onboardingApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getMyOnboarding', () => {
    it('calls GET /api/v1/groups/{groupId}/onboarding/me', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(onboardingResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(getMyOnboarding(groupId)).resolves.toEqual(onboardingResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/onboarding/me`,
        expect.objectContaining({ credentials: 'include' }),
      )

      const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(requestInit.method).toBeUndefined()
    })

    it('propagates ApiError on 404', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

      await expect(getMyOnboarding(groupId)).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
      })
    })
  })

  describe('submitMyOnboarding', () => {
    const request: SubmitOnboardingRequest = {
      skillLevel: 3,
      additionalNote: '실전 위주 학습을 원합니다.',
      availabilitySlots: [
        { dayOfWeek: 2, startTime: '20:00', endTime: '22:00', timezone: 'Asia/Seoul' },
      ],
    }

    it('calls POST /api/v1/groups/{groupId}/onboarding/me with the request body', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...onboardingResponse, status: 'SUBMITTED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const result = await submitMyOnboarding(groupId, request)

      expect(result.status).toBe('SUBMITTED')
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/onboarding/me`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )

      const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(requestInit.body as string)).toEqual(request)
    })

    it('propagates ApiError on 409 (already submitted)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({ title: 'Conflict', detail: 'Onboarding already submitted.', status: 409 }),
            { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        ),
      )

      await expect(submitMyOnboarding(groupId, request)).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
        message: 'Onboarding already submitted.',
      })
    })
  })
})
