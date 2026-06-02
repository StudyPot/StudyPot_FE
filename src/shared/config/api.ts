export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export const apiOrigin = import.meta.env.VITE_API_BASE_URL
  ? new URL(import.meta.env.VITE_API_BASE_URL).origin
  : ''
