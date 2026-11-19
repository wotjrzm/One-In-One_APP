# One-In-One

하루에 카테고리별 문제 하나씩 풀고, 결과를 내 GitHub 저장소에 자동으로 커밋하는 모바일 우선 웹 앱입니다.

## 소개

GitHub로 로그인한 뒤 하루에 AI / 네트워크 / Claude Code / 코딩 테스트 문제를 카테고리별로 하나씩 풀면, 자동 채점 후 풀이 기록이 내 GitHub 저장소에 커밋됩니다.

핵심 기능
- GitHub 로그인 (OAuth)
- 카테고리별 하루 한 문제 (한국 시간 KST 기준, 날짜에 따라 문제가 순환)
- 객관식(AI, 네트워크, Claude Code)과 파이썬 코딩 테스트 자동 채점
- 풀이 결과를 내 GitHub 저장소에 자동 커밋 (실패하면 매일 크론이 재시도)
- 랭킹과 프로필 화면 (랭킹에서 나를 숨길 수 있음)

기술 스택: Next.js 15 (App Router), TypeScript, Supabase(데이터베이스), Vercel(배포).

## 로컬 실행

필요한 것: Node.js 20 이상, npm.

```bash
npm install
cp .env.example .env.local
```

`.env.local` 파일을 열어 아래 항목을 채웁니다. 각 값을 얻는 방법은 이어지는 섹션에 있습니다.

| 변수 | 설명 |
| --- | --- |
| `AUTH_SECRET` | 로그인 세션 암호화용 비밀 값 |
| `AUTH_GITHUB_ID` | GitHub OAuth 앱의 Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth 앱의 Client secret |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키 (서버 전용) |
| `TOKEN_ENC_KEY` | GitHub 토큰 암호화 키 |
| `CRON_SECRET` | 크론 엔드포인트 보호용 비밀 값 |

그다음 개발 서버를 실행하고 http://localhost:3000 에 접속합니다.

```bash
npm run dev
```

`.env.local`은 절대 git에 커밋하지 마세요.

## GitHub OAuth 앱 만들기

1. GitHub에서 Settings > Developer settings > OAuth Apps > New OAuth App 으로 이동합니다.
2. 아래처럼 입력합니다.
   - Application name: 원하는 이름 (예: One-In-One)
   - Homepage URL: 로컬은 `http://localhost:3000`, 배포는 `https://<도메인>`
   - Authorization callback URL
     - 로컬: `http://localhost:3000/api/auth/callback/github`
     - 배포: `https://<도메인>/api/auth/callback/github`
3. 앱을 만든 뒤 Client ID를 `AUTH_GITHUB_ID`에, Generate a new client secret으로 만든 값을 `AUTH_GITHUB_SECRET`에 넣습니다.

주의: OAuth 앱 하나에는 콜백 URL을 하나만 등록할 수 있습니다. 따라서 로컬용 앱과 배포용 앱을 따로 만들고, 각각의 Client ID/secret을 해당 환경에 넣으세요.

앱은 로그인 시 `read:user public_repo` 권한을 요청합니다. 풀이 기록을 공개 저장소에 커밋하기 위해서입니다.

## Supabase 설정

1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. 왼쪽 메뉴의 SQL Editor를 열고, 이 저장소의 `supabase/migrations/0001_init.sql` 내용을 붙여 넣어 실행합니다. `users`, `attempts` 테이블이 생성됩니다.
3. Project Settings > API 에서 값을 복사합니다.
   - Project URL -> `SUPABASE_URL`
   - `service_role` 키 -> `SUPABASE_SERVICE_ROLE_KEY`

경고: service role 키는 모든 데이터 접근 권한을 가진 서버 전용 키입니다. 브라우저 코드, 공개 저장소, 스크린샷, 채팅 등에 절대 노출하지 마세요. `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다. 유출되었다면 Supabase에서 즉시 키를 재발급하세요.

## 비밀 값 만들기

`TOKEN_ENC_KEY` (사용자의 GitHub 토큰을 DB에 저장하기 전에 암호화하는 키):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`AUTH_SECRET`: 아래 둘 중 하나를 사용합니다.

```bash
npx auth secret
# 또는 위와 같은 node 명령
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`CRON_SECRET`: 같은 node 명령으로 만든 임의의 긴 문자열을 사용합니다.

`TOKEN_ENC_KEY`를 바꾸면 이미 저장된 토큰을 복호화할 수 없으니, 운영 중에는 함부로 바꾸지 마세요. 환경마다(로컬/배포) 각각 다른 값을 쓰는 것을 권장합니다.

## Vercel 배포

1. 이 저장소를 GitHub에 올린 뒤, Vercel에서 Add New > Project로 저장소를 import 합니다.
2. Environment Variables에 위 표의 7개 변수를 모두 등록합니다. (`AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`은 배포용 OAuth 앱의 값)
3. Deploy 합니다. 배포 도메인이 정해지면, 배포용 GitHub OAuth 앱의 콜백 URL이 `https://<도메인>/api/auth/callback/github`인지 확인합니다.

크론: `vercel.json`에 `/api/cron/retry`가 매일 `0 15 * * *`(UTC, 한국 시간 자정)에 실행되도록 설정되어 있습니다. 커밋에 실패한 풀이 기록을 다시 커밋하는 작업입니다. Vercel은 `CRON_SECRET` 환경 변수가 설정되어 있으면 크론 호출 시 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동으로 붙여 줍니다. 엔드포인트는 이 헤더가 맞지 않으면 401을 반환합니다. 별도 설정은 필요 없습니다.

## 테스트

```bash
npm test            # 단위 테스트 (Vitest)
npm run test:e2e    # 화면 테스트 (Playwright)
npm run lint        # 린트
npm run build       # 프로덕션 빌드 확인
```

Playwright를 처음 사용할 때는 브라우저를 한 번 설치합니다.

```bash
npx playwright install chromium
```

e2e 테스트는 3100번 포트로 개발 서버를 자동 실행하며, 가짜 세션을 사용하므로 실제 GitHub나 Supabase 설정이 필요하지 않습니다.

## 문제 검토와 추가

### 위치와 형식

문제는 `content/problems/<카테고리>/<id>.json` 파일 하나가 문제 하나입니다. 카테고리 폴더는 `ai`, `network`, `claude-code`, `coding-test` 입니다.

- `id`는 `<카테고리>-<숫자 3자리>` 형식이고 파일 이름과 같아야 합니다. 예: `ai-008` -> `content/problems/ai/ai-008.json`
- `id`는 `type`으로 시작해야 합니다.
- 형식이 잘못되면 문제 은행을 불러올 때 오류가 나므로 테스트에서 바로 잡힙니다.

공통 필드: `id`, `type`, `title`, `prompt`, `explanation`(해설), `reviewed`(true/false).

객관식 (`ai`, `network`, `claude-code`) 추가 필드

```json
{
  "id": "ai-008",
  "type": "ai",
  "title": "제목",
  "prompt": "문제 설명",
  "choices": ["보기 1", "보기 2", "보기 3", "보기 4"],
  "answerIndex": 2,
  "explanation": "해설",
  "reviewed": false
}
```

- `choices`: 정확히 4개의 문자열
- `answerIndex`: 정답 위치 (0~3, 0부터 시작)

코딩 테스트 (`coding-test`) 추가 필드

```json
{
  "id": "coding-test-008",
  "type": "coding-test",
  "title": "배열의 합",
  "prompt": "문제 설명",
  "examples": [{ "input": "nums = [1, 2, 3, 4]", "output": "10" }],
  "starterCode": "def solution(nums):\n    pass\n",
  "functionName": "solution",
  "tests": [{ "args": [[1, 2, 3, 4]], "expected": 10 }],
  "explanation": "해설",
  "reviewed": false
}
```

- `examples`: 화면에 보여 줄 입출력 예시 (`input`, `output` 문자열)
- `starterCode`: 편집기에 처음 채워질 파이썬 코드
- `functionName`: 채점 시 호출할 함수 이름
- `tests`: 채점 케이스 목록 (비어 있으면 안 됨). `args`는 인자 배열, `expected`는 기대 반환값

### 모범 답안

코딩 테스트 문제를 추가하면 같은 이름의 모범 답안 `tests/content/solutions/<id>.py`도 함께 추가하세요. 예: `tests/content/solutions/coding-test-001.py`. 이 풀이가 모든 `tests`를 통과하는지 테스트에서 검증합니다.

### 검토 후 공개

처음 작성한 문제는 `"reviewed": false`입니다. 정답, 보기, 해설을 사람이 직접 확인한 뒤 `"reviewed": true`로 바꾸면 그때부터 출제됩니다. 앱은 `reviewed`가 `true`인 문제만 서비스합니다.

### 출제 방식

각 카테고리에서 검토 완료된 문제들이 기준일로부터의 날짜 수에 따라 순환하며 하루에 하나씩 출제됩니다. 검토 완료 문제가 하나도 없는 카테고리는 출제되지 않습니다. 문제를 추가하거나 `reviewed`를 바꾸면 순환 순서가 달라질 수 있습니다.

문제를 수정한 뒤에는 `npm test`로 형식과 모범 답안이 올바른지 확인하세요.
