import type { StudyGroupStatus } from './types'

export type GroupEntryRouteName =
  | 'group-overview'
  | 'group-onboarding'
  | 'group-curriculum'
  | 'group-todo'
  | 'group-retrospective'

export type GroupEntryAction = {
  routeName: GroupEntryRouteName
  label: string
  summary: string
}

const statusLabels: Record<StudyGroupStatus, string> = {
  DRAFT: '준비 중',
  ONBOARDING: '온보딩',
  READY_TO_START: '시작 대기',
  ACTIVE: '진행 중',
  COMPLETED: '완료',
  ARCHIVED: '보관됨',
}

const listPrimaryEntries: Record<StudyGroupStatus, GroupEntryAction> = {
  DRAFT: {
    routeName: 'group-overview',
    label: '그룹 홈',
    summary: '스터디 준비 상태를 확인합니다.',
  },
  ONBOARDING: {
    routeName: 'group-onboarding',
    label: '온보딩 작성',
    summary: '나의 준비도와 가능한 시간을 정리합니다.',
  },
  READY_TO_START: {
    routeName: 'group-overview',
    label: '스터디 시작하기',
    summary: '모든 멤버가 온보딩을 완료했습니다. 스터디를 시작하세요.',
  },
  ACTIVE: {
    routeName: 'group-todo',
    label: '이번 주 Todo',
    summary: '현재 주차 과제와 진행 상태를 확인합니다.',
  },
  COMPLETED: {
    routeName: 'group-retrospective',
    label: '회고 확인',
    summary: '완료된 스터디의 회고와 피드백을 확인합니다.',
  },
  ARCHIVED: {
    routeName: 'group-overview',
    label: '기록 보기',
    summary: '보관된 그룹의 주요 기록을 확인합니다.',
  },
}

const overviewPrimaryEntries: Record<StudyGroupStatus, GroupEntryAction> = {
  DRAFT: {
    routeName: 'group-onboarding',
    label: '온보딩 준비',
    summary: '스터디 시작 전 필요한 준비 정보를 먼저 정리합니다.',
  },
  ONBOARDING: {
    routeName: 'group-onboarding',
    label: '온보딩 작성',
    summary: '스터디 참여를 위해 준비도와 가능한 시간을 입력합니다.',
  },
  READY_TO_START: {
    routeName: 'group-overview',
    label: '스터디 시작하기',
    summary: '모든 멤버가 온보딩을 완료했습니다. 스터디를 시작하세요.',
  },
  ACTIVE: {
    routeName: 'group-todo',
    label: '이번 주 Todo',
    summary: '지금 진행해야 할 과제와 학습 흐름을 확인합니다.',
  },
  COMPLETED: {
    routeName: 'group-retrospective',
    label: '회고 확인',
    summary: '완료된 스터디의 회고와 AI 피드백을 돌아봅니다.',
  },
  ARCHIVED: {
    routeName: 'group-retrospective',
    label: '회고 기록',
    summary: '보관된 스터디에서 남긴 회고 기록을 확인합니다.',
  },
}

export function getGroupStatusLabel(status: StudyGroupStatus): string {
  return statusLabels[status]
}

export function getGroupListPrimaryEntry(status: StudyGroupStatus): GroupEntryAction {
  return listPrimaryEntries[status]
}

export function getGroupOverviewPrimaryEntry(status: StudyGroupStatus): GroupEntryAction {
  return overviewPrimaryEntries[status]
}
