import { defineStore } from 'pinia'

// 온보딩 제출은 본인에게 별도 알림(SSE)을 보내지 않으므로, 제출 직후 다른 화면(예: 좌측 탭의
// 온보딩 채널 노출)을 새로고침 없이 갱신하려면 클라이언트 측 공유 신호가 필요하다.
export const useOnboardingStatusStore = defineStore('onboardingStatus', {
  state: () => ({
    submittedGroupIds: [] as string[],
  }),
  actions: {
    markSubmitted(groupId: string): void {
      if (!this.submittedGroupIds.includes(groupId)) {
        this.submittedGroupIds = [...this.submittedGroupIds, groupId]
      }
    },
  },
})
