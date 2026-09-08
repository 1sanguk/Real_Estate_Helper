create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  record_key jsonb not null,
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_logs_user_time_idx
  on public.audit_logs (user_id, occurred_at desc);

create index audit_logs_table_action_idx
  on public.audit_logs (table_name, action, occurred_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_owner_read"
  on public.audit_logs
  for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

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
begin
  if tg_op = 'DELETE' then
    previous_data := to_jsonb(old) - 'email';
    current_data := null;
    actor_id := coalesce(auth.uid(), (to_jsonb(old) ->> 'user_id')::uuid);
  elsif tg_op = 'INSERT' then
    previous_data := null;
    current_data := to_jsonb(new) - 'email';
    actor_id := coalesce(auth.uid(), (to_jsonb(new) ->> 'user_id')::uuid);
  else
    previous_data := to_jsonb(old) - 'email';
    current_data := to_jsonb(new) - 'email';
    actor_id := coalesce(auth.uid(), (to_jsonb(new) ->> 'user_id')::uuid);
  end if;

  target_key := jsonb_build_object('user_id', actor_id);
  if tg_table_name = 'saved_listings' then
    target_key := target_key || jsonb_build_object(
      'source_listing_id', coalesce(current_data ->> 'source_listing_id', previous_data ->> 'source_listing_id')
    );
  elsif tg_table_name = 'document_checks' then
    target_key := target_key || jsonb_build_object(
      'document_key', coalesce(current_data ->> 'document_key', previous_data ->> 'document_key')
    );
  end if;

  if tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}')
      into modified_fields
      from jsonb_object_keys(current_data) as key;
  elsif tg_op = 'DELETE' then
    select coalesce(array_agg(key order by key), '{}')
      into modified_fields
      from jsonb_object_keys(previous_data) as key;
  else
    select coalesce(array_agg(key order by key), '{}')
      into modified_fields
      from (
        select key from jsonb_object_keys(current_data) as key
        where previous_data -> key is distinct from current_data -> key
      ) changed;
  end if;

  insert into public.audit_logs (
    user_id, table_name, action, record_key,
    changed_fields, old_values, new_values
  ) values (
    actor_id, tg_table_name, tg_op, target_key,
    modified_fields, previous_data, current_data
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.write_audit_log() from public, anon, authenticated;

create trigger audit_profiles_changes
after insert or update or delete on public.profiles
for each row execute function public.write_audit_log();

create trigger audit_saved_listings_changes
after insert or update or delete on public.saved_listings
for each row execute function public.write_audit_log();

create trigger audit_document_checks_changes
after insert or update or delete on public.document_checks
for each row execute function public.write_audit_log();

