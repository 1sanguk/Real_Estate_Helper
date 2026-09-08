# 아이디 로그인 및 Supabase 설정

## 인증 흐름

1. 사용자는 별도의 아이디, 이메일, 닉네임과 비밀번호로 가입한다.
2. 이메일 인증이 완료되면 아이디와 비밀번호로 로그인한다.
3. 서버가 아이디에 해당하는 인증 이메일을 내부에서 조회하고 Supabase Auth로 비밀번호를 검증한다.
4. Supabase 사용자 ID를 기준으로 개인 프로필, 관심 공고, 서류 준비 상태를 분리한다.

## Supabase 설정

1. Supabase 프로젝트를 생성한다.
2. SQL Editor에서 `supabase/migrations/202609070001_initial_user_data.sql`을 실행한다.
3. Authentication → Providers → Email에서 이메일 로그인을 활성화한다.
4. Authentication → URL Configuration에 운영 URL과 `/reset-password` 경로를 등록한다.
5. `.env.example`을 참고해 로컬 `.env.local`에 URL, Publishable Key, 서버 전용 Service Role Key를 입력한다.

## 보안 원칙

- Service Role Key는 브라우저 환경변수에 넣지 않는다.
- 브라우저에는 Supabase Publishable Key만 노출한다.
- 모든 사용자 데이터 테이블에 RLS를 활성화하고 `auth.uid()`로 소유권을 검사한다.
- 비밀번호는 직접 SHA-256 처리하지 않고 Supabase Auth의 솔트 기반 bcrypt 해싱에 맡긴다.
- 주민등록번호, 증명서 원본 등 자격 탐색에 불필요한 민감정보는 저장하지 않는다.
