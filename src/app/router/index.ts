import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { AuthCallbackPage } from '@/pages/auth-callback'
import { GroupCreatePage } from '@/pages/group-create'
import { GroupJoinPage } from '@/pages/group-join'
import {
  GroupAiPage,
  GroupBoardPage,
  GroupCurriculumPage,
  GroupFeaturePlaceholderPage,
  GroupMyPage,
  GroupNotificationsPage,
  GroupOnboardingPage,
  GroupOverviewPage,
  GroupRetrospectivePage,
  GroupRulesPage,
  GroupTodoPage,
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
        component: GroupCurriculumPage,
      },
      {
        path: 'todo',
        name: 'group-todo',
        component: GroupTodoPage,
      },
      {
        path: 'retrospective',
        name: 'group-retrospective',
        component: GroupRetrospectivePage,
      },
      {
        path: 'ai',
        name: 'group-ai',
        component: GroupAiPage,
      },
      {
        path: 'notifications',
        name: 'group-notifications',
        component: GroupNotificationsPage,
      },
      {
        path: 'rules',
        name: 'group-rules',
        component: GroupRulesPage,
      },
      {
        path: 'board',
        name: 'group-board',
        component: GroupBoardPage,
      },
      {
        path: 'my',
        name: 'group-my',
        component: GroupMyPage,
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

  // 리프레시 토큰 만료 또는 인증 실패 → 로그인으로
  return {
    name: 'login',
    query: {
      redirect: to.fullPath,
    },
  }
})

export default router
