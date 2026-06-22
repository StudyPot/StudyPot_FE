import { expect, test } from '@playwright/test'

const notification = {
  id: '018f0000-0000-7000-8000-000000009001',
  notificationType: 'ONBOARDING_REQUESTED',
  channel: 'IN_APP',
  title: '온보딩 요청',
  body: '스터디 온보딩을 작성해 주세요.',
  status: 'DELIVERED',
  deliveredAt: '2026-06-04T04:41:00.000Z',
  readAt: null,
  createdAt: '2026-06-04T04:41:00.000Z',
}

test('shows an in-app toast when a notification-created SSE event arrives', async ({ page }) => {
  await page.addInitScript(() => {
    const currentUser = {
      id: '018f0000-0000-7000-8000-000000009102',
      email: 'user@example.com',
      nickname: '테스트 사용자',
    }

    class MockEventSource {
      static instances: MockEventSource[] = []

      onopen: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>()

      constructor(
        readonly url: string,
        readonly options?: EventSourceInit,
      ) {
        MockEventSource.instances.push(this)
        queueMicrotask(() => this.onopen?.(new Event('open')))
      }

      addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
        const listeners = this.listeners.get(type) ?? []
        listeners.push(listener)
        this.listeners.set(type, listeners)
      }

      close(): void {
        // no-op for browser smoke
      }

      emit(type: string, payload: unknown): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(new MessageEvent(type, { data: JSON.stringify(payload) }))
        }
      }
    }

    Object.assign(window, {
      EventSource: MockEventSource,
      __notificationEventSources: MockEventSource.instances,
      fetch: async (input: RequestInfo | URL) => {
        const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url
        const path = new URL(rawUrl, window.location.origin).pathname

        if (path === '/api/v1/users/me') {
          return new Response(JSON.stringify(currentUser), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (path === '/api/v1/users/me/notifications') {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (path === '/api/v1/groups') {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ title: 'Not Found', status: 404 }), {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        })
      },
    })
  })

  await page.goto('/groups')
  await page.waitForFunction(() => window.__notificationEventSources?.length === 1)

  await page.evaluate((payload) => {
    window.__notificationEventSources?.[0]?.emit('notification-created', payload)
  }, notification)

  const toast = page.getByRole('alert')
  await expect(toast).toContainText('온보딩 요청')
  await expect(toast).toContainText('스터디 온보딩을 작성해 주세요.')
})

declare global {
  interface Window {
    __notificationEventSources?: Array<{
      emit(type: string, payload: unknown): void
    }>
  }
}
