begin;

create extension if not exists pgcrypto;

create type public.membership_role as enum ('admin', 'member');
create type public.membership_status as enum ('pending', 'approved', 'rejected');
create type public.rating_emoji as enum ('🖤', '❤️', '👍', '👌', '🤔');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique
    check (nickname = btrim(nickname) and char_length(nickname) between 2 and 32),
  streak integer not null default 0 check (streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name = btrim(name) and char_length(name) between 2 and 80),
  rules text check (rules is null or char_length(rules) <= 5000),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.membership_role not null default 'member',
  status public.membership_status not null default 'pending',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id),
  check (
    (status = 'approved' and approved_at is not null)
    or (status <> 'approved' and approved_at is null)
  ),
  check (role <> 'admin' or status = 'approved')
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  starts_at timestamptz not null,
  submission_ends_at timestamptz not null,
  rating_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, round_number),
  unique (group_id, id),
  check (submission_ends_at = starts_at + interval '5 days'),
  check (rating_ends_at = submission_ends_at + interval '7 days')
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  round_id uuid not null,
  user_id uuid not null,
  song_url text not null
    check (song_url = btrim(song_url) and char_length(song_url) between 8 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, user_id),
  unique (group_id, round_id, id),
  foreign key (group_id, round_id)
    references public.rounds(group_id, id) on delete cascade,
  foreign key (group_id, user_id)
    references public.group_members(group_id, user_id) on delete cascade
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  round_id uuid not null,
  submission_id uuid not null,
  user_id uuid not null,
  emoji public.rating_emoji not null,
  points smallint generated always as (
    case emoji
      when '🖤' then 3
      when '❤️' then 2
      when '👍' then 1
      when '👌' then 0
      when '🤔' then 0
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, user_id),
  foreign key (group_id, round_id, submission_id)
    references public.submissions(group_id, round_id, id) on delete cascade,
  foreign key (group_id, user_id)
    references public.group_members(group_id, user_id) on delete cascade
);

create index group_members_user_status_idx
  on public.group_members (user_id, status, group_id);
create index rounds_group_dates_idx
  on public.rounds (group_id, starts_at, rating_ends_at);
create index submissions_round_idx on public.submissions (round_id);
create index ratings_round_user_idx on public.ratings (round_id, user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger groups_set_updated_at before update on public.groups
for each row execute function public.set_updated_at();
create trigger group_members_set_updated_at before update on public.group_members
for each row execute function public.set_updated_at();
create trigger rounds_set_updated_at before update on public.rounds
for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions
for each row execute function public.set_updated_at();
create trigger ratings_set_updated_at before update on public.ratings
for each row execute function public.set_updated_at();

create or replace function public.prevent_immutable_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'users' and new.nickname is distinct from old.nickname then
    raise exception 'Nickname is immutable';
  elsif tg_table_name = 'groups' and new.name is distinct from old.name then
    raise exception 'Group name is immutable';
  end if;
  return new;
end;
$$;

create trigger users_immutable before update on public.users
for each row execute function public.prevent_immutable_changes();
create trigger groups_immutable before update on public.groups
for each row execute function public.prevent_immutable_changes();

-- Policy helper functions are owned by the migration owner, bypass RLS, and
-- expose only booleans. The empty search_path prevents object-shadowing attacks.
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'approved'
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'approved'
      and gm.role = 'admin'
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_admin(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;

create or replace function public.add_group_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members
    (group_id, user_id, role, status, approved_by, approved_at)
  values
    (new.id, new.created_by, 'admin', 'approved', new.created_by, now());
  return new;
end;
$$;

create trigger groups_add_creator
after insert on public.groups
for each row execute function public.add_group_creator_as_admin();

create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  approved_count integer;
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform pg_advisory_xact_lock(hashtextextended(new.group_id::text, 0));
    select count(*) into approved_count
    from public.group_members
    where group_id = new.group_id and status = 'approved';
    if approved_count >= 8 then
      raise exception 'A group may have at most 8 approved members';
    end if;
  end if;
  return new;
end;
$$;

create trigger group_members_limit
before insert or update of status on public.group_members
for each row execute function public.enforce_member_limit();

create or replace function public.enforce_round_minimum_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.group_members
    where group_id = new.group_id and status = 'approved'
  ) < 2 then
    raise exception 'A round requires at least 2 approved group members';
  end if;
  return new;
end;
$$;

create trigger rounds_minimum_members
before insert on public.rounds
for each row execute function public.enforce_round_minimum_members();

create or replace function public.enforce_submission_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_round public.rounds%rowtype;
begin
  select * into target_round from public.rounds where id = coalesce(new.round_id, old.round_id);
  if now() < target_round.starts_at or now() >= target_round.submission_ends_at then
    raise exception 'Submissions may only be changed during the submission phase';
  end if;
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id and gm.user_id = new.user_id
      and gm.status = 'approved'
  ) then
    raise exception 'Only approved group members may submit';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger submissions_window
before insert or update or delete on public.submissions
for each row execute function public.enforce_submission_window();

create or replace function public.enforce_rating_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_round public.rounds%rowtype;
begin
  select * into target_round from public.rounds where id = coalesce(new.round_id, old.round_id);
  if now() < target_round.submission_ends_at or now() >= target_round.rating_ends_at then
    raise exception 'Ratings may only be changed during the rating phase';
  end if;
  if tg_op <> 'DELETE' and not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id and gm.user_id = new.user_id
      and gm.status = 'approved'
  ) then
    raise exception 'Only approved group members may rate';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger ratings_window
before insert or update or delete on public.ratings
for each row execute function public.enforce_rating_window();

-- A non-member cannot enumerate groups. This RPC implements exact-name joining
-- without weakening the groups SELECT policy.
create or replace function public.request_to_join_group(exact_group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select id into target_group_id
  from public.groups
  where name = exact_group_name;

  if target_group_id is null then
    raise exception 'Group not found';
  end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (target_group_id, (select auth.uid()), 'member', 'pending')
  on conflict (group_id, user_id) do update
    set status = case
      when public.group_members.status = 'rejected' then 'pending'
      else public.group_members.status
    end,
    approved_at = case
      when public.group_members.status = 'rejected' then null
      else public.group_members.approved_at
    end,
    approved_by = case
      when public.group_members.status = 'rejected' then null
      else public.group_members.approved_by
    end;

  return target_group_id;
end;
$$;

revoke all on function public.request_to_join_group(text) from public;
grant execute on function public.request_to_join_group(text) to authenticated;

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.rounds enable row level security;
alter table public.submissions enable row level security;
alter table public.ratings enable row level security;

create policy users_select_self_or_group_peers on public.users
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'approved'
      and theirs.user_id = users.id
      and theirs.status = 'approved'
  )
);
create policy users_insert_self on public.users
for insert to authenticated
with check (id = (select auth.uid()));
create policy users_update_self on public.users
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy groups_select_members on public.groups
for select to authenticated using (public.is_group_member(id));
create policy groups_insert_creator on public.groups
for insert to authenticated with check (created_by = (select auth.uid()));
create policy groups_update_admin on public.groups
for update to authenticated
using (public.is_group_admin(id))
with check (public.is_group_admin(id));
create policy groups_delete_admin on public.groups
for delete to authenticated using (public.is_group_admin(id));

create policy group_members_select on public.group_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_group_member(group_id)
);
create policy group_members_update_admin on public.group_members
for update to authenticated
using (public.is_group_admin(group_id))
with check (
  public.is_group_admin(group_id)
  and user_id <> (select auth.uid())
);
create policy group_members_delete_admin_or_self_pending on public.group_members
for delete to authenticated
using (
  public.is_group_admin(group_id)
  or (user_id = (select auth.uid()) and status <> 'approved')
);

create policy rounds_select_members on public.rounds
for select to authenticated using (public.is_group_member(group_id));
create policy rounds_insert_admin on public.rounds
for insert to authenticated with check (public.is_group_admin(group_id));
create policy rounds_update_admin on public.rounds
for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));
create policy rounds_delete_admin on public.rounds
for delete to authenticated using (public.is_group_admin(group_id));

create policy submissions_select_members on public.submissions
for select to authenticated using (public.is_group_member(group_id));
create policy submissions_insert_self on public.submissions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
);
create policy submissions_update_self on public.submissions
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
);
create policy submissions_delete_self on public.submissions
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
);

create policy ratings_select_members on public.ratings
for select to authenticated using (public.is_group_member(group_id));
create policy ratings_insert_self on public.ratings
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
);
create policy ratings_update_self on public.ratings
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
);
create policy ratings_delete_self on public.ratings
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.is_group_member(group_id)
);

-- Keep direct access explicit. The service_role continues to bypass RLS.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.users,
  public.groups,
  public.group_members,
  public.rounds,
  public.submissions,
  public.ratings
to authenticated;

commit;
