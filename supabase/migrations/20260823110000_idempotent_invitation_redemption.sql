begin;

create or replace function public.join_group_by_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.group_invitations%rowtype;
  existing_status public.membership_status;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into invite
  from public.group_invitations
  where token = invite_token
    and revoked_at is null
    and expires_at > now()
  for update;

  if invite.id is null then
    raise exception 'This invitation is invalid or expired';
  end if;

  select status into existing_status
  from public.group_members
  where group_id = invite.group_id
    and user_id = (select auth.uid())
  for update;

  if existing_status in ('pending', 'approved') then
    return invite.group_id;
  end if;

  if invite.use_count >= invite.max_uses then
    raise exception 'This invitation is invalid or expired';
  end if;

  if existing_status = 'rejected' then
    update public.group_members
    set status = 'pending',
        approved_at = null,
        approved_by = null
    where group_id = invite.group_id
      and user_id = (select auth.uid());
  else
    insert into public.group_members (group_id, user_id, role, status)
    values (invite.group_id, (select auth.uid()), 'member', 'pending');
  end if;

  update public.group_invitations
  set use_count = use_count + 1
  where id = invite.id;

  return invite.group_id;
end;
$$;

revoke all on function public.join_group_by_invite(uuid) from public;
grant execute on function public.join_group_by_invite(uuid) to authenticated;

commit;
