-- 정적 프런트엔드(서버 라우트 없음) 전환: 로그인·중복확인은 RPC로, 관리자 검수는 RLS로 직접 허용한다.

create or replace function public.get_email_for_username(p_username text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

revoke all on function public.get_email_for_username(text) from public;
grant execute on function public.get_email_for_username(text) to anon, authenticated;

create or replace function public.is_identifier_available(p_field text, p_value text)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_field = 'username' then
    return not exists (select 1 from public.profiles where lower(username) = lower(p_value));
  elsif p_field = 'nickname' then
    return not exists (select 1 from public.profiles where lower(nickname) = lower(p_value));
  else
    raise exception 'invalid field: %', p_field;
  end if;
end;
$$;

revoke all on function public.is_identifier_available(text, text) from public;
grant execute on function public.is_identifier_available(text, text) to anon, authenticated;

comment on function public.get_email_for_username(text) is '아이디 로그인을 위해 브라우저에서 이메일만 조회. 존재 여부를 최소한으로만 노출한다';
comment on function public.is_identifier_available(text, text) is '회원가입 중복 확인용 true/false 응답. 다른 컬럼은 노출하지 않는다';

-- 관리자 검수(listing_reviews)는 그동안 서버(service role)만 기록할 수 있었다.
-- 서버 라우트를 없애는 대신, admin_users에 속한 로그인 사용자만 직접 쓸 수 있도록 RLS로 제한한다.
grant insert, update on public.listing_reviews to authenticated;

create policy "admin_insert_listing_reviews" on public.listing_reviews
  for insert to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admin_update_listing_reviews" on public.listing_reviews
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
