create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  new_match_enabled boolean not null default true,
  deadline_enabled boolean not null default true,
  deadline_days integer not null default 3 check (deadline_days between 1 and 30),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_listing_id text references public.official_listings(source_listing_id) on delete cascade,
  kind text not null check (kind in ('new_match', 'deadline', 'listing_changed')),
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_listing_id, kind)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_reviews (
  source_listing_id text primary key references public.official_listings(source_listing_id) on delete cascade,
  review_status text not null check (review_status in ('pending', 'approved', 'needs_correction')) default 'pending',
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists user_notifications_user_time_idx
  on public.user_notifications (user_id, created_at desc);
create index if not exists listing_reviews_status_idx
  on public.listing_reviews (review_status, updated_at desc);

alter table public.notification_preferences enable row level security;
alter table public.user_notifications enable row level security;
alter table public.admin_users enable row level security;
alter table public.listing_reviews enable row level security;

create policy "notification_preferences_owner_all" on public.notification_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_notifications_owner_read" on public.user_notifications
  for select to authenticated using (auth.uid() = user_id);
create policy "user_notifications_owner_update" on public.user_notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin_users_read_self" on public.admin_users
  for select to authenticated using (auth.uid() = user_id);
create policy "authenticated_read_listing_reviews" on public.listing_reviews
  for select to authenticated using (true);
create policy "authenticated_read_listing_sync_runs" on public.listing_sync_runs
  for select to authenticated using (true);

revoke insert, delete on public.user_notifications from anon, authenticated;
revoke insert, update, delete on public.admin_users from anon, authenticated;
revoke insert, update, delete on public.listing_reviews from anon, authenticated;

create trigger audit_notification_preferences_changes
after insert or update or delete on public.notification_preferences
for each row execute function public.write_audit_log();

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  previous_data jsonb;
  current_data jsonb;
  target_key jsonb;
  modified_fields text[];
  sensitive_fields text[] := array['email', 'birth_date', 'monthly_income', 'total_assets', 'car_value'];
begin
  if tg_op = 'DELETE' then
    previous_data := to_jsonb(old) - sensitive_fields;
    current_data := null;
    actor_id := coalesce(auth.uid(), (to_jsonb(old) ->> 'user_id')::uuid);
  elsif tg_op = 'INSERT' then
    previous_data := null;
    current_data := to_jsonb(new) - sensitive_fields;
    actor_id := coalesce(auth.uid(), (to_jsonb(new) ->> 'user_id')::uuid);
  else
    previous_data := to_jsonb(old) - sensitive_fields;
    current_data := to_jsonb(new) - sensitive_fields;
    actor_id := coalesce(auth.uid(), (to_jsonb(new) ->> 'user_id')::uuid);
  end if;

  target_key := jsonb_build_object('user_id', actor_id);
  if tg_table_name = 'saved_listings' then
    target_key := target_key || jsonb_build_object('source_listing_id', coalesce(current_data ->> 'source_listing_id', previous_data ->> 'source_listing_id'));
  elsif tg_table_name = 'document_checks' then
    target_key := target_key || jsonb_build_object('document_key', coalesce(current_data ->> 'document_key', previous_data ->> 'document_key'));
  end if;

  if tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}') into modified_fields from jsonb_object_keys(to_jsonb(new)) as key;
  elsif tg_op = 'DELETE' then
    select coalesce(array_agg(key order by key), '{}') into modified_fields from jsonb_object_keys(to_jsonb(old)) as key;
  else
    select coalesce(array_agg(key order by key), '{}') into modified_fields
    from (select key from jsonb_object_keys(to_jsonb(new)) as key where to_jsonb(old) -> key is distinct from to_jsonb(new) -> key) changed;
  end if;

  insert into public.audit_logs (user_id, table_name, action, record_key, changed_fields, old_values, new_values)
  values (actor_id, tg_table_name, tg_op, target_key, modified_fields, previous_data, current_data);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.write_audit_log() from public, anon, authenticated;

comment on table public.notification_preferences is '사용자별 신규 적합 공고 및 마감 알림 설정';
comment on table public.user_notifications is '자동 재판정에서 생성된 사용자별 알림';
comment on table public.listing_reviews is '자동 추출한 공고 자격·서류의 관리자 검수 상태';
