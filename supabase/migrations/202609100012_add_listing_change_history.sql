create table if not exists public.listing_change_events (
  id bigint generated always as identity primary key,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  fingerprint text not null,
  changed_fields jsonb not null default '[]'::jsonb,
  summary text not null,
  detected_at timestamptz not null default now(),
  unique (source_listing_id, fingerprint)
);

create index if not exists listing_change_events_listing_time_idx
  on public.listing_change_events (source_listing_id, detected_at desc);

alter table public.listing_change_events enable row level security;

create policy "authenticated_read_listing_change_events" on public.listing_change_events
  for select to authenticated using (true);

revoke insert, update, delete on public.listing_change_events from anon, authenticated;

comment on table public.listing_change_events is '공식 API 재수집 과정에서 감지한 공고 주요 항목 변경 이력';

alter table public.notification_preferences
  add column if not exists listing_change_enabled boolean not null default true;
