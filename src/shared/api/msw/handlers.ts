import { aiHandlers } from '@/entities/ai/api/handlers'
import { boardHandlers } from '@/entities/board/api/handlers'
import { bookmarkHandlers } from '@/entities/bookmark/api/handlers'
import { curriculumHandlers } from '@/entities/curriculum/api/handlers'
import { followHandlers } from '@/entities/follow/api/handlers'
import { userHandlers } from '@/entities/user/api/handlers'
import { groupHandlers } from '@/entities/group/api/handlers'
import { notificationHandlers } from '@/entities/notification/api/handlers'
import { onboardingHandlers } from '@/entities/onboarding/api/handlers'
import { operationHandlers } from '@/entities/operation/api/handlers'
import { retrospectiveHandlers } from '@/entities/retrospective/api/handlers'
import { reviewHandlers } from '@/entities/review/api/handlers'
import { ruleHandlers } from '@/entities/rule/api/handlers'
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
  ...bookmarkHandlers,
  ...followHandlers,
  ...onboardingHandlers,
  ...curriculumHandlers,
  ...retrospectiveHandlers,
  ...reviewHandlers,
  ...aiHandlers,
  ...notificationHandlers,
  ...ruleHandlers,
  ...operationHandlers,
  ...boardHandlers,
]
