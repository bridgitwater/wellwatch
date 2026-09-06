# WellWatch

Bridgit Water's funder portal. Each funder signs in with an emailed link and sees the well(s) they funded: progress through the six stages, photos and video from the field, the community, and what their gift paid for.

Photos and videos live in a Google **Shared Drive** called `Wells`, one folder per well (`UG-2026-014 · Kyabirwa`). The team drops incoming WhatsApp photos into the folder; a sync job every ten minutes turns new files into updates on the funder's page. Drive is the master copy — nothing is copied out.

## Stack

- Next.js 16 (App Router, TypeScript) on Vercel
- Supabase — Postgres with row-level security, magic-link auth
- Google Drive API via a service account (read-only in practice; creates well folders)
- Resend for notification email; MapLibre + OpenFreeMap tiles for the map

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + Google values
pnpm dev
```

### Database

Migrations live in `supabase/migrations/`; apply them with the Supabase CLI (`supabase db push`) or paste into the SQL editor in order. `supabase/seed.sql` loads two partner orgs, six sample wells and three test funders — **never run it against production** (it truncates tables).

RLS is tested against a plain local Postgres:

```bash
pnpm db:test      # applies shim + migrations + seed to a throwaway DB, runs supabase/test/rls.test.sql
pnpm test         # vitest: Drive sync planner
pnpm typecheck
```

## How the pieces fit

| Path | What |
|---|---|
| `src/proxy.ts` | Refreshes the session cookie; sends signed-out visitors to `/login` |
| `src/app/login` | Magic-link form (`shouldCreateUser: false` — only invited emails can sign in) |
| `src/app/auth/callback` | Exchanges the link for a session |
| `src/app/wells` | Funder pages: list + well page |
| `src/lib/drive/plan.ts` | Pure sync planner: folders → wells by code, files → media, hourly grouping into updates, renames, deletions |
| `src/lib/drive/sync.ts` | Runs the planner against Drive + Supabase (service role) |
| `src/app/api/cron/drive-sync` | Endpoint the scheduler pings (`Authorization: Bearer $CRON_SECRET`) |
| `.github/workflows/drive-sync.yml` | The scheduler (every 10 min). Needs repo secrets `APP_URL`, `CRON_SECRET` |

## Access rules (enforced in Postgres)

- **Funder** sees only wells linked to them in `well_funders`, only *published* updates, and only their own funding row. `cofunder_count()` gives "you and N others" without exposing anyone else.
- **Field** users see all wells for their partner organization and may insert updates (not used in v1).
- **Admin** sees and edits everything.
- The Drive sync and invitations use the service role, which bypasses RLS and never runs in the browser.
