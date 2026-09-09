create table if not exists public.listing_details (
  source_listing_id text primary key references public.official_listings(source_listing_id) on delete cascade,
  application_schedules jsonb not null default '[]'::jsonb,
  complexes jsonb not null default '[]'::jsonb,
  contract_places jsonb not null default '[]'::jsonb,
  raw_data jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.listing_attachments (
  id bigint generated always as identity primary key,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  name text not null,
  document_type text not null,
  source_url text not null,
  synced_at timestamptz not null default now(),
  unique (source_listing_id, source_url)
);

create index if not exists listing_attachments_listing_idx
  on public.listing_attachments (source_listing_id);

alter table public.listing_details enable row level security;
alter table public.listing_attachments enable row level security;

create policy "authenticated_read_listing_details" on public.listing_details
  for select to authenticated using (true);
create policy "authenticated_read_listing_attachments" on public.listing_attachments
  for select to authenticated using (true);

comment on table public.listing_details is 'LH 상세 API에서 수집한 일정, 단지, 계약 장소와 원본 데이터';
comment on table public.listing_attachments is 'LH 공고별 공식 첨부파일 주소와 문서 유형';
