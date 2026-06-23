// 그룹마다 다른 색을 입히기 위한 카테고리 색 매핑.
// 주제(topic) 문자열을 7개 카테고리 색(--color-cat-1..7) 중 하나로 결정적으로 매핑한다.

const CATEGORY_COUNT = 7

export function getGroupCategoryIndex(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return (hash % CATEGORY_COUNT) + 1
}

/** CSS 변수 형태의 카테고리 색 (예: 'var(--color-cat-3)') */
export function getGroupCategoryColor(seed: string): string {
  return `var(--color-cat-${getGroupCategoryIndex(seed)})`
}
