import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { AuthCallbackPage } from '@/pages/auth-callback'
import { GroupCreatePage } from '@/pages/group-create'
import { GroupJoinPage } from '@/pages/group-join'
import {
  GroupFeaturePlaceholderPage,
  GroupOnboardingPage,
  GroupOverviewPage,
  GroupWorkspacePage,
} from '@/pages/group-workspace'
import { GroupsPage } from '@/pages/groups'
import { LoginPage } from '../../pages/login'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: {
      name: 'groups',
    },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackPage,
  },
  {
    path: '/auth/success',
    name: 'auth-success',
    component: AuthCallbackPage,
  },
  {
    path: '/auth/failure',
    name: 'auth-failure',
    redirect: {
      name: 'login',
      query: {
        error: 'oauth',
      },
    },
  },
  {
    path: '/groups',
    name: 'groups',
    component: GroupsPage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/groups/new',
    name: 'group-create',
    component: GroupCreatePage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/groups/join',
    name: 'group-join',
    component: GroupJoinPage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/groups/:groupId/join',
    name: 'group-join-with-id',
    component: GroupJoinPage,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/groups/:groupId',
    component: GroupWorkspacePage,
    meta: {
      requiresAuth: true,
    },
    children: [
      {
        path: '',
        name: 'group-overview',
        component: GroupOverviewPage,
        meta: {
          workspaceTitle: '그룹 홈',
          workspaceSummary: '그룹의 주요 학습 흐름으로 이동합니다.',
        },
      },
      {
        path: 'onboarding',
        name: 'group-onboarding',
        component: GroupOnboardingPage,
      },
      {
        path: 'curriculum',
        name: 'group-curriculum',
        component: GroupFeaturePlaceholderPage,
        meta: {
          workspaceTitle: '커리큘럼',
          workspaceSummary: '스터디 전체 주차 계획을 확인합니다.',
        },
      },
      {
        path: 'todo',
        name: 'group-todo',
        component: GroupFeaturePlaceholderPage,
        meta: {
          workspaceTitle: 'Todo',
          workspaceSummary: '이번 주 과제와 나의 진행 상태를 확인합니다.',
        },
      },
      {
        path: 'retrospective',
        name: 'group-retrospective',
        component: GroupFeaturePlaceholderPage,
        meta: {
          workspaceTitle: '회고',
          workspaceSummary: '주차별 회고와 AI 피드백을 확인합니다.',
        },
      },
      {
        path: 'ai',
        name: 'group-ai',
        component: GroupFeaturePlaceholderPage,
        meta: {
          workspaceTitle: 'AI 팀장',
          workspaceSummary: '그룹 학습 흐름을 AI 팀장과 함께 점검합니다.',
        },
      },
      {
        path: 'notifications',
        name: 'group-notifications',
        component: GroupFeaturePlaceholderPage,
        meta: {
          workspaceTitle: '알림',
          workspaceSummary: '그룹과 나에게 온 알림을 확인합니다.',
        },
      },
      {
        path: 'rules',
        name: 'group-rules',
        component: GroupFeaturePlaceholderPage,
        meta: {
          workspaceTitle: '규칙',
          workspaceSummary: '그룹 운영 규칙과 위반 내역을 관리합니다.',
        },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true
  }

  const sessionStore = useSessionStore()
  const user = await sessionStore.restoreSession()

  if (user) {
    return true
  }

  return {
    name: 'login',
    query: {
      redirect: to.fullPath,
    },
  }
})

export default router
