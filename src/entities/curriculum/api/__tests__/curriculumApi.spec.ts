import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  completeTask,
  getCurriculum,
  getCurrentWeek,
  getWeek,
  startStudy,
} from '../curriculumApi'
import type { Curriculum, CurriculumWeek, TaskCompletionResponse } from '../../model/types'

const groupId = '018f7a4e-0000-7000-9000-000000000011'
const weekId = '018f7a4e-4000-7000-9000-000000000003'
const taskId = '018f7a4e-5000-7000-9000-000000000001'

const curriculum: Curriculum = {
  id: '018f7a4e-3000-7000-9000-000000000001',
  groupId,
  title: 'Spring Boot 실전',
  totalWeeks: 4,
  status: 'ACTIVE',
}

const currentWeek: CurriculumWeek = {
  id: weekId,
  curriculumId: curriculum.id,
  weekNumber: 3,
  title: 'Spring Security 구조 이해',
  status: 'IN_PROGRESS',
}

describe('curriculumApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('startStudy', () => {
    it('calls POST /api/v1/groups/{groupId}/start and returns the curriculum', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(curriculum), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(startStudy(groupId)).resolves.toEqual(curriculum)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/start`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )
    })
  })

  describe('getCurriculum', () => {
    it('calls GET /api/v1/groups/{groupId}/curriculum', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(curriculum), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(getCurriculum(groupId)).resolves.toEqual(curriculum)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/curriculum`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('propagates ApiError on 404 when no curriculum exists', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

      await expect(getCurriculum(groupId)).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
      })
    })
  })

  describe('getCurrentWeek', () => {
    it('calls GET /api/v1/groups/{groupId}/weeks/current', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(currentWeek), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(getCurrentWeek(groupId)).resolves.toEqual(currentWeek)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/groups/${groupId}/weeks/current`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('propagates ApiError on 404 when no active week', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

      await expect(getCurrentWeek(groupId)).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
      })
    })
  })

  describe('getWeek', () => {
    it('calls GET /api/v1/weeks/{weekId} and returns the week detail', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(currentWeek), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(getWeek(weekId)).resolves.toEqual(currentWeek)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/weeks/${weekId}`,
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('propagates ApiError on 404 when week does not exist', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({ title: 'Not Found', detail: '존재하지 않는 주차입니다.', status: 404 }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      )

      await expect(getWeek('non-existent-week-id')).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
      })
    })
  })

  describe('completeTask', () => {
    it('calls POST /api/v1/tasks/{taskId}/completion/me with status in body', async () => {
      const completion: TaskCompletionResponse = {
        id: `completion-${taskId}`,
        status: 'DONE',
        completedAt: '2026-05-21T19:30:00+09:00',
        incompleteReason: null,
      }

      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(completion), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(completeTask(taskId, { status: 'DONE' })).resolves.toEqual(completion)
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/tasks/${taskId}/completion/me`,
        expect.objectContaining({ credentials: 'include', method: 'POST' }),
      )

      const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(requestInit.body as string)).toEqual({ status: 'DONE' })
    })

    it('propagates ApiError on 403', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify({ title: 'Forbidden', status: 403 }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

      await expect(completeTask(taskId, { status: 'DONE' })).rejects.toMatchObject({
        name: 'ApiError',
        status: 403,
      })
    })
  })
})
