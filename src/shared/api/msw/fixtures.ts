import aiTeamLeaderData from './data/ai-team-leader.json'
import authData from './data/auth.json'
import curriculumData from './data/curriculum.json'
import groupsData from './data/groups.json'
import notificationsData from './data/notifications.json'
import onboardingData from './data/onboarding.json'
import retrospectiveData from './data/retrospective.json'
import rulesData from './data/rules.json'
import userData from './data/user.json'

export const mockUser = userData.currentUser

export const mockMswData = {
  aiTeamLeader: aiTeamLeaderData,
  auth: authData,
  curriculum: curriculumData,
  groups: groupsData,
  notifications: notificationsData,
  onboarding: onboardingData,
  retrospective: retrospectiveData,
  rules: rulesData,
  user: userData,
}
