-- 26 Oct 2026: funder welcome step + log of sign-in requests that sent no link.

-- Funder welcome ---------------------------------------------------------------
-- Linking a funder is now quiet: update emails are held until an admin sends the
-- funder's welcome email, which stamps welcomed_at.
alter table public.well_funders add column if not exists welcomed_at timestamptz;
-- No backfill on purpose: production had no funder links when this was written,
-- and a backfill would silently "welcome" anyone linked later if this file were re-run.

-- Sign-in requests that sent no link --------------------------------------------
-- The sign-in page always says "a link is on its way" so strangers can't probe
-- which emails are on file. This table is how admins see the requests that
-- didn't send (email not on file, rate limit, error) in the daily digest and on
-- the Team page. Written only by the server with the service role.
create table if not exists public.signin_attempts (
  id          bigint generated always as identity primary key,
  email       text not null,
  outcome     text not null check (outcome in ('not_on_file', 'rate_limited', 'error')),
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists signin_attempts_created_idx on public.signin_attempts (created_at desc);
create index if not exists signin_attempts_dedup_idx on public.signin_attempts (email, outcome, created_at desc);

alter table public.signin_attempts enable row level security;
drop policy if exists signin_attempts_admin_read on public.signin_attempts;
create policy signin_attempts_admin_read on public.signin_attempts for select
  using (public.is_admin());
revoke insert, update, delete, truncate on public.signin_attempts from anon, authenticated;
