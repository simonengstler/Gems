begin;

create or replace function public.search_users(search_term text)
returns table (id uuid, nickname text, streak integer)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nickname, u.streak
  from public.users u
  where (select auth.uid()) is not null
    and char_length(btrim(search_term)) >= 2
    and u.nickname ilike '%' || btrim(search_term) || '%'
  order by
    case when lower(u.nickname) = lower(btrim(search_term)) then 0 else 1 end,
    u.nickname
  limit 20;
$$;

revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;

commit;
