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
  GroupMyPage,
  GroupOnboardingPage,
  GroupOverviewPage,
  GroupRetrospectivePage,
  GroupTodoPage,
  GroupWorkspacePage,
} from '@/pages/group-workspace'
import { GroupsPage } from '@/pages/groups'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: {
      name: 'groups',
    },
  },
  {
    // Kept for logout redirects and session-restore failure; AppShell renders the login UI
    path: '/login',
    name: 'login',
    component: { template: '<div />' },
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
    redirect: (to) => ({
      name: 'login',
      query: { error: 'oauth', ...to.query },
    }),
  },
  {
    path: '/groups',
    name: 'groups',
    component: GroupsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/groups/new',
    name: 'group-create',
    component: GroupCreatePage,
    meta: { requiresAuth: true },
  },
  {
    path: '/groups/join',
    name: 'group-join',
    component: GroupJoinPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/groups/:groupId/join',
    name: 'group-join-with-id',
    component: GroupJoinPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/groups/:groupId',
    component: GroupWorkspacePage,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'group-overview',
        component: GroupOverviewPage,
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

  // Session restore failed; redirect to login route (AppShell will show the login UI)
  return {
    name: 'login',
    query: { redirect: to.fullPath },
  }
})

export default router
