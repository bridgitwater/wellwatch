-- Fields that mirror BridgIT's Completion & Acquittal Reports, so the funder page
-- can grow into the finished report as the project progresses.

create type public.well_type as enum ('drilled', 'hand_drilled', 'refurbished', 'solar_system', 'piped_scheme', 'other');

alter table public.wells
  add column well_type          public.well_type not null default 'drilled',
  add column program_name       text,            -- e.g. "2026 Hand Drilled & Refurbished Borewell Program"
  add column sponsor_line       text,            -- "Sponsored by: Little Ripples Wine Australia" (funder-facing)
  add column households         integer,
  add column pump_type          text,            -- "India Mark II", "Afridev", "Solar submersible"
  add column contractor         text,
  add column gps_text           text,            -- coordinates exactly as the partner reported them
  add column before_story       text,            -- Background: previous source, distance, who collected, hardships
  add column before_distance_km numeric(6,2),    -- walk to previous water source
  add column after_distance_m   integer,         -- walk to the new source
  add column hours_saved_day    numeric(4,1),    -- per household / woman, per day
  add column impacts            text,            -- one impact per line
  add column wuc_members        integer,
  add column wuc_women          integer,
  add column wuc_youth          integer,
  add column wuc_pwd            integer,
  add column wuc_treasurer_woman boolean,
  add column training_note      text,            -- WUC + WASH training, who by, user fees
  add column sustainability     text,
  add column challenges         text,
  add column lessons            text,
  add column plaque_installed   boolean not null default false,
  add column completed_at       date,
  add column report_file_id     text;            -- Drive file id of the final Completion Report (PDF)

alter table public.organizations
  add column intro          text,               -- short funder-facing introduction
  add column contact_name   text,
  add column contact_title  text,
  add column website        text,
  add column logo_file_id   text;

-- Named beneficiary testimonials (the most-read part of every report).
create table public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  well_id       uuid not null references public.wells(id) on delete cascade,
  name          text not null,
  age           integer,
  role          text,                            -- "mother of four", "WUC Treasurer", "P7 pupil"
  quote         text not null,
  photo_file_id text,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);
create index testimonials_well_idx on public.testimonials(well_id);
alter table public.testimonials enable row level security;
create policy testimonials_admin_all on public.testimonials for all
  using (public.is_admin()) with check (public.is_admin());
create policy testimonials_read on public.testimonials for select
  using (public.can_view_well(well_id));

-- Funders may read the partner organisation behind a well they can see.
create policy org_read_partner_of_visible_well on public.organizations for select
  using (exists (select 1 from public.wells w where w.partner_org_id = organizations.id and public.can_view_well(w.id)));

-- Media can be tagged so the page can pull out the plaque / inauguration shots.
alter table public.media add column tag text;   -- 'before' | 'plaque' | 'inauguration' | null

-- Expose type and households in the funder list view.
drop view public.my_wells;
create view public.my_wells with (security_invoker = true) as
select w.id, w.code, w.name, w.country, w.region, w.status, w.well_type, w.people_served, w.households,
       w.approx_lat, w.approx_lng, w.updated_at,
       wf.amount, wf.currency as funded_currency, wf.funded_at, wf.is_primary,
       (select max(u.happened_at) from public.updates u
         where u.well_id = w.id and u.status = 'published') as last_update_at,
       (select m.drive_file_id from public.media m
         join public.updates u on u.id = m.update_id
        where m.well_id = w.id and m.kind = 'photo' and m.hidden = false and u.status = 'published'
        order by m.taken_at desc nulls last, m.created_at desc limit 1) as cover_file_id
  from public.wells w
  join public.well_funders wf on wf.well_id = w.id and wf.profile_id = auth.uid();
