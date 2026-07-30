begin;

-- Remove ratings that were valid under the old product rule before enforcing
-- that members never rate their own submission.
alter table public.ratings disable trigger ratings_window;
delete from public.ratings as rating
using public.submissions as submission
where submission.id = rating.submission_id
  and submission.user_id = rating.user_id;
alter table public.ratings enable trigger ratings_window;

create or replace function public.prevent_self_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.submissions
    where id = new.submission_id
      and user_id = new.user_id
  ) then
    raise exception 'You cannot rate your own submission';
  end if;
  return new;
end;
$$;

create trigger ratings_prevent_self_rating
before insert or update of submission_id, user_id on public.ratings
for each row execute function public.prevent_self_rating();

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
  rating_duration interval;
  phase_now timestamptz;
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

    -- Ending choosing early must not consume any of the configured listening
    -- interval. Preserve the stored rating duration and start it now.
    rating_duration := target_round.rating_ends_at - target_round.submission_ends_at;
    phase_now := clock_timestamp();
    update public.rounds
    set submission_ends_at = phase_now,
        rating_ends_at = phase_now + rating_duration
    where id = target_round.id;
    return 'rate';
  end if;

  if now() < target_round.rating_ends_at then
    select count(*) into required_ratings
    from public.group_members as member
    cross join public.submissions as submission
    where member.group_id = target_round.group_id
      and member.status = 'approved'
      and submission.round_id = target_round.id
      and member.user_id <> submission.user_id;

    select count(*) into rating_count
    from public.ratings
    where round_id = target_round.id;

    if required_ratings = 0 or rating_count <> required_ratings then
      raise exception 'Every required reaction must be complete first';
    end if;
    update public.rounds
    set rating_ends_at = clock_timestamp()
    where id = target_round.id;
    return 'reveal';
  end if;

  raise exception 'This round is already complete';
end;
$$;

revoke all on function public.complete_round_phase(uuid) from public;
grant execute on function public.complete_round_phase(uuid) to authenticated;

commit;
