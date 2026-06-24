import { apiClient } from '@/shared/api'
import type {
  CurrentLearningActivity,
  Curriculum,
  CurriculumWeek,
  DoneTaskRequest,
  IncompleteTaskRequest,
  MemberActivityRow,
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

export function listCurriculumWeeks(groupId: string): Promise<CurriculumWeek[]> {
  return apiClient<CurriculumWeek[]>(`/groups/${groupId}/weeks`)
}

export function getCurrentLearningActivity(groupId: string): Promise<CurrentLearningActivity> {
  return apiClient<CurrentLearningActivity>(`/groups/${groupId}/learning-activity/me`)
}

export function getGroupMembersActivity(groupId: string): Promise<MemberActivityRow[]> {
  return apiClient<MemberActivityRow[]>(`/groups/${groupId}/learning-activity`)
}

export type RecentActivityItem = {
  memberId: string
  memberNickname: string
  taskTitle: string
  completedAt: string
}

// 그룹 홈 '최근 활동' 피드: 최근 완료된 과제(누가/무슨 과제/언제).
export function getRecentActivity(groupId: string, limit = 8): Promise<RecentActivityItem[]> {
  return apiClient<RecentActivityItem[]>(`/groups/${groupId}/activity-feed?limit=${limit}`)
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

export function markTaskDone(
  taskId: string,
  request: DoneTaskRequest = {},
): Promise<TaskCompletionResponse> {
  return apiClient<TaskCompletionResponse>(`/tasks/${taskId}/completion/me/done`, {
    method: 'POST',
    body: request,
  })
}

export function markTaskIncomplete(
  taskId: string,
  request: IncompleteTaskRequest,
): Promise<TaskCompletionResponse> {
  return apiClient<TaskCompletionResponse>(`/tasks/${taskId}/completion/me/incomplete`, {
    method: 'POST',
    body: request,
  })
}

export function skipTask(taskId: string): Promise<TaskCompletionResponse> {
  return apiClient<TaskCompletionResponse>(`/tasks/${taskId}/completion/me/skip`, {
    method: 'POST',
  })
}
