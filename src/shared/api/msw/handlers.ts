import { userHandlers } from '@/entities/user/api/handlers'
import { groupHandlers } from '@/entities/group/api/handlers'
import { googleLoginHandlers } from '@/features/auth/google-login/api/handlers'
import { logoutHandlers } from '@/features/auth/logout/api/handlers'
import { logoutAllHandlers } from '@/features/auth/logout-all/api/handlers'
import { refreshSessionHandlers } from '@/features/auth/refresh-session/api/handlers'

export const handlers = [
  ...googleLoginHandlers,
  ...refreshSessionHandlers,
  ...logoutHandlers,
  ...logoutAllHandlers,
  ...userHandlers,
  ...groupHandlers,
]
