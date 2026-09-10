# 아이디 로그인 및 Supabase 설정

## 인증 흐름

이 앱은 GitHub Pages에 배포되는 정적 사이트이며 상시 실행되는 자체 서버가 없다. 인증·중복확인·검수 저장은 모두 브라우저에서 Supabase Publishable Key로 직접 처리하고, RLS(행 단위 권한)와 `security definer` 함수로 접근을 제한한다.

1. 사용자는 별도의 아이디, 이메일, 닉네임과 비밀번호로 가입한다. 가입은 브라우저에서 `supabase.auth.signUp()`을 직접 호출하며, 아이디·닉네임은 `is_identifier_available` RPC로 사전 확인한다.
2. 이메일 인증이 완료되면 아이디와 비밀번호로 로그인한다.
3. 브라우저가 `get_email_for_username` RPC로 아이디에 해당하는 이메일만 조회하고, 곧바로 `supabase.auth.signInWithPassword`로 비밀번호를 검증한다. 두 함수 모두 이메일 전체를 노출하지 않고 필요한 값만 반환하도록 `security definer`로 제한한다.
4. Supabase 사용자 ID를 기준으로 개인 프로필, 관심 공고, 서류 준비 상태를 분리한다.

### 서버가 필요한 단 하나의 예외: 회원 탈퇴

Supabase는 `auth.users` 삭제(`auth.admin.deleteUser`)를 공개 키로 절대 허용하지 않는다. 이 작업만 `supabase/functions/delete-account`의 Supabase Edge Function이 서비스 롤 키로 처리한다. GitHub Pages나 별도 서버가 아니라 Supabase 자체 서버리스 함수이므로 상시 서버 없이도 배포할 수 있다.

### 로그인 실패 제한 관련 변경

과거에는 서버가 아이디·접속 주소별 로그인 실패 횟수를 세어 15분간 차단했다(`login_rate_limits` 테이블). 서버가 없어지면서 이 기능은 더 이상 앱에서 강제하지 않으며, 대신 Supabase Auth 자체의 로그인 시도 제한에 맡긴다.

### 관리자 검수(listing_reviews) 관련 변경

과거에는 서버(service role)만 `listing_reviews`에 쓸 수 있었다. 지금은 `admin_users`에 속한 로그인 사용자가 RLS 정책(`admin_insert_listing_reviews`, `admin_update_listing_reviews`)을 통해 브라우저에서 직접 쓴다.

## Supabase 설정

1. Supabase 프로젝트를 생성한다.
2. SQL Editor에서 `supabase/migrations/202609070001_initial_user_data.sql`을 실행한다.
3. Authentication → Providers → Email에서 이메일 로그인을 활성화한다.
4. Authentication → URL Configuration에 운영 URL과 `/reset-password` 경로를 등록한다.
5. `.env.example`을 참고해 로컬 `.env.local`에 URL, Publishable Key, 서버 전용 Service Role Key를 입력한다.
6. Supabase CLI로 `supabase functions deploy delete-account`를 실행해 회원 탈퇴 Edge Function을 배포한다. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 Edge Function에 자동으로 주입하므로 별도 설정이 필요 없다.

## 보안 원칙

- Service Role Key는 브라우저 환경변수에 넣지 않는다.
- 브라우저에는 Supabase Publishable Key만 노출한다.
- 모든 사용자 데이터 테이블에 RLS를 활성화하고 `auth.uid()`로 소유권을 검사한다.
- 비밀번호는 직접 SHA-256 처리하지 않고 Supabase Auth의 솔트 기반 bcrypt 해싱에 맡긴다.
- 주민등록번호, 증명서 원본 등 자격 탐색에 불필요한 민감정보는 저장하지 않는다.
