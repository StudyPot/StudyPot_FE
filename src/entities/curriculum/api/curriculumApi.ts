import { apiClient } from '@/shared/api'
import type {
  Curriculum,
  CurriculumWeek,
  MemberWeekProgress,
  TaskCompletionRequest,
  TaskCompletionResponse,
  UpdateWeekProgressRequest,
  WeeklyTask,
} from '../model/types'

export function startStudy(groupId: string): Promise<Curriculum> {
  return apiClient<Curriculum>(`/groups/${groupId}/start`, {
    method: 'POST',
  })
}

export function getCurriculum(groupId: string): Promise<Curriculum> {
  return apiClient<Curriculum>(`/groups/${groupId}/curriculum`)
}

export function getCurrentWeek(groupId: string): Promise<CurriculumWeek> {
  return apiClient<CurriculumWeek>(`/groups/${groupId}/weeks/current`)
}

export function getWeek(weekId: string): Promise<CurriculumWeek> {
  return apiClient<CurriculumWeek>(`/weeks/${weekId}`)
}

export function listWeeklyTasks(weekId: string): Promise<WeeklyTask[]> {
  return apiClient<WeeklyTask[]>(`/weeks/${weekId}/tasks`)
}

export function getMyWeekProgress(weekId: string): Promise<MemberWeekProgress> {
  return apiClient<MemberWeekProgress>(`/weeks/${weekId}/progress/me`)
}

export function updateMyWeekProgress(
  weekId: string,
  request: UpdateWeekProgressRequest,
): Promise<MemberWeekProgress> {
  return apiClient<MemberWeekProgress>(`/weeks/${weekId}/progress/me`, {
    method: 'PUT',
    body: request,
  })
}

export function completeTask(
  taskId: string,
  request: TaskCompletionRequest,
): Promise<TaskCompletionResponse> {
  return apiClient<TaskCompletionResponse>(`/tasks/${taskId}/completion/me`, {
    method: 'POST',
    body: request,
  })
}
