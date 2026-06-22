import type { ComputedRef, InjectionKey, Ref } from 'vue'

import type { GroupMember, StudyGroup } from '@/entities/group'

export type GroupWorkspaceContext = {
  groupId: ComputedRef<string>
  group: Ref<StudyGroup | null>
  isGroupLoading: Ref<boolean>
  groupErrorMessage: Ref<string>
  reloadGroup: () => Promise<void>
  reloadMembers: () => Promise<void>
  members: Ref<GroupMember[]>
}

export const groupWorkspaceContextKey: InjectionKey<GroupWorkspaceContext> =
  Symbol('groupWorkspaceContext')
