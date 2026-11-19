# 웹 화면으로 Supabase·Vercel 연결하기

비밀 값이나 비밀번호를 이 대화에 보내지 마세요. 서비스 설정 화면에 직접 입력합니다. 현재 GitHub에는 확인 완료된 1단계만 반영되어 있으므로, 아래 Vercel 가져오기는 **최종 확인 후 최신 코드가 GitHub에 올라간 뒤** 진행합니다.

## 1. Supabase 준비

1. https://supabase.com/dashboard 에 로그인하고 사용할 기존 프로젝트를 엽니다.
2. **SQL Editor**에서 `supabase/migrations/202611190001_career_planner.sql` 내용을 실행합니다. 이미 동일한 테이블이 있는 프로젝트에는 그대로 다시 실행하지 말고 기존 구조를 확인합니다.
3. 나머지 마이그레이션도 파일명 순서(002~011)대로 실행합니다. 직접 입력 분류, 보드 상태, 고정 시간표, 휴지통, 프로젝트 일정 연결, 자료 첨부, 우선순위와 프로젝트 종료 보관을 추가합니다. 011은 주간 우선순위 저장에 필요하며, 기존 월간 기록은 유지합니다.
4. 사용자 격리를 확인할 때는 `supabase/verify-rls.sql`을 실행합니다. 검증 자료는 마지막에 되돌려집니다. 오류가 나면 실제 서비스 이용 전에 원인을 확인합니다.
5. **Authentication → Providers**에서 이메일 로그인을 활성화합니다. 이메일 확인을 사용하는 경우 가입 후 받은 편지함에서 확인해야 합니다.
6. 프로젝트 설정에서 **Project URL**과 **publishable key**를 찾습니다. 구형 프로젝트는 `anon` 공개 키를 사용할 수 있습니다. `service_role`, `sb_secret_` 등 비밀 키는 사용하지 않습니다.

## 2. Vercel에서 시안 세 개 만들기

https://vercel.com/new 에 로그인하고 GitHub의 `Uzn1/Careertrack` 저장소를 가져옵니다. 동일 저장소로 아래 세 프로젝트를 각각 만듭니다.

공통 설정:

- **Root Directory**: 저장소 루트(기본값). 공유 레이어와 전체 npm 워크스페이스가 함께 있어야 합니다.
- **Framework Preset**: Other.
- **Install Command**: `npm ci`.
- 배포 접근 권한은 계정의 Deployment Protection 설정에서 확인합니다. 테스트 링크를 외부에 공개하기 전에 의도한 접근 범위인지 확인합니다.

| 프로젝트 이름 예시 | Build Command | Output Directory |
|---|---|---|
| careertrack-feed | `npm run build:feed` | `apps/feed/.output/public` |
| careertrack-calendar | `npm run build:calendar` | `apps/calendar/.output/public` |
| careertrack-workspace | `npm run build:workspace` | `apps/workspace/.output/public` |

각 프로젝트의 **Settings → Environment Variables**에 다음 항목을 직접 입력합니다.

| 변수 이름 | 넣을 값 |
|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NUXT_PUBLIC_SUPABASE_KEY` | Supabase 공개 publishable/anon 키 |

정적 앱이므로 환경변수를 바꾼 뒤에는 **Redeploy**해야 합니다. 비밀 키는 웹 코드에 넣을 수 없도록 빌드에서 차단합니다. 프런트엔드의 공개 키는 사용자별 DB 접근 제한(RLS)과 함께 사용합니다.

## 3. 로그인 복귀 주소 등록

세 프로젝트의 실제 배포 주소가 나온 후, Supabase의 **Authentication → URL Configuration**에서 다음을 설정합니다.

- Site URL: 주로 사용할 시안의 실제 주소.
- Redirect URLs: 세 시안 각각의 홈페이지 주소와 `/?recovery=1` 주소.
- 배포 주소가 바뀌면 허용 주소도 갱신합니다. 예시 주소를 실제 주소처럼 등록하지 마세요.

로컬에서도 실제 계정을 확인하려면 `.env.example`을 참고해 루트 `.env`에 공개 연결 값만 직접 설정하고 개발 서버를 다시 시작합니다. `.env`는 Git에서 제외됩니다.

## 4. 연결 후 확인

1. 계정을 만들고 이메일 확인 후 로그인합니다.
2. 프로젝트·자료·할 일을 만들고 새로고침하여 저장을 확인합니다.
3. 다른 시안에서 같은 계정으로 로그인하고 **데이터 새로고침**을 눌러 같은 자료를 확인합니다.
4. 다른 계정으로 로그인해 첫 계정의 자료가 보이지 않는지 확인합니다.
5. 비밀번호 재설정 메일의 링크가 배포 주소로 돌아오는지 확인합니다.

로그인과 실제 DB·배포 주소가 확인되기 전까지는 계정 연동 및 배포가 완료된 상태가 아닙니다.
