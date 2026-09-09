insert into public.admin_users (user_id)
select id from auth.users order by created_at asc limit 1
on conflict (user_id) do nothing;

comment on table public.admin_users is '서비스 관리자 계정. 최초 구축 시 가장 먼저 생성된 계정을 초기 관리자로 지정';
