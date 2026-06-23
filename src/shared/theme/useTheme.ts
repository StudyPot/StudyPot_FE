import { ref } from 'vue'

// 단일 라이트 테마(프레시 그린 리디자인). 다크 모드는 제거되었다.
// 기존 호출부 호환을 위해 동일한 API(isDark/toggle)를 유지하되 항상 라이트로 고정한다.
const isDark = ref(false)

document.documentElement.setAttribute('data-theme', 'light')

export function useTheme() {
  return {
    isDark,
    toggle: () => {
      /* no-op: 라이트 테마 단일 운영 */
    },
  }
}
