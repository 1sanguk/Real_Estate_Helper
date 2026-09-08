create table if not exists public.official_listings (
  source_listing_id text primary key,
  agency text not null check (agency in ('LH', 'SH', 'HUG')),
  title text not null,
  program text not null,
  region text not null,
  address text,
  area text,
  units text,
  published_at date,
  application_period text,
  status text not null,
  minimum_age integer,
  source_url text not null,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.user_listing_matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  match_status text not null check (match_status in ('가능성 있음', '추가 확인', '어려움')),
  reason text not null,
  calculated_at timestamptz not null default now(),
  primary key (user_id, source_listing_id)
);

create table if not exists public.listing_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  listing_count integer not null default 0,
  match_count integer not null default 0,
  error_message text
);

create index if not exists official_listings_published_at_idx on public.official_listings (published_at desc);
create index if not exists user_listing_matches_user_id_idx on public.user_listing_matches (user_id, calculated_at desc);

alter table public.official_listings enable row level security;
alter table public.user_listing_matches enable row level security;
alter table public.listing_sync_runs enable row level security;

create policy "authenticated_read_official_listings" on public.official_listings
  for select to authenticated using (true);
create policy "users_read_own_listing_matches" on public.user_listing_matches
  for select to authenticated using (auth.uid() = user_id);

comment on table public.official_listings is '공식 기관 API에서 수집한 공고 원본 및 정규화 데이터';
comment on table public.user_listing_matches is '매일 재계산한 사용자별 공고 1차 적합성 결과';
comment on table public.listing_sync_runs is '공고 수집 및 사용자별 재계산 실행 이력';
