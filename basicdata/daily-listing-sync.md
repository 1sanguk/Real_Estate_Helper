# 매일 공고 동기화

## 실행 시각

`.github/workflows/daily-listing-sync.yml`이 매일 오전 10시(KST)에 실행된다. GitHub Actions cron은 UTC 기준이므로 `0 1 * * *`로 설정한다. 필요하면 Actions 화면에서 수동 실행할 수 있다.

## 처리 순서

1. 공공데이터포털의 LH 분양·임대 공고문 API에서 공고를 가져온다.
2. 각 공고의 PAN ID로 공급정보 API를 조회한다.
3. 상세정보 API에서 신청 일정, 단지, 계약 장소와 공식 첨부파일을 가져온다.
4. 정규화한 실제 공고를 `official_listings`에 upsert한다.
5. 조건 설정을 완료한 모든 사용자의 프로필을 읽는다.
6. 사용자와 공고 조합별 1차 적합성을 다시 계산해 `user_listing_matches`에 upsert한다.
7. 실행 결과를 `listing_sync_runs`에 기록한다. API가 빈 결과를 반환하면 기존 공고를 삭제하지 않고 작업을 실패 처리한다.
8. LangGraph 워크플로가 이전 공고와 새 응답의 주요 필드를 비교해 변경 이력을 저장한다.
9. 접수 기간, 상태, 공급 수 등 관심 공고의 변경이 감지되면 알림을 허용한 사용자에게 변경 전후 내용을 알린다.

현재 자동 판정은 확정 자격 판정이 아니다. 공고별 소득·자산·우선순위 등 구조화하지 못한 조건은 `추가 확인`으로 안내하고 공식 공고문 확인을 요구한다.

## GitHub Actions Secrets

- `PUBLIC_SERVICE_KEY`: LH·HUG 및 향후 SH 공식 API에 공통으로 사용하는 공공데이터포털 일반 인증키
- `LH_ANNOUNCEMENT_API_URL`: 활용신청 상세 화면의 공고문 요청 주소
- `LH_SUPPLY_API_URL`: 활용신청 상세 화면의 공급정보 요청 주소
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: 서버 전용 service role 키

비밀값은 저장소 파일이나 `.openai/hosting.json`에 넣지 않는다.
