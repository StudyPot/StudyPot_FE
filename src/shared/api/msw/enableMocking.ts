let hasStartedMocking = false

export async function enableMocking(): Promise<void> {
  const shouldEnableMocking = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW !== 'false'

  if (!shouldEnableMocking || hasStartedMocking) {
    return
  }

  const { worker } = await import('./browser')

  await worker.start({
    onUnhandledRequest: 'bypass',
  })

  hasStartedMocking = true
}
