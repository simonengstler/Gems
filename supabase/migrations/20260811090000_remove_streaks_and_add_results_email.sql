begin;

-- Streaks are no longer part of the product or its notification model.
drop trigger if exists rounds_finalize_previous_streaks on public.rounds;
drop function if exists public.finalize_previous_round_streaks();
drop function if exists public.search_users(text);

delete from public.notification_log where notification_type = 'streak_warning';
alter table public.notification_log
  drop constraint if exists notification_log_notification_type_check;
alter table public.notification_log
  add constraint notification_log_notification_type_check
  check (notification_type in ('round_started', 'rating_started', 'round_completed'));

alter table public.group_settings
  drop column if exists streak_warning_email,
  add column if not exists round_completed_email boolean not null default true;

alter table public.users drop column if exists streak;

create function public.search_users(search_term text)
returns table (id uuid, nickname text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nickname
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
