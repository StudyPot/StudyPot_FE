import { HttpResponse, http } from 'msw'

import { mockMswData } from '@/shared/api/msw/fixtures'
import { apiBaseUrl } from '@/shared/config/api'
import type {
  CurrentLearningActivity,
  Curriculum,
  CurriculumWeek,
  CurriculumStatus,
  CurriculumWeekStatus,
  DoneTaskRequest,
  IncompleteTaskRequest,
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
    const taskId = String(params.taskId)

    return HttpResponse.json({
      id: `completion-${taskId}`,
      taskId,
      status: body.status,
      completedAt: body.status === 'DONE' ? new Date().toISOString() : null,
      reasonSubmittedAt: body.status === 'INCOMPLETE' ? new Date().toISOString() : null,
      completionNote: body.completionNote ?? null,
      incompleteReason: body.incompleteReason ?? null,
      evidenceUrl: body.evidenceUrl ?? null,
    } satisfies TaskCompletionResponse)
  }),

  http.post(`${apiBaseUrl}/tasks/:taskId/completion/me/done`, async ({ params, request }) => {
    const body = (await request.json()) as DoneTaskRequest
    const taskId = String(params.taskId)

    return HttpResponse.json({
      id: `completion-${taskId}`,
      taskId,
      status: 'DONE',
      completedAt: new Date().toISOString(),
      reasonSubmittedAt: null,
      completionNote: body.completionNote ?? null,
      incompleteReason: null,
      evidenceUrl: body.evidenceUrl ?? null,
    } satisfies TaskCompletionResponse)
  }),

  http.post(`${apiBaseUrl}/tasks/:taskId/completion/me/incomplete`, async ({ params, request }) => {
    const body = (await request.json()) as IncompleteTaskRequest
    const taskId = String(params.taskId)

    return HttpResponse.json({
      id: `completion-${taskId}`,
      taskId,
      status: 'INCOMPLETE',
      completedAt: null,
      reasonSubmittedAt: new Date().toISOString(),
      completionNote: null,
      incompleteReason: body.incompleteReason,
      evidenceUrl: null,
    } satisfies TaskCompletionResponse)
  }),

  http.post(`${apiBaseUrl}/tasks/:taskId/completion/me/skip`, ({ params }) => {
    const taskId = String(params.taskId)

    return HttpResponse.json({
      id: `completion-${taskId}`,
      taskId,
      status: 'SKIPPED',
      completedAt: null,
      reasonSubmittedAt: null,
      completionNote: null,
      incompleteReason: null,
      evidenceUrl: null,
    } satisfies TaskCompletionResponse)
  }),

  http.get(`${apiBaseUrl}/groups/:groupId/learning-activity/me`, ({ params }) => {
    const groupId = String(params.groupId)
    const currentWeek = toCurrentWeek(groupId)
    const tasks = toWeeklyTasks(currentWeek.id)

    const activity: CurrentLearningActivity = {
      groupId,
      currentWeek,
      progress: toWeekProgress(currentWeek.id, 'IN_PROGRESS'),
      progressStatus: 'IN_PROGRESS',
      taskCompletion: {
        totalCount: tasks.length,
        doneCount: tasks.filter((t) => t.completion?.status === 'DONE').length,
        incompleteCount: tasks.filter((t) => t.completion?.status === 'INCOMPLETE').length,
        skippedCount: tasks.filter((t) => t.completion?.status === 'SKIPPED').length,
      },
      tasks: tasks.map((task) => ({
        task,
        completion: {
          id: task.completion?.id ?? null,
          taskId: task.id,
          status: task.completion?.status ?? 'TODO',
          completedAt: task.completion?.completedAt ?? null,
          reasonSubmittedAt: null,
          completionNote: null,
          incompleteReason: task.completion?.incompleteReason ?? null,
          evidenceUrl: null,
        },
      })),
    }

    return HttpResponse.json(activity)
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
