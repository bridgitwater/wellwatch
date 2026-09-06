-- Schedulers: Supabase Cron (pg_cron) + pg_net call the app's two cron endpoints.
--
-- This is NOT a migration (it holds a deployment secret): run it once in the
-- Supabase SQL editor, replacing the two placeholders. Re-running it is safe —
-- the schedules are unscheduled first and the secrets are updated in place.
--
--   * drive-sync  every 10 minutes  → GET /api/cron/drive-sync
--   * notify      hourly at :05     → GET /api/cron/notify
--
-- The GitHub Actions workflows in .github/workflows/ stay as a manual fallback
-- (Actions → Run workflow); their schedules were removed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Secrets live in Vault, not in cron.job.command (which is readable by admins).
do $$
declare
  v_url    text := 'https://wellwatch.bridgitwater.org';   -- NEXT_PUBLIC_APP_URL
  v_secret text := '<CRON_SECRET>';                    -- same value as Vercel's CRON_SECRET
  sid uuid;
begin
  select id into sid from vault.secrets where name = 'wellwatch_app_url';
  if sid is null then perform vault.create_secret(v_url, 'wellwatch_app_url', 'WellWatch base URL for cron pings');
  else perform vault.update_secret(sid, v_url); end if;

  select id into sid from vault.secrets where name = 'wellwatch_cron_secret';
  if sid is null then perform vault.create_secret(v_secret, 'wellwatch_cron_secret', 'Bearer token for /api/cron/*');
  else perform vault.update_secret(sid, v_secret); end if;
end $$;

-- 2. One function both jobs call. Fire-and-forget: pg_net stores the response in
--    net._http_response (kept ~6 h) — see the check queries at the bottom.
create or replace function public.ping_cron_endpoint(path text)
returns bigint
language plpgsql security definer
set search_path = public, extensions, vault
as $$
declare
  app_url text;
  secret  text;
  request_id bigint;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'wellwatch_app_url';
  select decrypted_secret into secret  from vault.decrypted_secrets where name = 'wellwatch_cron_secret';
  if app_url is null or secret is null then
    raise exception 'wellwatch_app_url / wellwatch_cron_secret missing from vault';
  end if;
  select net.http_get(
           url := app_url || path,
           headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'User-Agent', 'supabase-cron'),
           timeout_milliseconds := 290000
         ) into request_id;
  return request_id;
end $$;

revoke all on function public.ping_cron_endpoint(text) from public, anon, authenticated;

-- 3. Schedules (idempotent).
select cron.unschedule(jobid) from cron.job where jobname in ('wellwatch-drive-sync', 'wellwatch-notify');
select cron.schedule('wellwatch-drive-sync', '*/10 * * * *', $$select public.ping_cron_endpoint('/api/cron/drive-sync')$$);
select cron.schedule('wellwatch-notify',     '5 * * * *',    $$select public.ping_cron_endpoint('/api/cron/notify')$$);

-- 4. Fire the sync once right now so you can check the response below.
select public.ping_cron_endpoint('/api/cron/drive-sync') as request_id;

-- ---------------------------------------------------------------------------
-- Check queries (run separately, a minute later)
-- ---------------------------------------------------------------------------
-- select jobid, jobname, schedule, active from cron.job;
-- select start_time, status, return_message from cron.job_run_details order by start_time desc limit 10;
-- select id, created, status_code, left(content::text, 300) as body, error_msg
--   from net._http_response order by created desc limit 10;
-- select last_synced_at, last_error from public.drive_sync_state;
