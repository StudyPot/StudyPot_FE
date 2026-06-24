import { HttpResponse, http } from 'msw'

import { apiBaseUrl } from '@/shared/config/api'
import type { RetrospectiveAnswer } from '../model/types'

const QUESTIONS = [
  { id: 'q1', text: '이번 주에 생태계 연구 기본 용어를 핵심 개념 위주로 정리했다', type: 'LIKERT_5' as const },
  { id: 'q2', text: '진화 생물학 기초(자연선택/적응/변이 등)를 예시와 함께 설명할 수 있다', type: 'LIKERT_5' as const },
  { id: 'q3', text: '행동 생물학 관찰 노트의 관찰 항목을 일관되게 기록했다', type: 'LIKERT_5' as const },
  { id: 'q4', text: '군체 개념(개체군과의 차이, 집단 수준 특성)을 자신의 말로 정리했다', type: 'LIKERT_5' as const },
  { id: 'q5', text: '관찰 기록과 개념 학습을 연결해(용어/진화 관점) 해석을 시도했다', type: 'LIKERT_5' as const },
  { id: 'q6', text: '이번 주에 가장 어려웠던 개념 또는 관찰 기록 과정은 무엇이었나? 구체적으로 적어주세요', type: 'TEXT' as const },
]

// MSW 세션 동안 제출 상태 유지
const submittedAnswers: Record<string, RetrospectiveAnswer[]> = {
  w1: [
    { questionId: 'q1', score: 5 },
    { questionId: 'q2', score: 4 },
    { questionId: 'q3', score: 5 },
    { questionId: 'q4', score: 3 },
    { questionId: 'q5', score: 4 },
    { questionId: 'q6', text: '필터 체인 흐름을 잡으니 전체 그림이 보였어요.' },
  ],
}

function makeOverviewWeeks() {
  return Array.from({ length: 8 }, (_, i) => {
    const weekNumber = i + 1
    const weekId = `w${weekNumber}`

    if (weekNumber === 1) {
      // 1주차: 완료 + 제출 완료 + AI 리포트 발행
      return {
        weekId,
        weekNumber,
        status: 'COMPLETED',
        unlocked: true,
        answered: true,
        reportPosted: true,
        questions: QUESTIONS,
      }
    }

    if (weekNumber === 2) {
      // 2주차: 진행 중 + 제출 가능 (interactive 테스트용)
      return {
        weekId,
        weekNumber,
        status: 'IN_PROGRESS',
        unlocked: true,
        answered: weekId in submittedAnswers,
        reportPosted: false,
        questions: QUESTIONS,
      }
    }

    if (weekNumber === 3) {
      // 3주차: 진행 중이지만 할 일 미완료 → 잠김
      return {
        weekId,
        weekNumber,
        status: 'IN_PROGRESS',
        unlocked: false,
        answered: false,
        reportPosted: false,
        questions: QUESTIONS,
      }
    }

    // 4주차 이후: 아직 시작 전
    return {
      weekId,
      weekNumber,
      status: 'PENDING',
      unlocked: false,
      answered: false,
      reportPosted: false,
      questions: [],
    }
  })
}

export const retrospectiveHandlers = [
  // 회고 제출
  http.post(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, async ({ request, params }) => {
    const weekId = params.weekId as string
    const body = (await request.json().catch(() => ({}))) as { answers?: RetrospectiveAnswer[] }
    submittedAnswers[weekId] = body.answers ?? []
    return HttpResponse.json({
      id: `retro-${weekId}`,
      weekId,
      status: 'COMPLETED',
      answers: submittedAnswers[weekId],
    })
  }),

  // 내 주차 회고 조회
  http.get(`${apiBaseUrl}/weeks/:weekId/retrospectives/me`, ({ params }) => {
    const weekId = params.weekId as string
    return HttpResponse.json({
      id: `retro-${weekId}`,
      weekId,
      status: 'COMPLETED',
      answers: submittedAnswers[weekId] ?? [],
    })
  }),

  // 주차별 회고 개요
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/overview`, () => {
    return HttpResponse.json(makeOverviewWeeks())
  }),

  // 그룹 내 내 모든 회고 목록
  http.get(`${apiBaseUrl}/groups/:groupId/retrospectives/me`, () => {
    return HttpResponse.json(
      Object.entries(submittedAnswers).map(([weekId, answers]) => ({
        id: `retro-${weekId}`,
        weekId,
        status: 'COMPLETED',
        answers,
      })),
    )
  }),
]
