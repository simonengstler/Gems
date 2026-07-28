begin;

create or replace function public.complete_round_phase(target_round_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_round public.rounds%rowtype;
  approved_members integer;
  submission_count integer;
  rating_count integer;
  required_ratings integer;
begin
  select *
  into target_round
  from public.rounds
  where id = target_round_id
  for update;

  if target_round.id is null then
    raise exception 'Round not found';
  end if;
  if not public.is_group_admin(target_round.group_id) then
    raise exception 'Only a circle admin may complete a phase';
  end if;

  select count(*) into approved_members
  from public.group_members
  where group_id = target_round.group_id
    and status = 'approved';

  select count(*) into submission_count
  from public.submissions
  where round_id = target_round.id;

  if now() < target_round.submission_ends_at then
    if submission_count <> approved_members then
      raise exception 'Every approved member must submit first';
    end if;
    update public.rounds
    set submission_ends_at = now()
    where id = target_round.id;
    return 'rate';
  end if;

  if now() < target_round.rating_ends_at then
    required_ratings := approved_members * submission_count;
    select count(*) into rating_count
    from public.ratings
    where round_id = target_round.id;
    if required_ratings = 0 or rating_count <> required_ratings then
      raise exception 'Every required reaction must be complete first';
    end if;
    update public.rounds
    set rating_ends_at = now()
    where id = target_round.id;
    return 'reveal';
  end if;

  raise exception 'This round is already complete';
end;
$$;

revoke all on function public.complete_round_phase(uuid) from public;
grant execute on function public.complete_round_phase(uuid) to authenticated;

commit;
