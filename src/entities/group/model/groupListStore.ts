import { defineStore } from 'pinia'

import { listGroups } from '../api/groupsApi'
import type { StudyGroup } from './types'

export const useGroupListStore = defineStore('groupList', {
  state: () => ({
    groups: [] as StudyGroup[],
  }),
  actions: {
    async loadGroups(): Promise<void> {
      try {
        this.groups = await listGroups()
      } catch {
        this.groups = []
      }
    },
    clearGroups(): void {
      this.groups = []
    },
  },
})
