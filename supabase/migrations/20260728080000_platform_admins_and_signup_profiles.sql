begin;

create table public.platform_admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy platform_admins_select_self on public.platform_admins
for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.platform_admins to authenticated;

alter table public.group_settings
  add column submission_interval_days integer not null default 5
    check (submission_interval_days between 1 and 14),
  add column rating_interval_days integer not null default 7
    check (rating_interval_days between 1 and 14);

alter table public.rounds
  drop constraint rounds_check,
  drop constraint rounds_check1,
  add constraint rounds_submission_interval_positive
    check (submission_ends_at > starts_at),
  add constraint rounds_rating_interval_positive
    check (rating_ends_at > submission_ends_at);

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_nickname text := btrim(new.raw_user_meta_data ->> 'nickname');
begin
  if requested_nickname is not null and requested_nickname <> '' then
    insert into public.users (id, nickname)
    values (new.id, requested_nickname)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger auth_user_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();

commit;
