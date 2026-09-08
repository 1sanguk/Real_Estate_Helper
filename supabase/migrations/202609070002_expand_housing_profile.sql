alter table public.profiles add column if not exists owns_car boolean;
alter table public.profiles add column if not exists car_value integer check (car_value is null or car_value >= 0);
alter table public.profiles add column if not exists is_married boolean;
alter table public.profiles add column if not exists has_children boolean;
alter table public.profiles add column if not exists child_count integer check (child_count is null or child_count >= 0);
alter table public.profiles add column if not exists profile_completed_at timestamptz;

