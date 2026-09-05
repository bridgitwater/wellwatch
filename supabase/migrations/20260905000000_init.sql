-- WellWatch initial schema
-- Drive holds the files; this database holds what they mean.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'field', 'funder');
create type public.org_type as enum ('owner', 'partner');
create type public.well_stage as enum (
  'funded', 'survey', 'drilling', 'pump_apron', 'water_flowing', 'handover'
);
create type public.update_source as enum ('drive', 'admin', 'whatsapp');
create type public.update_status as enum ('published', 'hidden');
create type public.media_kind as enum ('photo', 'video', 'audio', 'document');
create type public.cost_category as enum (
  'drilling', 'pump', 'apron_platform', 'training', 'monitoring', 'transport', 'other'
);
create type public.notification_kind as enum ('stage_change', 'new_update', 'digest', 'certificate');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text,                          -- ISO 3166-1 alpha-2, e.g. 'UG'
  type        public.org_type not null default 'partner',
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  display_name    text,
  role            public.user_role not null default 'funder',
  organization_id uuid references public.organizations(id),
  notify_email    boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.wells (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,        -- e.g. UG-2026-014
  name              text not null,               -- village / community name shown to funders
  country           text not null,               -- ISO alpha-2
  region            text,
  village           text,
  approx_lat        double precision,            -- jittered village centroid, safe to show
  approx_lng        double precision,
  exact_lat         double precision,            -- admin/partner only
  exact_lng         double precision,
  status            public.well_stage not null default 'funded',
  people_served     integer,
  depth_m           numeric(6,1),
  yield_lph         integer,                     -- litres per hour
  source_type       text,                        -- borehole, hand-dug, spring protection...
  dedication        text,
  summary           text,                        -- short community description
  partner_org_id    uuid references public.organizations(id),
  drive_folder_id   text unique,
  folder_is_public  boolean not null default true,
  target_cost       numeric(12,2),
  currency          char(3) not null default 'AUD',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index wells_partner_idx on public.wells(partner_org_id);
create index wells_country_idx on public.wells(country);

create table public.well_funders (
  id          uuid primary key default gen_random_uuid(),
  well_id     uuid not null references public.wells(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(12,2),
  currency    char(3) not null default 'AUD',
  funded_at   date,
  is_primary  boolean not null default false,
  unique (well_id, profile_id)
);
create index well_funders_profile_idx on public.well_funders(profile_id);

create table public.stages (
  id          uuid primary key default gen_random_uuid(),
  well_id     uuid not null references public.wells(id) on delete cascade,
  stage       public.well_stage not null,
  reached_at  date,                              -- null = not yet reached
  expected_at date,
  note        text,
  unique (well_id, stage)
);

create table public.updates (
  id            uuid primary key default gen_random_uuid(),
  well_id       uuid not null references public.wells(id) on delete cascade,
  author_id     uuid references public.profiles(id),
  source        public.update_source not null default 'drive',
  stage         public.well_stage,
  body          text,
  status        public.update_status not null default 'published',
  happened_at   timestamptz not null default now(),   -- when the photos were taken / posted
  created_at    timestamptz not null default now(),
  notify_after  timestamptz not null default now() + interval '2 hours',
  notified_at   timestamptz
);
create index updates_well_idx on public.updates(well_id, happened_at desc);

create table public.media (
  id             uuid primary key default gen_random_uuid(),
  update_id      uuid not null references public.updates(id) on delete cascade,
  well_id        uuid not null references public.wells(id) on delete cascade,
  drive_file_id  text not null unique,
  kind           public.media_kind not null,
  mime           text,
  name           text,
  width          integer,
  height         integer,
  duration_s     integer,
  taken_at       timestamptz,
  caption        text,
  hidden         boolean not null default false,
  drive_modified_at timestamptz,
  created_at     timestamptz not null default now()
);
create index media_update_idx on public.media(update_id);
create index media_well_idx on public.media(well_id);

create table public.costs (
  id        uuid primary key default gen_random_uuid(),
  well_id   uuid not null references public.wells(id) on delete cascade,
  category  public.cost_category not null,
  amount    numeric(12,2) not null,
  currency  char(3) not null default 'AUD',
  note      text
);
create index costs_well_idx on public.costs(well_id);

create table public.water_tests (
  id          uuid primary key default gen_random_uuid(),
  well_id     uuid not null references public.wells(id) on delete cascade,
  tested_at   date not null,
  ph          numeric(4,2),
  turbidity_ntu numeric(6,2),
  e_coli_cfu  integer,                           -- per 100 ml
  fluoride_mgl numeric(5,2),
  arsenic_ugl numeric(6,2),
  passed      boolean,
  lab         text,
  note        text
);
create index water_tests_well_idx on public.water_tests(well_id);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  well_id     uuid references public.wells(id) on delete cascade,
  kind        public.notification_kind not null,
  sent_at     timestamptz not null default now(),
  meta        jsonb
);
create index notifications_profile_idx on public.notifications(profile_id, sent_at desc);

-- Drive sync bookkeeping: one row.
create table public.drive_sync_state (
  id                 integer primary key default 1 check (id = 1),
  start_page_token   text,
  last_synced_at     timestamptz,
  last_error         text
);
insert into public.drive_sync_state (id) values (1);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.current_role_of(uid uuid)
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = uid
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- Can the current user see this well at all?
create or replace function public.can_view_well(w uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.well_funders wf where wf.well_id = w and wf.profile_id = auth.uid())
      or exists (select 1 from public.wells x where x.id = w and x.partner_org_id = public.my_org()
                   and public.current_role_of(auth.uid()) = 'field')
$$;

-- "You and N others funded this well" without exposing who.
create or replace function public.cofunder_count(w uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.well_funders where well_id = w
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- Every auth user gets a profile row. Role/org can be set in raw_user_meta_data at invite time.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role, organization_id)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'funder'),
    nullif(new.raw_user_meta_data->>'organization_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- wells.status follows the latest reached stage.
create or replace function public.sync_well_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare latest public.well_stage;
begin
  select stage into latest
    from public.stages
   where well_id = coalesce(new.well_id, old.well_id) and reached_at is not null
   order by stage desc limit 1;
  update public.wells set status = coalesce(latest, 'funded'), updated_at = now()
   where id = coalesce(new.well_id, old.well_id);
  return null;
end $$;

create trigger stages_sync_status
  after insert or update or delete on public.stages
  for each row execute function public.sync_well_status();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger wells_touch before update on public.wells
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations   enable row level security;
alter table public.profiles        enable row level security;
alter table public.wells           enable row level security;
alter table public.well_funders    enable row level security;
alter table public.stages          enable row level security;
alter table public.updates         enable row level security;
alter table public.media           enable row level security;
alter table public.costs           enable row level security;
alter table public.water_tests     enable row level security;
alter table public.notifications   enable row level security;
alter table public.drive_sync_state enable row level security;

-- organizations
create policy org_admin_all on public.organizations for all
  using (public.is_admin()) with check (public.is_admin());
create policy org_read_own on public.organizations for select
  using (id = public.my_org());

-- profiles
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_read_self on public.profiles for select
  using (id = auth.uid());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role_of(auth.uid())
              and organization_id is not distinct from public.my_org());

-- wells
create policy wells_admin_all on public.wells for all
  using (public.is_admin()) with check (public.is_admin());
create policy wells_read_visible on public.wells for select
  using (public.can_view_well(id));

-- well_funders: funders see only their own row (so co-funder amounts stay private)
create policy wf_admin_all on public.well_funders for all
  using (public.is_admin()) with check (public.is_admin());
create policy wf_read_own on public.well_funders for select
  using (profile_id = auth.uid());

-- stages / costs / water_tests: readable with the well
create policy stages_admin_all on public.stages for all
  using (public.is_admin()) with check (public.is_admin());
create policy stages_read on public.stages for select
  using (public.can_view_well(well_id));

create policy costs_admin_all on public.costs for all
  using (public.is_admin()) with check (public.is_admin());
create policy costs_read on public.costs for select
  using (public.can_view_well(well_id));

create policy wt_admin_all on public.water_tests for all
  using (public.is_admin()) with check (public.is_admin());
create policy wt_read on public.water_tests for select
  using (public.can_view_well(well_id));

-- updates: funders see published only; field users see all for their wells and may post
create policy updates_admin_all on public.updates for all
  using (public.is_admin()) with check (public.is_admin());
create policy updates_read_published on public.updates for select
  using (status = 'published' and public.can_view_well(well_id));
create policy updates_field_read on public.updates for select
  using (public.current_role_of(auth.uid()) = 'field' and public.can_view_well(well_id));
create policy updates_field_insert on public.updates for insert
  with check (public.current_role_of(auth.uid()) = 'field'
              and public.can_view_well(well_id) and author_id = auth.uid());

-- media: follows its update
create policy media_admin_all on public.media for all
  using (public.is_admin()) with check (public.is_admin());
create policy media_read on public.media for select
  using (hidden = false and exists (
    select 1 from public.updates u where u.id = update_id and u.status = 'published'
  ) and public.can_view_well(well_id));
create policy media_field_read on public.media for select
  using (public.current_role_of(auth.uid()) = 'field' and public.can_view_well(well_id));

-- notifications: own only
create policy notif_admin_all on public.notifications for all
  using (public.is_admin()) with check (public.is_admin());
create policy notif_read_own on public.notifications for select
  using (profile_id = auth.uid());

-- drive_sync_state: admin only (the sync job uses the service role, which bypasses RLS)
create policy sync_admin_all on public.drive_sync_state for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Convenience view for the funder's "my wells" list (RLS of base tables applies)
-- ---------------------------------------------------------------------------
create view public.my_wells with (security_invoker = true) as
select w.id, w.code, w.name, w.country, w.region, w.status, w.people_served,
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

-- Supabase grants anon/authenticated/service_role on new public tables by default;
-- RLS above is what actually restricts access.
