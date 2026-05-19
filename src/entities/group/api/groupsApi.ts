import { apiClient } from '@/shared/api'
import type { CreateGroupRequest, GroupMember, JoinGroupRequest, StudyGroup } from '../model/types'

export function listGroups(): Promise<StudyGroup[]> {
  return apiClient<StudyGroup[]>('/groups')
}

export function createGroup(request: CreateGroupRequest): Promise<StudyGroup> {
  return apiClient<StudyGroup>('/groups', {
    method: 'POST',
    body: request,
  })
}

export function joinGroup(groupId: string, request: JoinGroupRequest): Promise<GroupMember> {
  return apiClient<GroupMember>(`/groups/${groupId}/join`, {
    method: 'POST',
    body: request,
  })
}
