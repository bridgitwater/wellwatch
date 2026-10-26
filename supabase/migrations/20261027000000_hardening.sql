-- 27 Oct 2026: fixes found by stress-testing the 26 Oct admin batch.
-- Every object here is only reachable with the service role (server code that has
-- already checked who is asking). Re-runnable.

-- 1. Sign-in limiter -------------------------------------------------------------
-- WellWatch now sends its own sign-in emails (via Resend) instead of Supabase's,
-- whose 30-emails-an-hour project allowance anyone could use up. Each request is
-- recorded here; signin_allow() decides atomically whether a link may go out.
create table if not exists public.signin_requests (
  id          bigint generated always as identity primary key,
  email       text not null,
  ip          text,
  sent        boolean not null,        -- a link was (to be) sent for this request
  created_at  timestamptz not null default now()
);
create index if not exists signin_requests_email_idx on public.signin_requests (email, created_at desc);
create index if not exists signin_requests_ip_idx on public.signin_requests (ip, created_at desc);
create index if not exists signin_requests_created_idx on public.signin_requests (created_at desc);
alter table public.signin_requests enable row level security;
revoke all on public.signin_requests from anon, authenticated;

-- Limits: one link a minute and 3 an hour per person, 30 requests an hour per IP, and 60
-- sign-in emails a day in total, which keeps Resend's daily allowance free for update emails
-- even under attack (real use is a handful a day). Returns 'ok' (send a link), or why not: 'not_on_file', 'email_cooldown' (a link went
-- to this address under a minute ago, and a new one would cancel it), 'email_hourly',
-- 'ip_hourly' or 'daily_cap'. The requester is told "a link is on its way" either way.
create or replace function public.signin_allow(p_email text, p_ip text, p_on_file boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  verdict text := 'ok';
begin
  -- One decision at a time, so parallel requests can't all slip under a limit.
  perform pg_advisory_xact_lock(hashtext('wellwatch.signin_allow'));
  if not p_on_file then
    verdict := 'not_on_file';
  elsif exists (select 1 from signin_requests where email = p_email and sent and created_at > now() - interval '60 seconds') then
    verdict := 'email_cooldown';
  elsif (select count(*) from signin_requests where email = p_email and sent and created_at > now() - interval '1 hour') >= 3 then
    verdict := 'email_hourly';
  elsif p_ip is not null and (select count(*) from signin_requests where ip = p_ip and created_at > now() - interval '1 hour') >= 30 then
    verdict := 'ip_hourly';
  elsif (select count(*) from signin_requests where sent and created_at > now() - interval '1 day') >= 60 then
    verdict := 'daily_cap';
  end if;
  insert into signin_requests (email, ip, sent) values (p_email, p_ip, verdict = 'ok');
  return verdict;
end $$;
revoke execute on function public.signin_allow(text, text, boolean) from public, anon, authenticated;
grant execute on function public.signin_allow(text, text, boolean) to service_role;

-- 2. One run of a scheduled job at a time ---------------------------------------
create table if not exists public.job_locks (
  name        text primary key,
  held_until  timestamptz not null
);
alter table public.job_locks enable row level security;
revoke all on public.job_locks from anon, authenticated;

-- True if the caller now holds the lock; it expires by itself after p_seconds.
create or replace function public.job_try_lock(p_name text, p_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare got boolean;
begin
  insert into job_locks (name, held_until) values (p_name, now() + make_interval(secs => p_seconds))
  on conflict (name) do update set held_until = excluded.held_until
    where job_locks.held_until < now()
  returning true into got;
  return coalesce(got, false);
end $$;

create or replace function public.job_unlock(p_name text)
returns void language sql security definer set search_path = public as $$
  update job_locks set held_until = now() - interval '1 second' where name = p_name;
$$;
revoke execute on function public.job_try_lock(text, integer), public.job_unlock(text) from public, anon, authenticated;
grant execute on function public.job_try_lock(text, integer), public.job_unlock(text) to service_role;

-- 3. Never leave WellWatch without an admin ---------------------------------------
-- Two admins removing each other at the same moment used to remove both.
create or replace function public.demote_admin(p_target uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('wellwatch.admin_roster'));
  if not exists (select 1 from profiles where id = p_target and role = 'admin') then
    return 'not_admin';
  end if;
  if (select count(*) from profiles where role = 'admin') <= 1 then
    return 'last_admin';
  end if;
  update profiles set role = 'funder' where id = p_target;
  return 'ok';
end $$;
revoke execute on function public.demote_admin(uuid) from public, anon, authenticated;
grant execute on function public.demote_admin(uuid) to service_role;
