import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listMyNotifications } from '@/entities/notification'
import type { Notification } from '@/entities/notification'
import { useInAppNotificationStore } from '../inAppNotificationStore'

vi.mock('@/entities/notification', () => ({
  listMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllMyNotificationsRead: vi.fn(),
}))

const notification: Notification = {
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

class MockEventSource {
  static instances: MockEventSource[] = []

  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>()
  readonly close = vi.fn()

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  emitOpen(): void {
    this.onopen?.(new Event('open'))
  }

  emitError(): void {
    this.onerror?.(new Event('error'))
  }

  emitNotificationCreated(payload: Notification): void {
    for (const listener of this.listeners.get('notification-created') ?? []) {
      listener(new MessageEvent('notification-created', { data: JSON.stringify(payload) }))
    }
  }
}

const listMyNotificationsMock = vi.mocked(listMyNotifications)

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('useInAppNotificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    MockEventSource.instances = []
    listMyNotificationsMock.mockReset()
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows a toast when reconciliation finds a new notification after the initial empty list', async () => {
    listMyNotificationsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([notification])

    const store = useInAppNotificationStore()

    await store.fetchNotifications()
    await store.fetchNotifications()

    expect(store.notifications).toEqual([notification])
    expect(store.toasts).toEqual([
      {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        notificationType: notification.notificationType,
      },
    ])
  })

  it('reconciles missed notifications and retries SSE after a stream error', async () => {
    listMyNotificationsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([notification])
      .mockResolvedValueOnce([notification])

    const store = useInAppNotificationStore()

    store.startSse()
    await flushPromises()
    MockEventSource.instances[0]?.emitOpen()

    MockEventSource.instances[0]?.emitError()
    await flushPromises()

    expect(listMyNotificationsMock).toHaveBeenCalledTimes(2)
    expect(store.toasts).toHaveLength(1)
    expect(store.isSseConnected).toBe(false)

    await vi.advanceTimersByTimeAsync(1_000)

    expect(MockEventSource.instances).toHaveLength(2)
    expect(MockEventSource.instances[0]?.close).toHaveBeenCalled()
  })

  it('adds incoming notification-created events to the list and toast queue', async () => {
    listMyNotificationsMock.mockResolvedValueOnce([])

    const store = useInAppNotificationStore()

    store.startSse()
    await flushPromises()
    MockEventSource.instances[0]?.emitOpen()
    MockEventSource.instances[0]?.emitNotificationCreated(notification)

    expect(store.notifications).toEqual([notification])
    expect(store.toasts).toHaveLength(1)
  })
})
