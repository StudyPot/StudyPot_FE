import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readRepoFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('SSAFY Coach backend rubric evidence', () => {
  it('links the backend evidence document from the submitted frontend README', () => {
    expect(readRepoFile('README.md')).toContain('docs/backend-rubric-evidence.md')
  })

  it('pins backend commits and file paths for all partial backend rubrics', () => {
    const evidence = readRepoFile('docs/backend-rubric-evidence.md')

    expect(evidence).toContain('StudyPot_BE')
    expect(evidence).toContain('e3f8438cdebe1d5b1a220de093dbc18f59f7f40a')
    expect(evidence).toContain('framework_back_hw_09_2')
    expect(evidence).toContain('d9050532a1d9d2c194edea6b19a18795f00057c3')
    expect(evidence).toContain('4abd8ecc94a9551896e1d7193ddf1f37973b662b')

    for (const rubricId of ['#01', '#02', '#03', '#04', '#06', '#07', '#10', '#11']) {
      expect(evidence).toContain(rubricId)
    }

    for (const backendPath of [
      'src/main/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardController.java',
      'src/main/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardService.java',
      'src/main/java/com/studypot/aistudyleader/studygroup/board/repository/GroupBoardJdbcSql.java',
      'src/main/java/com/studypot/aistudyleader/studygroup/repository/StudyGroupMyBatisSqlProvider.java',
      'src/main/java/com/studypot/aistudyleader/review/controller/ReviewController.java',
      'src/main/java/com/studypot/aistudyleader/review/ReviewService.java',
      'src/main/java/com/studypot/aistudyleader/auth/controller/SignupController.java',
      'src/main/java/com/studypot/aistudyleader/auth/service/SignupService.java',
      'src/main/java/com/studypot/aistudyleader/auth/repository/AuthJdbcSql.java',
      'src/main/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupController.java',
      'src/main/java/com/studypot/aistudyleader/studygroup/service/StudyGroupService.java',
      'src/test/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardControllerTest.java',
      'src/test/java/com/studypot/aistudyleader/review/ReviewServiceTest.java',
      'src/test/java/com/studypot/aistudyleader/auth/service/SignupServiceTest.java',
      'src/test/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupControllerTest.java',
    ]) {
      expect(evidence).toContain(backendPath)
    }
  })

  it('keeps backend evidence inside the source files Coach links from the rubric', () => {
    const linkedSources = [
      {
        file: 'src/pages/group-workspace/ui/GroupBoardPage.vue',
        tokens: [
          'SSAFY Coach backend evidence',
          '4abd8ecc94a9551896e1d7193ddf1f37973b662b',
          '#01',
          '#10',
          '#11',
          'GroupBoardController.java',
          'GroupBoardService.java',
          'GroupBoardJdbcSql.java',
        ],
      },
      {
        file: 'src/entities/board/api/handlers.ts',
        tokens: [
          'SSAFY Coach backend evidence',
          '#02',
          '#03',
          'StudyGroupController.java',
          'StudyGroupService.java',
          'StudyGroupMyBatisSqlProvider.java',
        ],
      },
      {
        file: 'src/entities/review/api/handlers.ts',
        tokens: [
          'SSAFY Coach backend evidence',
          '#04',
          'ReviewController.java',
          'ReviewService.java',
          'ReviewServiceTest.java',
        ],
      },
      {
        file: 'src/pages/login/ui/LoginPage.vue',
        tokens: [
          'SSAFY Coach backend evidence',
          '#06',
          'SignupController.java',
          'SignupService.java',
          'V5__users_password_hash.sql',
        ],
      },
      {
        file: 'src/pages/profile/ui/ProfilePage.vue',
        tokens: [
          'SSAFY Coach backend evidence',
          '#07',
          'AuthController.java',
          'AuthSessionService.java',
          'JdbcAuthAccountRepository.java',
        ],
      },
    ]

    for (const source of linkedSources) {
      const content = readRepoFile(source.file)
      for (const token of source.tokens) {
        expect(content, `${source.file} should mention ${token}`).toContain(token)
      }
    }
  })
})
