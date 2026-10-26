-- 27 Oct 2026: private Drive folders.
-- Well folders used to be shared "anyone with the link", so anyone who had one photo's
-- link could open the folder and see everything in it, hidden photos included. Now only
-- the files funders are meant to see are shared, one by one, and folders are private.
-- This table is WellWatch's record of what it has shared and checked; the Drive sync
-- shares and verifies files every 10 minutes, and an admin makes folders private once
-- every file is verified. Server (service role) only. Re-runnable.
create table if not exists public.drive_shares (
  file_id     text primary key,
  kind        text not null check (kind in ('media', 'report', 'testimonial', 'logo', 'folder', 'other')),
  shared      boolean not null,           -- true: should be viewable by link; false: should not
  direct      boolean not null default false,  -- Drive confirmed the file's own link (not just its folder's)
  last_error  text,
  updated_at  timestamptz not null default now()
);
alter table public.drive_shares enable row level security;
revoke all on public.drive_shares from anon, authenticated;

-- New well folders are no longer shared by link; the old toggle is retired.
alter table public.wells alter column folder_is_public set default false;

-- Every Drive file a funder (or a public example page) may see, with the well folder it
-- lives in: visible photos/videos of published updates, completion reports, testimonial
-- photos and partner logos. Hidden photos and hidden updates are left out, so the sync
-- removes their links.
create or replace function public.desired_drive_shares()
returns table (file_id text, kind text, folder_id text)
language sql stable security definer set search_path = public as $$
  select distinct on (file_id) file_id, kind, folder_id from (
    select m.drive_file_id as file_id, 'media' as kind, w.drive_folder_id as folder_id, 1 as pri
      from media m join updates u on u.id = m.update_id join wells w on w.id = m.well_id
     where not m.hidden and u.status = 'published'
    union all
    select w.report_file_id, 'report', w.drive_folder_id, 2 from wells w where w.report_file_id is not null
    union all
    select t.photo_file_id, 'testimonial', w.drive_folder_id, 3
      from testimonials t join wells w on w.id = t.well_id where t.photo_file_id is not null
    union all
    select o.logo_file_id, 'logo', null, 4 from organizations o where o.logo_file_id is not null
  ) x
  where file_id <> '' and file_id not like 'seed-%'
  order by file_id, pri;
$$;
revoke execute on function public.desired_drive_shares() from public, anon, authenticated;
grant execute on function public.desired_drive_shares() to service_role;
