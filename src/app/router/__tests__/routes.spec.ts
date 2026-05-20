import { describe, expect, it } from 'vitest'

import router from '../index'

const groupId = '018f7a4e-0000-7000-9000-000000000010'

describe('router', () => {
  it.each([
    [`/groups/${groupId}`, 'group-overview'],
    [`/groups/${groupId}/onboarding`, 'group-onboarding'],
    [`/groups/${groupId}/curriculum`, 'group-curriculum'],
    [`/groups/${groupId}/todo`, 'group-todo'],
    [`/groups/${groupId}/retrospective`, 'group-retrospective'],
    [`/groups/${groupId}/ai`, 'group-ai'],
    [`/groups/${groupId}/notifications`, 'group-notifications'],
    [`/groups/${groupId}/rules`, 'group-rules'],
  ])('resolves %s', (path, routeName) => {
    const resolvedRoute = router.resolve(path)

    expect(resolvedRoute.name).toBe(routeName)
    expect(resolvedRoute.meta.requiresAuth).toBe(true)
  })
})

