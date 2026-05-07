# Jira 연동 자동화

## 개요

이 프로젝트는 GitHub PR에서 Jira 이슈 키를 자동으로 확인하도록 설정합니다.

- PR 제목 또는 브랜치 이름에 Jira 이슈 키가 있어야 합니다.
- 이슈 키가 있으면 GitHub Actions가 PR에 Jira 연동 안내 댓글을 남깁니다.
- 저장소 변수 `JIRA_BASE_URL`를 설정하면 PR 댓글에 Jira 바로가기 링크도 자동으로 표시됩니다.

## 현재 자동화 범위

저장소 안에서 자동으로 처리되는 항목:

- PR 제목 또는 브랜치 이름에서 Jira 이슈 키 검사
- Jira 이슈 키가 없으면 PR 체크 실패
- Jira 이슈 키가 있으면 PR 댓글에 연동 정보 표시
- `JIRA_BASE_URL` 설정 시 Jira 링크 자동 생성
- GitHub Actions 수동 실행으로 Jira 티켓 생성

현재 자동화에 포함되지 않는 항목:

- Jira 상태 자동 변경
- Jira 코멘트 자동 작성
- 작업 시간 자동 기록

위 항목은 Jira 권한, 워크플로 상태명, API 토큰 정책이 필요하므로 별도 합의 후 추가하는 것을 권장합니다.

## PR 제목 규칙

권장 형식:

```txt
[TYPE] STUDY-123 작업 설명
```

예:

- `[FEAT] STUDY-123 회원가입 페이지 추가`
- `[FIX] STUDY-456 잘못된 폼 검증 수정`
- `[BUILD] STUDY-789 eslint 설정 정리`

## 브랜치 이름 규칙

권장 형식:

```txt
STUDY-123/branch-name
```

예:

- `STUDY-123/signup-page`
- `STUDY-456/fix-login-button`
- `STUDY-789/eslint-setup`

## 저장소 설정

GitHub 저장소에서 아래 변수를 설정하면 Jira 링크가 자동으로 생성됩니다.

- 변수 이름: `JIRA_BASE_URL`
- 예시 값: `https://your-domain.atlassian.net/browse`

설정 위치:

1. GitHub 저장소 `Settings`
2. `Secrets and variables`
3. `Actions`
4. `Variables`
5. `New repository variable`

## GitHub Actions 파일

다음 워크플로가 Jira PR 자동화를 담당합니다.

- `.github/workflows/jira-pr-automation.yml`
- `.github/workflows/create-jira-issue.yml`

동작 방식:

1. PR이 열리거나 수정되면 실행됩니다.
2. PR 제목에서 Jira 이슈 키를 먼저 찾습니다.
3. 없으면 브랜치 이름에서 Jira 이슈 키를 찾습니다.
4. 둘 다 없으면 체크를 실패시킵니다.
5. 이슈 키가 있으면 PR에 Jira 연동 댓글을 남깁니다.

## Jira 티켓 생성 워크플로

처음 사용하는 사람은 아래 순서대로 테스트하면 됩니다.

1. 기본 브랜치에 `.github/workflows/create-jira-issue.yml`이 들어간 상태로 push합니다.
2. GitHub 저장소의 `Actions` 탭으로 이동합니다.
3. 왼쪽 목록에서 `Create Jira Issue`를 선택합니다.
4. 오른쪽의 `Run workflow`를 누릅니다.
5. `summary`에 Jira 티켓 제목을 입력합니다.
6. 필요하면 `description`도 함께 입력합니다.
7. 실행이 끝나면 워크플로 요약에서 Jira 키와 Jira 링크를 확인합니다.

예시:

- `summary`: `회원가입 페이지 UI 작업`
- `description`: `이메일, 비밀번호, 확인 비밀번호 입력 폼을 구성한다.`

성공하면 보통 이런 흐름으로 이어집니다.

1. Jira에서 `STUDY-123` 같은 이슈 키가 생성됩니다.
2. 브랜치를 `STUDY-123/signup-page`처럼 만듭니다.
3. PR 제목도 `[FEAT] STUDY-123 회원가입 페이지 추가`처럼 작성합니다.

## 처음부터 자동으로 안 하고 수동 실행부터 시작하는 이유

- 실패해도 어디에서 막혔는지 확인하기 쉽습니다.
- Jira 프로젝트의 실제 이슈 타입 이름이나 필수 필드를 바로 점검할 수 있습니다.
- 이슈 키를 먼저 만든 뒤 브랜치와 PR에 같은 키를 붙이기 쉽습니다.

## 자주 막히는 원인

- `JIRA_PROJECT_KEY`가 실제 Jira 프로젝트 키와 다름
- `JIRA_ISSUE_TYPE` 값이 실제 Jira 이슈 타입 이름과 다름
- Jira 프로젝트에 추가 필수 필드가 있어서 `summary`만으로 생성이 안 됨
- `JIRA_API_TOKEN` 또는 `JIRA_EMAIL`이 잘못됨

이 경우 워크플로 실행 로그의 Jira API 에러 메시지를 보면 원인을 바로 확인할 수 있습니다.

## Jira 관리자 설정

이 저장소 자동화만으로는 Jira 개발 정보 연동이 완전히 끝나지 않습니다.

Jira Cloud 관리자 또는 GitHub/Jira 관리자 권한으로 아래 작업이 필요합니다.

1. Jira Cloud와 GitHub를 연결합니다.
2. Jira에서 GitHub 개발 정보 연동이 활성화되어 있는지 확인합니다.
3. 필요하면 Smart Commits를 활성화합니다.

## Smart Commits

Smart Commits를 사용하면 커밋 메시지로 Jira 작업을 추가로 처리할 수 있습니다.

예:

```txt
STUDY-123 #comment 회원가입 폼 검증 수정 완료
STUDY-123 #time 1h 작업 내용 정리
STUDY-123 #transition In Review
```

주의:

- Smart Commit이 동작하려면 Jira와 GitHub 연결이 먼저 되어 있어야 합니다.
- 커밋 작성자의 이메일이 Jira 사용자와 정확히 매칭되어야 합니다.
- 워크플로 상태 이름은 Jira 프로젝트 설정과 일치해야 합니다.

## 팀 가이드

- 브랜치를 만들 때부터 Jira 이슈 키를 포함하는 것을 권장합니다.
- 커밋 메시지에도 Jira 이슈 키를 넣으면 Jira 개발 정보 연결이 더 안정적입니다.
- PR 생성 전에 제목에 Jira 이슈 키가 있는지 확인합니다.
- Jira 상태 자동 전환은 워크플로 영향이 크므로 별도 합의 후 추가합니다.
