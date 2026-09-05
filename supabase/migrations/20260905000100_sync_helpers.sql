-- Called by the Drive sync after deletions. Service role only.
create or replace function public.prune_empty_drive_updates()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with gone as (
    delete from public.updates u
     where u.source = 'drive'
       and coalesce(u.body, '') = ''
       and not exists (select 1 from public.media m where m.update_id = u.id)
    returning 1
  ) select count(*) into n from gone;
  return n;
end $$;

revoke execute on function public.prune_empty_drive_updates() from public, anon, authenticated;
