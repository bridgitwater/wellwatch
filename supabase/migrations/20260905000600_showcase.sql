-- Public example pages: a well flagged showcase = true is readable by anyone at
-- /example/<code> — no sign-in, funder gift details hidden. The page is served
-- with the service role and checks the flag itself, so no RLS/anon grants change.
alter table public.wells add column showcase boolean not null default false;
grant select (showcase) on public.wells to authenticated;
