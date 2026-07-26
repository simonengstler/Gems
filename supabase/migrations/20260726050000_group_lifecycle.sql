begin;

alter table public.groups add column archived_at timestamptz;

create or replace function public.leave_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.group_members%rowtype;
  other_admins integer;
begin
  select * into membership from public.group_members
  where group_id = target_group_id and user_id = (select auth.uid()) and status = 'approved';
  if membership.id is null then raise exception 'You are not a member of this group'; end if;
  if membership.role = 'admin' then
    select count(*) into other_admins from public.group_members
    where group_id = target_group_id and role = 'admin' and status = 'approved' and user_id <> (select auth.uid());
    if other_admins = 0 then raise exception 'Promote another admin before leaving'; end if;
  end if;
  delete from public.group_members where id = membership.id;
end;
$$;

revoke all on function public.leave_group(uuid) from public;
grant execute on function public.leave_group(uuid) to authenticated;

commit;
