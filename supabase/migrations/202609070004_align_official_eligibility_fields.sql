alter table public.profiles add column if not exists household_type text;
alter table public.profiles add column if not exists marriage_date date;
alter table public.profiles add column if not exists expected_marriage_date date;
alter table public.profiles add column if not exists spouse_has_income boolean;
alter table public.profiles add column if not exists youngest_child_birth_date date;
alter table public.profiles add column if not exists is_pregnant boolean;
alter table public.profiles add column if not exists activity_status text;
alter table public.profiles add column if not exists graduation_date date;
alter table public.profiles add column if not exists real_estate_assets integer check (real_estate_assets is null or real_estate_assets >= 0);
alter table public.profiles add column if not exists financial_assets integer check (financial_assets is null or financial_assets >= 0);
alter table public.profiles add column if not exists other_assets integer check (other_assets is null or other_assets >= 0);
alter table public.profiles add column if not exists total_debt integer check (total_debt is null or total_debt >= 0);
alter table public.profiles add column if not exists receives_livelihood_benefit boolean;
alter table public.profiles add column if not exists receives_housing_benefit boolean;
alter table public.profiles add column if not exists is_near_poverty boolean;
alter table public.profiles add column if not exists is_supported_single_parent boolean;
alter table public.profiles add column if not exists subscription_payment_count integer check (subscription_payment_count is null or subscription_payment_count >= 0);
alter table public.profiles add column if not exists residence_start_date date;

alter table public.profiles add constraint profiles_household_type_check
  check (household_type is null or household_type in ('single', 'married', 'engaged', 'single_parent'));
alter table public.profiles add constraint profiles_activity_status_check
  check (activity_status is null or activity_status in ('student', 'prospective_student', 'job_seeker', 'employed', 'self_employed', 'unemployed', 'other'));

create table public.hug_property_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  housing_type text not null,
  region_type text not null check (region_type in ('capital', 'other')),
  deposit_amount bigint not null check (deposit_amount >= 0),
  contract_start_date date not null,
  contract_end_date date not null,
  contract_period_months integer check (contract_period_months is null or contract_period_months > 0),
  broker_contract boolean,
  landlord_type text,
  has_prohibited_assignment_clause boolean,
  has_ownership_encumbrance boolean,
  senior_claim_amount bigint check (senior_claim_amount is null or senior_claim_amount >= 0),
  housing_price bigint check (housing_price is null or housing_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hug_property_checks enable row level security;
create policy "hug_property_checks_owner_all" on public.hug_property_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger audit_hug_property_checks_changes
after insert or update or delete on public.hug_property_checks
for each row execute function public.write_audit_log();

