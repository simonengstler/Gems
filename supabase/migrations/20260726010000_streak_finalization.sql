begin;

create or replace function public.finalize_previous_round_streaks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_round public.rounds%rowtype;
  song_count integer;
begin
  select *
  into previous_round
  from public.rounds
  where group_id = new.group_id
    and id <> new.id
    and rating_ends_at <= now()
  order by round_number desc
  limit 1;

  if previous_round.id is null then
    return new;
  end if;

  select count(*)
  into song_count
  from public.submissions
  where round_id = previous_round.id;

  update public.users u
  set streak = case
    when exists (
      select 1
      from public.submissions s
      where s.round_id = previous_round.id
        and s.user_id = u.id
    )
    and (
      select count(*)
      from public.ratings r
      where r.round_id = previous_round.id
        and r.user_id = u.id
    ) = song_count
    then u.streak + 1
    else 0
  end
  where exists (
    select 1
    from public.group_members gm
    where gm.group_id = new.group_id
      and gm.user_id = u.id
      and gm.status = 'approved'
  );

  return new;
end;
$$;

create trigger rounds_finalize_previous_streaks
after insert on public.rounds
for each row execute function public.finalize_previous_round_streaks();

commit;
