# Deploying WellWatch

Everything runs on free tiers. Do these once, in order.

## 1. Supabase

1. supabase.com → New project `wellwatch`, region Sydney. Save the database password.
2. **SQL Editor** → paste and run each file in `supabase/migrations/` in filename order. (Or `supabase link` + `supabase db push` with the CLI.)
3. **Authentication → URL Configuration**
   - Site URL: `https://wellwatch.bridgitwater.org`
   - Redirect URLs: `https://wellwatch.bridgitwater.org/auth/callback`, `https://wellwatch.bridgitwater.org/auth/complete`, `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/complete`
4. **Authentication → Email Templates → Magic Link** — replace the body with something like:
   ```html
   <h2>Sign in to WellWatch</h2>
   <p>Click the link below to see your well. It works once and expires in an hour.</p>
   <p><a href="{{ .ConfirmationURL }}">Sign in to WellWatch</a></p>
   <p>If you didn't request this, you can ignore it.</p>
   ```
5. **Authentication → SMTP Settings** (so magic links come from bridgitwater.org, not Supabase's shared sender): enable custom SMTP with Resend —
   host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender `wells@bridgitwater.org`, name `WellWatch`.
6. **Authentication → Providers → Email**: keep "Confirm email" on; **turn off** "Allow new users to sign up" — only admins create funders.
7. **Project Settings → API**: copy Project URL, `anon` key, `service_role` key.
8. Make yourself admin. After you've signed in once via the portal (or been created by the seed), run in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'dusty@bridgitwater.org';
   ```
   If your user doesn't exist yet: **Authentication → Users → Add user** with your email first, then run the update.

## 2. Google Drive

1. Google Drive → **Shared drives** → New → `Wells`.
2. console.cloud.google.com → New project `wellwatch` (under the bridgitwater.org org) → **APIs & Services → Enable APIs** → Google Drive API.
3. **IAM & Admin → Service Accounts → Create** `wellwatch-sync` → Keys → Add key → JSON. Download.
4. Back in the `Wells` shared drive → Manage members → add the service account email (`…@….iam.gserviceaccount.com`) as **Content manager**.
5. Encode the key for the env var: `base64 -i wellwatch-sync-xxxx.json | tr -d '\n'` (macOS) → that string is `GOOGLE_SERVICE_ACCOUNT_JSON_B64`.
6. The shared drive ID is the last part of its URL: `drive.google.com/drive/folders/<THIS>` → `DRIVE_SHARED_DRIVE_ID`.

Folder naming: `UG-2026-014 · Kyabirwa` — the code at the start is what the sync matches on. The admin creates folders automatically for new wells; for existing wells, make the folder by hand and the next sync links it.

## 3. Resend

1. resend.com → Domains → Add `bridgitwater.org` → add the DNS records it shows → verify.
2. API Keys → Create (Sending access) → `RESEND_API_KEY`.

## 4. Vercel

1. vercel.com → Add New Project → import `bridgitwater/wellwatch` → Framework: Next.js (auto) → **Environment variables** (all of these):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (secret) |
   | `NEXT_PUBLIC_APP_URL` | `https://wellwatch.bridgitwater.org` |
   | `GOOGLE_SERVICE_ACCOUNT_JSON_B64` | step 2.5 |
   | `DRIVE_SHARED_DRIVE_ID` | step 2.6 |
   | `RESEND_API_KEY` | step 3 |
   | `EMAIL_FROM` | `WellWatch <wells@bridgitwater.org>` |
   | `CRON_SECRET` | any long random string: `openssl rand -hex 32` |

2. Deploy. Then **Settings → Domains** → add `wellwatch.bridgitwater.org` and create the CNAME it asks for at your DNS provider.

## 5. Scheduler (Supabase Cron)

The Drive sync runs every 10 minutes and notifications hourly from **Supabase Cron** (pg_cron + pg_net), which calls
`/api/cron/drive-sync` and `/api/cron/notify` with the `CRON_SECRET` bearer token.

1. Supabase → **Integrations → Cron** → Enable (this turns on `pg_cron`; `pg_net` is enabled by the script).
2. **SQL Editor** → paste `supabase/cron.sql`, replace `<CRON_SECRET>` with the value you gave Vercel (and the URL if it differs), run.
3. A minute later run the check queries at the bottom of that file — `net._http_response` should show a `200` and `drive_sync_state.last_synced_at` should be fresh.

The two GitHub Actions workflows in `.github/workflows/` are kept as a **manual fallback** (Actions → *drive-sync* → Run workflow).
They need repository secrets `APP_URL` and `CRON_SECRET`.

## 6. First real data

Admin → Import → wells CSV, then funders CSV (templates on that page). Or add wells one at a time. Drop photos in the Drive folders; within ten minutes they're on the funder pages.

## Local development

```bash
cp .env.example .env.local     # fill in the same values, APP_URL=http://localhost:3000
pnpm dev
# or, with no Supabase at all:
WELLWATCH_FIXTURES=1 pnpm dev  # sample data, no login
```
