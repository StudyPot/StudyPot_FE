# SSAFY Coach Backend Rubric Evidence

이 문서는 SSAFY Coach가 `StudyPot_FE` 제출물을 분석할 때 백엔드 구현 근거를 함께 찾을 수 있도록, 백엔드 저장소와 루브릭별 Controller/Service/Mapper/Test 경로를 고정한다.

## Backend Sources

- Frontend analyzed by Coach: `StudyPot_FE` `dev` `e74eaa5a386607112a44488df19c6af9e815aa01`
- Public backend source already recognized by Coach: `StudyPot_BE` `main` `e3f8438cdebe1d5b1a220de093dbc18f59f7f40a`
- SSAFY backend submission mirror baseline: `framework_back_hw_09_2` `master` `d9050532a1d9d2c194edea6b19a18795f00057c3`
- SSAFY backend submission mirror after this recovery: `framework_back_hw_09_2` `master` `4abd8ecc94a9551896e1d7193ddf1f37973b662b`

## Rubric Map

| Rubric | Coach improvement request | Backend evidence |
| --- | --- | --- |
| #01 | CRUD Controller/Service/Mapper, validation, status codes | `src/main/java/com/studypot/aistudyleader/rubric/controller/RubricStudyGroupController.java:L41-L100`, `src/main/java/com/studypot/aistudyleader/rubric/RubricStudyGroupService.java:L19-L82`, `src/main/java/com/studypot/aistudyleader/rubric/RubricStudyGroupMapper.java:L8-L17`, `src/main/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupController.java:L76-L117`, `src/test/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupControllerTest.java:L268-L313` |
| #02 | list/search/sort/pagination Mapper evidence | `src/main/java/com/studypot/aistudyleader/studygroup/repository/StudyGroupMyBatisSqlProvider.java:L24-L112`, `src/main/java/com/studypot/aistudyleader/studygroup/repository/StudyGroupMyBatisMapper.java:L36-L42`, `src/main/java/com/studypot/aistudyleader/studygroup/catalog/StudyGroupCatalogService.java:L34-L43`, `src/main/java/com/studypot/aistudyleader/studygroup/board/repository/GroupBoardJdbcSql.java:L71-L108`, `src/test/java/com/studypot/aistudyleader/studygroup/repository/StudyGroupMyBatisSqlProviderTest.java:L34-L58` |
| #03 | detail response, joined data, 404/403 handling | `src/main/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupController.java:L112-L117`, `src/main/java/com/studypot/aistudyleader/studygroup/service/StudyGroupService.java:L123-L130`, `src/main/java/com/studypot/aistudyleader/studygroup/repository/JdbcStudyGroupRepository.java:L107-L117`, `src/main/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardController.java:L151-L158`, `src/main/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardService.java:L100-L105`, `src/test/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupControllerTest.java:L283-L313` |
| #04 | review duplicate prevention, average rating, author permission | `src/main/java/com/studypot/aistudyleader/review/controller/ReviewController.java:L47-L98`, `src/main/java/com/studypot/aistudyleader/review/ReviewService.java:L28-L65`, `src/main/java/com/studypot/aistudyleader/review/ReviewRatingSummary.java:L5`, `src/test/java/com/studypot/aistudyleader/review/ReviewServiceTest.java:L19-L54` |
| #06 | signup hashing, duplicate check, input validation | `src/main/java/com/studypot/aistudyleader/auth/controller/SignupController.java:L31-L57`, `src/main/java/com/studypot/aistudyleader/auth/service/SignupService.java:L35-L61`, `src/main/java/com/studypot/aistudyleader/auth/domain/AuthUser.java:L68-L116`, `src/main/java/com/studypot/aistudyleader/auth/repository/AuthJdbcSql.java:L29-L48`, `src/main/resources/db/migration/V5__users_password_hash.sql:L1-L2`, `src/test/java/com/studypot/aistudyleader/auth/service/SignupServiceTest.java:L33-L69` |
| #07 | profile image and domain-specific profile attributes | `src/main/java/com/studypot/aistudyleader/auth/controller/AuthController.java:L143-L169`, `src/main/java/com/studypot/aistudyleader/auth/service/AuthSessionService.java:L91-L106`, `src/main/java/com/studypot/aistudyleader/auth/domain/AuthUser.java:L96-L135`, `src/main/java/com/studypot/aistudyleader/auth/repository/JdbcAuthAccountRepository.java:L55-L84`, `src/test/java/com/studypot/aistudyleader/auth/controller/AuthControllerTest.java:L331-L358`, `src/main/java/com/studypot/aistudyleader/studygroup/controller/StudyGroupController.java:L133-L164` |
| #10 | board category classification, permission validation, sort options | `src/main/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardController.java:L69-L206`, `src/main/java/com/studypot/aistudyleader/studygroup/board/domain/GroupBoardType.java:L1-L39`, `src/main/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardService.java:L40-L138`, `src/main/java/com/studypot/aistudyleader/studygroup/board/repository/GroupBoardJdbcSql.java:L71-L161`, `src/test/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardServiceTest.java:L44-L174` |
| #11 | comment create/update/delete and post relation integrity | `src/main/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardController.java:L222-L313`, `src/main/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardService.java:L143-L212`, `src/main/java/com/studypot/aistudyleader/studygroup/board/repository/GroupBoardJdbcSql.java:L166-L247`, `src/main/java/com/studypot/aistudyleader/studygroup/board/repository/JdbcGroupBoardRepository.java:L182-L235`, `src/test/java/com/studypot/aistudyleader/studygroup/board/controller/GroupBoardControllerTest.java:L101-L111`, `src/test/java/com/studypot/aistudyleader/studygroup/board/service/GroupBoardServiceTest.java:L178-L201` |

## Verification Commands

The backend recovery commit `4abd8ecc94a9551896e1d7193ddf1f37973b662b` was checked with:

```sh
./gradlew test --tests '*Auth*' --no-daemon
./gradlew test --tests 'com.studypot.aistudyleader.studygroup.board.controller.GroupBoardControllerTest' --tests 'com.studypot.aistudyleader.studygroup.board.service.GroupBoardServiceTest' --tests 'com.studypot.aistudyleader.studygroup.board.repository.JdbcGroupBoardRepositoryTest' --tests 'com.studypot.aistudyleader.studygroup.controller.StudyGroupControllerTest' --tests 'com.studypot.aistudyleader.studygroup.service.StudyGroupServiceTest' --tests 'com.studypot.aistudyleader.studygroup.repository.JdbcStudyGroupRepositoryTest' --tests 'com.studypot.aistudyleader.studygroup.repository.StudyGroupMyBatisSqlProviderTest' --tests 'com.studypot.aistudyleader.review.ReviewServiceTest' --no-daemon
./gradlew test --no-daemon
```

The frontend evidence contract is checked by:

```sh
npm run test:unit -- src/shared/submission/__tests__/backendRubricEvidence.spec.ts --run
```
