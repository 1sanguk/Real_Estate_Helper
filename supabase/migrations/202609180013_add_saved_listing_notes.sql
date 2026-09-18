create table if not exists public.saved_listing_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_listing_id text not null references public.official_listings(source_listing_id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_listing_id)
);

alter table public.saved_listing_notes enable row level security;

create policy "saved_listing_notes_owner_all" on public.saved_listing_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.saved_listing_notes is '사용자가 관심 공고에 작성한 개인 메모';
