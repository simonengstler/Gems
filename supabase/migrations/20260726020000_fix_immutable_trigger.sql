begin;

create or replace function public.prevent_immutable_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'users' then
    if new.nickname is distinct from old.nickname then
      raise exception 'Nickname is immutable';
    end if;
  end if;

  if tg_table_name = 'groups' then
    if new.name is distinct from old.name then
      raise exception 'Group name is immutable';
    end if;
  end if;

  return new;
end;
$$;

commit;
