create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  nickname text not null,
  email text not null,
  birth_date date,
  residence_region text,
  household_size integer check (household_size is null or household_size > 0),
  monthly_income integer check (monthly_income is null or monthly_income >= 0),
  total_assets integer check (total_assets is null or total_assets >= 0),
  is_homeless boolean,
  updated_at timestamptz not null default now()
);

create unique index profiles_username_unique on public.profiles (lower(username));
create unique index profiles_nickname_unique on public.profiles (lower(nickname));
alter table public.profiles add constraint profiles_username_format check (username ~ '^[A-Za-z0-9]{4,20}$');
alter table public.profiles add constraint profiles_nickname_format check (nickname ~ '^[가-힣A-Za-z0-9_-]{2,16}$');

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, username, nickname, email)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'), new.raw_user_meta_data ->> 'nickname', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create table public.saved_listings (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_listing_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_listing_id)
);

create table public.document_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  is_ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key)
);

alter table public.profiles enable row level security;
alter table public.saved_listings enable row level security;
alter table public.document_checks enable row level security;

create policy "profiles_owner_all" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_listings_owner_all" on public.saved_listings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "document_checks_owner_all" on public.document_checks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
