import { ApiError, apiClient } from '@/shared/api'
import type {
  CreateGroupRequest,
  DetailKeywordSuggestionsResponse,
  GroupMember,
  GroupMemberCurrentWeekSummary,
  GroupMemberOnboardingSummary,
  GroupMemberPermission,
  GroupMemberRetrospectiveSummary,
  GroupMemberStatus,
  GroupMemberTaskCompletionSummary,
  JoinGroupRequest,
  StudyGroup,
  SuggestDetailKeywordsRequest,
  UpdateGroupMemberProfileRequest,
} from '../model/types'

export type MyGroupMemberProfile = {
  memberId: string
  groupId: string
  userId: string
  permission: GroupMemberPermission
  status: GroupMemberStatus
  displayName: string | null
  onboarding: GroupMemberOnboardingSummary
  currentWeek: GroupMemberCurrentWeekSummary | null
  taskCompletion: GroupMemberTaskCompletionSummary
  retrospective: GroupMemberRetrospectiveSummary
}

export function listGroups(): Promise<StudyGroup[]> {
  return apiClient<StudyGroup[]>('/groups')
}

export async function getGroup(groupId: string): Promise<StudyGroup> {
  try {
    return await apiClient<StudyGroup>(`/groups/${groupId}`)
  } catch (error) {
    if (isMissingGroupDetailEndpoint(error)) {
      const group = (await listGroups()).find((item) => item.id === groupId)

      if (group) {
        return group
      }
    }

    throw error
  }
}

export function createGroup(request: CreateGroupRequest): Promise<StudyGroup> {
  return apiClient<StudyGroup>('/groups', {
    method: 'POST',
    body: request,
  })
}

export function suggestDetailKeywords(
  request: SuggestDetailKeywordsRequest,
): Promise<DetailKeywordSuggestionsResponse> {
  return apiClient<DetailKeywordSuggestionsResponse>('/groups/detail-keyword-suggestions', {
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

export function getMyGroupMemberProfile(groupId: string): Promise<MyGroupMemberProfile> {
  return apiClient<MyGroupMemberProfile>(`/groups/${groupId}/members/me/profile`)
}

export function updateMyGroupMemberProfile(
  groupId: string,
  request: UpdateGroupMemberProfileRequest,
): Promise<MyGroupMemberProfile> {
  return apiClient<MyGroupMemberProfile>(`/groups/${groupId}/members/me/profile`, {
    method: 'PATCH',
    body: request,
  })
}

function isMissingGroupDetailEndpoint(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405)
}
