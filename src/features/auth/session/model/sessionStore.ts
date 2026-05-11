import { defineStore } from 'pinia'

import { ApiError } from '@/shared/api'
import { getCurrentUser } from '@/entities/user/api/currentUser'
import type { User } from '@/entities/user/model/types'
import { logout, logoutAll, refreshSession } from '../api/sessionApi'

type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

type SessionState = {
  user: User | null
  status: SessionStatus
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    user: null,
    status: 'idle',
  }),
  getters: {
    isAuthenticated: (state) => state.status === 'authenticated' && state.user !== null,
  },
  actions: {
    async restoreSession(): Promise<User | null> {
      if (this.isAuthenticated) {
        return this.user
      }

      this.status = 'loading'

      try {
        this.user = await getCurrentUser()
        this.status = 'authenticated'
        return this.user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return this.refreshAndRestoreSession()
        }

        this.clearSession()
        return null
      }
    },

    async refreshAndRestoreSession(): Promise<User | null> {
      try {
        const session = await refreshSession()
        this.user = session.user
        this.status = 'authenticated'
        return this.user
      } catch {
        this.clearSession()
        return null
      }
    },

    async logoutCurrentSession(): Promise<void> {
      try {
        await logout()
      } finally {
        this.clearSession()
      }
    },

    async logoutEverySession(): Promise<void> {
      try {
        await logoutAll()
      } finally {
        this.clearSession()
      }
    },

    clearSession(): void {
      this.user = null
      this.status = 'anonymous'
    },
  },
})
