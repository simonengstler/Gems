-- Keep rating scores generated from the selected reaction while adopting the
-- updated 3/3/2/1/0 scale. Existing ratings are recalculated automatically.
alter table public.ratings
  drop column points;

alter table public.ratings
  add column points smallint generated always as (
    case emoji
      when '🖤' then 3
      when '❤️' then 3
      when '👍' then 2
      when '👌' then 1
      when '🤔' then 0
    end
  ) stored;
