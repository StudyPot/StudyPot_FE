import { ApiError, apiClient } from '@/shared/api'
import type {
  CreateGroupRequest,
  DetailKeywordSuggestionsResponse,
  JoinGroupRequest,
  StudyGroup,
  SuggestDetailKeywordsRequest,
} from '../model/types'

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

export function startStudy(groupId: string): Promise<{ status: string }> {
  return apiClient<{ status: string }>(`/groups/${groupId}/start`, {
    method: 'POST',
  })
}

function isMissingGroupDetailEndpoint(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405)
}
