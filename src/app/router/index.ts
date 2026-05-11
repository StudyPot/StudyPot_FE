import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { useSessionStore } from '@/features/auth/session'
import { AuthCallbackPage } from '@/pages/auth-callback'
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
