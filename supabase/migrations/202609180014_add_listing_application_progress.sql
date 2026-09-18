create table if not exists public.listing_application_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  status text not null default '검토 전' check (status in ('검토 전', '서류 준비 중', '신청 완료')),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_listing_id)
);

alter table public.listing_application_progress enable row level security;

create policy "listing_application_progress_owner_all" on public.listing_application_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.listing_application_progress is '사용자의 공고별 지원 준비 단계';
