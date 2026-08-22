begin;

create extension if not exists pg_trgm with schema extensions;

alter table public.submissions
  add column provider_item_id text,
  add column media_kind text check (media_kind is null or media_kind in ('track', 'album', 'video')),
  add column normalized_title text,
  add column normalized_artist text,
  add column version_key text not null default '';

create index submissions_provider_identity_idx
  on public.submissions (group_id, provider, provider_item_id)
  where provider_item_id is not null;
create index submissions_semantic_title_idx
  on public.submissions using gin (normalized_title extensions.gin_trgm_ops)
  where normalized_title is not null;

drop policy if exists submissions_insert_self on public.submissions;
drop policy if exists submissions_update_self on public.submissions;
revoke all on public.submissions from authenticated;
grant select, delete on public.submissions to authenticated;

create or replace function public.enforce_submission_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_round public.rounds%rowtype;
  is_identity_backfill boolean := false;
begin
  select * into target_round
  from public.rounds
  where id = coalesce(new.round_id, old.round_id);

  if tg_op = 'UPDATE' then
    is_identity_backfill :=
      new.group_id is not distinct from old.group_id
      and new.round_id is not distinct from old.round_id
      and new.user_id is not distinct from old.user_id
      and new.song_url is not distinct from old.song_url;
  end if;

  -- The trusted server may enrich old rows that predate recording identities.
  -- Authenticated clients have no direct INSERT/UPDATE grant on submissions.
  if is_identity_backfill then
    return new;
  end if;

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

  if tg_op <> 'DELETE' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.group_id::text, 0));

    if exists (
      select 1
      from public.submissions previous
      join public.rounds previous_round on previous_round.id = previous.round_id
      where previous.group_id = new.group_id
        and previous.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and previous_round.round_number < target_round.round_number
        and (
          (
            new.provider_item_id is not null
            and previous.provider = new.provider
            and previous.provider_item_id = new.provider_item_id
          )
          or (
            new.normalized_title is not null
            and new.normalized_title <> ''
            and previous.normalized_title is not null
            and (
              previous.normalized_title = new.normalized_title
              or extensions.similarity(previous.normalized_title, new.normalized_title) >= 0.92
            )
            and coalesce(previous.normalized_artist, '') <> ''
            and coalesce(new.normalized_artist, '') <> ''
            and (
              previous.normalized_artist = new.normalized_artist
              or previous.normalized_artist like '%' || new.normalized_artist || '%'
              or new.normalized_artist like '%' || previous.normalized_artist || '%'
              or extensions.similarity(previous.normalized_artist, new.normalized_artist) >= 0.55
            )
            and (
              (coalesce(previous.version_key, '') = '' and coalesce(new.version_key, '') = '')
              or (
                coalesce(previous.version_key, '') <> ''
                and coalesce(new.version_key, '') <> ''
                and extensions.similarity(previous.version_key, new.version_key) >= 0.65
              )
            )
            and (
              previous.media_kind = new.media_kind
              or (previous.media_kind = 'video' and new.media_kind = 'track')
              or (previous.media_kind = 'track' and new.media_kind = 'video')
            )
          )
        )
    ) then
      raise exception 'song_already_used';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

update public.submissions
set
  provider_item_id = case
    when provider = 'spotify' then substring(song_url from 'open\.spotify\.com/(?:track|album)/([A-Za-z0-9]+)')
    when song_url ~ 'youtu\.be/' then substring(song_url from 'youtu\.be/([A-Za-z0-9_-]+)')
    when provider = 'youtube' or song_url ~ 'youtube\.com/' then coalesce(
      substring(song_url from '[?&]v=([A-Za-z0-9_-]+)'),
      substring(song_url from 'youtube\.com/(?:shorts|embed)/([A-Za-z0-9_-]+)')
    )
  end,
  media_kind = case
    when song_url ~ 'open\.spotify\.com/track/' then 'track'
    when song_url ~ 'open\.spotify\.com/album/' then 'album'
    when song_url ~ 'youtu\.be/|youtube\.com/' then 'video'
  end
where provider_item_id is null;

commit;
