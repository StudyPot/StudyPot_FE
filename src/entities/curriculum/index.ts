export {
  completeTask,
  getCurrentWeek,
  getCurriculum,
  getMyWeekProgress,
  listWeeklyTasks,
  startStudy,
  updateMyWeekProgress,
} from './api/curriculumApi'
export type {
  Curriculum,
  CurriculumStatus,
  CurriculumWeek,
  CurriculumWeekStatus,
  CurriculumWeekSummary,
  MemberWeekProgress,
  MemberWeekProgressStatus,
  TaskCompletionRequest,
  TaskCompletionResponse,
  TaskCompletionStatus,
  UpdateWeekProgressRequest,
  WeeklyTask,
  WeeklyTaskType,
} from './model/types'
