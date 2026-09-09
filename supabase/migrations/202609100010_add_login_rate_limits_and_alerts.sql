create table if not exists public.login_rate_limits (
  identity_hash text primary key,
  failed_count integer not null default 0,
  first_failed_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_rate_limits enable row level security;
revoke all on public.login_rate_limits from anon, authenticated;

alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check (kind in ('new_match', 'deadline', 'listing_changed', 'sync_failed'));

comment on table public.login_rate_limits is '아이디와 접속 주소를 단방향 해시한 로그인 실패 제한 정보';
