begin;

alter table public.submissions
  add column title text,
  add column artist text,
  add column thumbnail_url text,
  add column provider text check (provider is null or provider in ('spotify', 'youtube'));

create table public.group_settings (
  group_id uuid primary key references public.groups(id) on delete cascade,
  email_notifications_enabled boolean not null default false,
  round_started_email boolean not null default true,
  rating_started_email boolean not null default true,
  streak_warning_email boolean not null default true,
  auto_start_rounds boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses integer not null default 8 check (max_uses between 1 and 8),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete cascade,
  notification_type text not null check (notification_type in ('round_started', 'rating_started', 'streak_warning')),
  recipient_id uuid not null references public.users(id) on delete cascade,
  provider_id text,
  sent_at timestamptz not null default now(),
  unique (round_id, notification_type, recipient_id)
);

create or replace function public.create_default_group_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_settings (group_id) values (new.id);
  return new;
end;
$$;

create trigger groups_create_default_settings
after insert on public.groups
for each row execute function public.create_default_group_settings();

insert into public.group_settings (group_id)
select id from public.groups
on conflict (group_id) do nothing;

create trigger group_settings_set_updated_at
before update on public.group_settings
for each row execute function public.set_updated_at();

create or replace function public.join_group_by_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.group_invitations%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into invite
  from public.group_invitations
  where token = invite_token
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  for update;
  if invite.id is null then raise exception 'This invitation is invalid or expired'; end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (invite.group_id, (select auth.uid()), 'member', 'pending')
  on conflict (group_id, user_id) do update
    set status = case when public.group_members.status = 'rejected' then 'pending' else public.group_members.status end,
        approved_at = case when public.group_members.status = 'rejected' then null else public.group_members.approved_at end,
        approved_by = case when public.group_members.status = 'rejected' then null else public.group_members.approved_by end;
  update public.group_invitations set use_count = use_count + 1 where id = invite.id;
  return invite.group_id;
end;
$$;

revoke all on function public.join_group_by_invite(uuid) from public;
grant execute on function public.join_group_by_invite(uuid) to authenticated;

alter table public.group_settings enable row level security;
alter table public.group_invitations enable row level security;
alter table public.notification_log enable row level security;

create policy group_settings_select_members on public.group_settings
for select to authenticated using (public.is_group_member(group_id));
create policy group_settings_update_admin on public.group_settings
for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

create policy group_invitations_select_admin on public.group_invitations
for select to authenticated using (public.is_group_admin(group_id));
create policy group_invitations_insert_admin on public.group_invitations
for insert to authenticated with check (
  public.is_group_admin(group_id) and created_by = (select auth.uid())
);
create policy group_invitations_update_admin on public.group_invitations
for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));
create policy group_invitations_delete_admin on public.group_invitations
for delete to authenticated using (public.is_group_admin(group_id));

create policy notification_log_select_members on public.notification_log
for select to authenticated using (public.is_group_member(group_id));

grant select, update on public.group_settings to authenticated;
grant select, insert, update, delete on public.group_invitations to authenticated;
grant select on public.notification_log to authenticated;

commit;
