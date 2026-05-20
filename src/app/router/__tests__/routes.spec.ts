import { describe, expect, it } from 'vitest'

import router from '../index'

const routeFixtureGroupId = '018f7a4e-0000-7000-9000-000000000010'

describe('router', () => {
  it('resolves the group creation route before dynamic group routes', () => {
    const resolvedRoute = router.resolve('/groups/new')

    expect(resolvedRoute.name).toBe('group-create')
    expect(resolvedRoute.meta.requiresAuth).toBe(true)
  })

  it.each([
    [`/groups/${routeFixtureGroupId}`, 'group-overview'],
    [`/groups/${routeFixtureGroupId}/onboarding`, 'group-onboarding'],
    [`/groups/${routeFixtureGroupId}/curriculum`, 'group-curriculum'],
    [`/groups/${routeFixtureGroupId}/todo`, 'group-todo'],
    [`/groups/${routeFixtureGroupId}/retrospective`, 'group-retrospective'],
    [`/groups/${routeFixtureGroupId}/ai`, 'group-ai'],
    [`/groups/${routeFixtureGroupId}/notifications`, 'group-notifications'],
    [`/groups/${routeFixtureGroupId}/rules`, 'group-rules'],
  ])('resolves %s', (path, routeName) => {
    const resolvedRoute = router.resolve(path)

    expect(resolvedRoute.name).toBe(routeName)
    expect(resolvedRoute.meta.requiresAuth).toBe(true)
  })
})

