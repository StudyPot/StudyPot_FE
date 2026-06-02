import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type {
  Curriculum,
  CurriculumWeek,
  CurriculumStatus,
  CurriculumWeekStatus,
  MemberWeekProgress,
  TaskCompletionRequest,
  TaskCompletionResponse,
  WeeklyTask,
} from '../model/types'

type ParamValue = string | readonly string[] | undefined

type LegacyCurriculum = Omit<Curriculum, 'status' | 'totalWeeks'> & {
  status: string
  totalWeeks?: number
  weeks?: Curriculum['weeks']
}

type LegacyWeek = Omit<CurriculumWeek, 'curriculumId' | 'status'> & {
  curriculumId: string
  status: string
}

type LegacyTask = {
  id: string
  weekId: string
  displayOrder: number
  title: string
  description?: string
  taskType: string
  dueAt?: string
  completion?: Partial<TaskCompletionResponse>
}

export const curriculumHandlers = [
  http.post(`${apiBaseUrl}/groups/:groupId/start`, ({ params }) => {
    return HttpResponse.json(toCurriculum(params.groupId), { status: 201 })
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/curriculum`, ({ params }) => {
    return HttpResponse.json(toCurriculum(params.groupId))
  }),
  http.get(`${apiBaseUrl}/groups/:groupId/weeks/current`, ({ params }) => {
    return HttpResponse.json(toCurrentWeek(params.groupId))
  }),
  http.get(`${apiBaseUrl}/weeks/:weekId`, ({ params }) => {
    return HttpResponse.json(toWeekById(params.weekId))
  }),
  http.get(`${apiBaseUrl}/weeks/:weekId/tasks`, ({ params }) => {
    return HttpResponse.json(toWeeklyTasks(params.weekId))
  }),
  http.get(`${apiBaseUrl}/weeks/:weekId/progress/me`, ({ params }) => {
    return HttpResponse.json(toWeekProgress(params.weekId, 'IN_PROGRESS'))
  }),
  http.put(`${apiBaseUrl}/weeks/:weekId/progress/me`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<MemberWeekProgress>

    return HttpResponse.json({
      ...toWeekProgress(params.weekId, 'IN_PROGRESS'),
      ...body,
    })
  }),
  http.post(`${apiBaseUrl}/tasks/:taskId/completion/me`, async ({ params, request }) => {
    const body = (await request.json()) as TaskCompletionRequest

    return HttpResponse.json({
      id: `completion-${String(params.taskId)}`,
      status: body.status,
      completedAt: body.status === 'DONE' ? new Date().toISOString() : null,
      incompleteReason: body.incompleteReason ?? null,
    } satisfies TaskCompletionResponse)
  }),
]

function toCurriculum(groupId: ParamValue): Curriculum {
  const source = mockMswData.curriculum.curriculum as unknown as LegacyCurriculum

  return {
    ...source,
    groupId: String(groupId || source.groupId),
    totalWeeks: source.totalWeeks ?? source.weeks?.length ?? 0,
    status: toCurriculumStatus(source.status),
  }
}

function toCurrentWeek(groupId: ParamValue): CurriculumWeek {
  const source = mockMswData.curriculum.currentWeek as unknown as LegacyWeek

  return {
    ...source,
    groupId: String(groupId || source.groupId),
    sprintGoal: source.sprintGoal ?? source.focus ?? null,
    status: toWeekStatus(source.status),
  }
}

function toWeekById(weekId: ParamValue): CurriculumWeek {
  const id = String(weekId)
  const weeks = (mockMswData.curriculum as unknown as Record<string, unknown[]>).weeks as LegacyWeek[]
  const found = weeks?.find((w) => w.id === id)

  if (found) {
    return {
      ...found,
      sprintGoal: (found as LegacyWeek & { sprintGoal?: string }).sprintGoal ?? found.focus ?? null,
      status: toWeekStatus(found.status),
    }
  }

  // fallback: current week
  return toCurrentWeek(undefined)
}

function toWeeklyTasks(weekId: ParamValue): WeeklyTask[] {
  const id = String(weekId)
  const tasksByWeek = (mockMswData.curriculum as unknown as Record<string, unknown>).tasksByWeek as Record<string, LegacyTask[]>
  const weekTasks = tasksByWeek?.[id] ?? (mockMswData.curriculum.tasks as unknown as LegacyTask[])

  return weekTasks.map((task) => ({
    id: task.id,
    curriculumWeekId: task.weekId || id,
    weekId: id,
    displayOrder: task.displayOrder,
    taskType: task.taskType as WeeklyTask['taskType'],
    title: task.title,
    description: task.description ?? null,
    required: true,
    dueAt: task.dueAt ?? null,
    completion: task.completion
      ? {
          id: `completion-${task.id}`,
          status: task.completion.status ?? 'TODO',
          completedAt: task.completion.completedAt ?? null,
          incompleteReason: task.completion.incompleteReason ?? null,
        }
      : undefined,
  }))
}

function toWeekProgress(
  weekId: ParamValue,
  status: MemberWeekProgress['status'],
): MemberWeekProgress {
  return {
    id: `progress-${String(weekId)}`,
    status,
    completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
    incompleteReason: null,
  }
}

function toCurriculumStatus(status: string): CurriculumStatus {
  return status === 'COMPLETED' || status === 'DRAFT' ? status : 'ACTIVE'
}

function toWeekStatus(status: string): CurriculumWeekStatus {
  if (status === 'PENDING' || status === 'COMPLETED') {
    return status
  }

  return 'IN_PROGRESS'
}
