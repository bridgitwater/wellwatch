# WellWatch — project handover

_Bridgit Water Foundation's funder portal. Last updated 6 September 2026 (Fiji time). Owner: Dusty (dusty@bridgitwater.org)._

This is the single document a new person — or a new Claude session — needs to understand WellWatch: what it is, how it works, where everything lives, what has been decided, and what is still to do. Keep it current: when something changes, change it here.

---

## 1. What WellWatch is

Bridgit funds water wells in Uganda, Malawi, Tanzania, India and Nepal through local partners (Suubi Community Projects Uganda, WESM Malawi, SPREAWS India, KEEP Nepal, Lifetime Wells Tanzania). Individual funders and families sponsor a well, in full or in part.

WellWatch gives each funder a private page for their well: the six-stage progress tracker, photos and videos from the field as they arrive, the community and people it serves, testimonials, the completion report, and a certificate once it is finished. It replaces the old routine of staff emailing photos around and sending a PDF report at the end.

Live at **https://wellwatch.bridgitwater.org** (the old `wells.bridgitwater.org` redirects there permanently).

Scale: medium — 50 to 500 funders and wells. Budget: free tiers wherever possible ("prefers free but it needs to work").

### The example well
**Ngoleka, Malawi (MW-2025-019)** — a finished drilled well built by WESM, funded by the Harrington Family in Jul–Aug 2025, rebuilt in WellWatch from the real completion report. It is published as a public example anyone can open without signing in:
**https://wellwatch.bridgitwater.org/example/MW-2025-019**

---

## 2. How it works (plain English)

1. **Staff create a well** in the admin area with its code (e.g. `MW-2025-019`), village, country, partner, well type and funders. WellWatch creates a matching folder in the "Wells" Google Shared Drive.
2. **Field photos land in Google Drive.** Partners send photos/videos to staff over WhatsApp as they always have; staff drop them into the well's Drive folder (v1 decision: partners are not asked to learn new tools).
3. **Every 10 minutes the sync runs.** It reads the whole Wells drive, matches folders to wells by the code at the start of the folder name, and turns new files into "updates" grouped by the hour they were taken. Photo times come from EXIF, interpreted in the well's country time zone.
4. **Funders sign in with an emailed link** (no password) and see only the wells they funded. Admins see everything.
5. **Every hour the notifier runs**: funders get at most one email per well per day when new updates have sat for two hours; admins get a daily digest.
6. **When the well is complete**, staff fill in the report fields (households, people, walk distance, time saved, before-story, impacts, water committee, testimonials, plaque) and the page turns into the finished report; the funder can download a certificate.

---

## 3. Where everything lives

| Thing | Where | Notes |
|---|---|---|
| Code | github.com/**bridgitwater/wellwatch** (public repo) | Public so Vercel Hobby can build it. Main branch auto-deploys. |
| Local checkout (Dusty's Mac) | `~/Documents/Bridgitwater/wellwatch` | Pushing works from here with a GitHub token (see §7). |
| Hosting | Vercel, team **flights** (slug `flights2`), project **wellwatch**, account dustyatx@gmail.com | Hobby plan. Env vars under Settings → Environments → Production. |
| Domain | `wellwatch.bridgitwater.org` — CNAME `wellwatch` → `ab4be2d2875a56b5.vercel-dns-017.com` at **Wix** DNS | `wells.bridgitwater.org` is a 308 redirect. |
| Database + auth | Supabase org **Bridgitwater**, project **wellwatch**, ref `agclpkpfjdmmfpycgdvf`, Sydney | Free plan. Postgres with row-level security. |
| Media | Google Shared Drive **"Wells"** (id `0AMVDXq5ga-yoUk9PVA`) on the bridgitwater.org Workspace | One folder per well: `MW-2025-019 · Ngoleka`. |
| Drive access | GCP project `wellwatch-507704`, service account `wellwatch-sync@wellwatch-507704.iam.gserviceaccount.com` (Content manager on the Wells drive) | Key is in Vercel as `GOOGLE_SERVICE_ACCOUNT_JSON_B64`. |
| Email | **Resend**, team "bridgitwater", domain bridgitwater.org verified, sends as `WellWatch <wellwatch@bridgitwater.org>` | Supabase Auth uses Resend SMTP for sign-in links; the app uses the Resend API for notifications. |
| Schedulers | **Supabase Cron** (pg_cron + pg_net): `wellwatch-drive-sync` every 10 min, `wellwatch-notify` hourly at :05 | GitHub Actions workflows remain as manual fallbacks only. |
| Completion reports (source material) | OneDrive on Dusty's Mac: `~/Library/CloudStorage/OneDrive-Personal/Shortcuts/BWF OneDrive/A. Country Programs/<Country>/…Completed Projects/` (~321 files); a full copy also lives in info@bridgitwater.org's Drive as "BWF Archive (from Wendy OneDrive)" | Samples in `~/Documents/Bridgitwater/_reports_sample/`. |
| Roadmap & review | Artifacts "WellWatch Build Plan", "WellWatch Roadmap"; review report `wellwatch-review.md` (delivered 6 Sep) | |

### Environment variables (Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (= https://wellwatch.bridgitwater.org, type Config), `GOOGLE_SERVICE_ACCOUNT_JSON_B64`, `DRIVE_SHARED_DRIVE_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (rotated 6 Sep; same value stored in Supabase Vault as `wellwatch_cron_secret`).

---

## 4. Technical shape

- **Next.js 16** (App Router, React 19, Tailwind 4), TypeScript, pnpm. `src/app` routes, `src/components` UI, `src/lib` logic.
- **Supabase Postgres** with RLS. Tables: organizations, profiles, wells, well_funders, stages, updates, media, costs, water_tests, testimonials, notifications, drive_sync_state. Migrations in `supabase/migrations/` (applied by pasting into the SQL editor; `supabase/test/rls.test.sql` is the permission test suite, run by `pnpm db:test` against a local Postgres and in CI).
- **Auth**: Supabase magic links, *implicit* flow so a link works from any device (the `@supabase/ssr` client forces PKCE, so `login/actions.ts` uses plain `supabase-js`). `/auth/complete` turns the URL fragment into cookies. `safeNext()` guards the `next=` redirect.
- **Roles**: `admin` (Bridgit staff), `field` (partner users — not used in v1), `funder`. `can_view_well()` is the central RLS check.
- **Column-level privacy**: funders' role cannot select `exact_lat`, `exact_lng`, `gps_text`, `contractor` on `wells`; admin pages read them via the `well_private_fields()` RPC. App code must select `WELL_COLUMNS` explicitly — `select *` on wells fails. Funders can only update `display_name` and `notify_email` on their profile.
- **Drive sync** (`src/lib/drive/sync.ts`, planner in `plan.ts`): pure planning function with unit tests; service-role client with pinned auth header, paged reads, 3× retry. Media rows are hard-deleted when files leave a well folder (captions/tags are lost — known).
- **Public example pages** (`/example/<code>`): served with the service role for wells flagged `showcase = true`; funding amount, dedication and costs are stripped server-side.
- **Emails**: `src/lib/email/notify.ts` (funder notices, admin digest), templates match the portal palette; the Supabase magic-link template lives in `supabase/email-templates/magic-link.html`.
- **Tests**: `pnpm test` (vitest, 24 tests), `pnpm db:test` (RLS), `pnpm typecheck`, `pnpm lint`; all run in GitHub Actions `ci.yml` on every push.

---

## 5. Decisions made (and why)

- **Drive, not Supabase Storage, for media** — Bridgit has 100 TB of Workspace storage; Drive's player handles video; staff already work in Drive.
- **Partners keep WhatsApping staff** — ground partners are not tech-savvy; partner-facing tools deferred.
- **Shared wells are supported** — Bridgit accepts full or partial sponsorship; funders see only their own amount, plus "you and N others".
- **Field posts auto-publish** — no admin review step; admins can hide an update afterwards.
- **Magic links in implicit flow** — so a link opened on a phone works even if requested on a laptop.
- **Repo is public** — Vercel Hobby can't build private org repos.
- **Schedulers on Supabase Cron** — GitHub Actions' schedule was unreliable (fired once an hour).
- **Funder page mirrors the completion report** — households × ~6 = people, GPS, before-story, partner intro, phase photos, named testimonials, water user committee (8 members, ≥3 women, woman treasurer, 2 youth, 1 person with disability), impacts, challenges, plaque.
- **Exact GPS and contractor are staff-only**; the map shows a village-level pin and opens at continent zoom.
- **Public showcase link** rather than a static PDF for the example well.
- **Brand spelling is "Bridgit"** (not "BridgIT").
- **Dates are well-local** — EXIF times and displayed dates use the well country's time zone.

---

## 6. Status

### 27 Oct 2026 (safe to invite funders)
- **Unsubscribe**: every funder update email, welcome and admin digest carries a personal signed link (`/unsubscribe?u=&t=`, asks before changing anything) and `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers (POST `/api/unsubscribe`). Tokens are an HMAC of the profile id keyed from `UNSUBSCRIBE_SECRET` if set, else derived from the service-role key: **set `UNSUBSCRIBE_SECRET` in Vercel** before rotating that key, or old links stop working. `src/lib/email/unsubscribe.ts`.
- **Welcomes page** (Admin → Welcomes): everyone linked but not yet welcomed, grouped by funder; tick and send up to 25 at a time; **one email per funder covering all their wells** (SMEC's 9 wells = one email, one sign-in link). "Preview email" shows exactly what they'll get (`/admin/welcomes/preview`, admin only, sends nothing). Claims `welcomed_at` before sending and undoes every claim if anything fails.
- **Private Drive folders, two phases** (`src/lib/drive/shares.ts`, ledger `drive_shares`, `desired_drive_shares()`):
  1. Every Drive sync gives each file funders may see (visible media of published updates, reports, testimonial photos, logos) its **own** "anyone with the link" permission and has Drive confirm it (`permissionDetails.inherited = false`); takes own links off anything else (Drive's `hasAugmentedPermissions` catches hand-shared files too). Folders untouched. Hide/show applies straight away.
  2. Admin → Today → **Drive privacy** card: "Try one folder first", then "Make all folders private". A folder only goes private when every one of its funder-visible files has a confirmed own link (checked fresh, and again after). Afterwards the sync takes away any link someone adds back to a private folder.
  - Before phase 2: staff who open well folders need to be **members of the Wells shared drive** (Carla); hidden-photo thumbnails in the admin show only to browsers signed into Google with access. New well folders are created private. The "folder viewable by link" toggle is gone.
- Migration `20261027010000_drive_shares.sql` must be applied **before** this code.

### 27 Oct 2026 (stress test + hardening)
Stress-tested the 26 Oct batch against a full local stack (Supabase Postgres, GoTrue, PostgREST from ghcr.io; mailpit; a fake Resend; production limits) and fixed what broke:
- **Sign-in emails are now sent by WellWatch through Resend**, not Supabase Auth. Supabase's 30/hour project allowance could be used up by anyone (locking every funder out, and making on-file emails answer differently, which revealed who is on file); its links also signed in on a plain GET. `login/actions.ts` now looks up the profile, asks `signin_allow()` (1 link/min and 3/hour per person, 30 requests/hour per IP from Vercel's `x-real-ip`, 60 sign-in emails/day in total so Resend's daily allowance stays free for update emails), and sends the link from `after()`. Every request answers "a link is on its way", in the same time. Links go to the button-press `/auth/confirm`. The Supabase "Magic link" template is no longer used for new links; `/auth/complete` stays for links already in inboxes.
- **Welcome emails** claim `welcomed_at` before sending (and restore it if sending fails): no double welcomes from two admins, never "sent but not recorded".
- **Account creation** is race-safe (`createAccount`/`profileIdFor` in `src/lib/admin/funders.ts`); roles are set explicitly, never from sign-up metadata.
- **Removing admins** goes through `demote_admin()`, which never leaves zero admins. **Adding an admin** asks first and warns for non-bridgitwater.org addresses.
- **Notifier** takes a `job_locks` lock (`job_try_lock`/`job_unlock`), so overlapping runs can't double-email.
- Emails are normalised the same way everywhere (`src/lib/email-address.ts`), including CSV import. `/auth/confirm` shows "try again" on a network drop instead of "expired".
- Migration `20261027000000_hardening.sql` must be applied **before** this code (sign-in calls `signin_allow`).

### 26 Oct 2026 (admin experience batch)
- **Team page** (Admin → Team): add an admin by email (creates a confirmed account or promotes an existing funder, then emails a welcome with a sign-in link), send a fresh sign-in link, remove admin access (not yourself). Replaces adding staff in the Supabase dashboard + SQL. `src/lib/admin/team-actions.ts`.
- **Funder welcome step**: `well_funders.welcomed_at`. Linking a funder sends nothing; the notifier skips funders until an admin presses "Send welcome email" on the well page (or ticks it when linking). Welcome and team emails link to **/auth/confirm**, which signs in only when the person presses a button, so corporate mail scanners can't use up the one-time token. Every new link replaces the person's previous one. Links last the project's email OTP lifetime (1 hour; consider raising to 24 h in Supabase → Auth → Email).
- **Sign-in misses**: requests that sent no link (not on file / rate limited / error) go to `signin_attempts` (admin-read only, max 100 rows/hour, 90-day retention in the notifier) and appear in the daily digest and on the Team page. The page still says "a link is on its way" to everyone, including during the per-person 60-second cooldown.
- **Admin forms** all go through `src/components/admin/action-form.tsx`: errors and "Saved" show by the button, deletes ask first, typed text survives a failed save.
- Small: Drive sync time shows in the viewer's own time zone; admins land on /admin after signing in (and when already signed in at /login); one label ("Handed to the community") for the last stage everywhere; page titles; sign-in copy for staff; digest now covers everything since the previous digest and no longer drifts a day.
- Migration `20261026000000_welcome_and_signin_log.sql` must be applied **before** this code is deployed (the notifier reads `welcomed_at`).

### 26 Oct 2026 (Carla couldn't sign in)
- Carla's admin login is **carla@bridgitwater.org** (not info@). Dusty added her on 21 Oct with Supabase's "Invite user"; she opened the invite after it expired, so her email stayed unconfirmed. Supabase treats an unconfirmed user's sign-in as a new signup, signups are disabled, and `login/actions.ts` hid that `signup_disabled` error behind "a sign-in link is on its way" — so nothing ever arrived.
- Fixed (ad81821): on `signup_disabled`, if the email has a profile, the action confirms it with the service role and resends the link. Expired links that land on /login with `#error=` now show the "link expired" notice. Verified live: carla@ confirmed 26 Oct 07:35 UTC, role admin, link issued.
- Prefer adding staff/funders through WellWatch (or Supabase "Add user" with auto-confirm) over Supabase "Invite user"; if an invite is used, the person can now simply request a link on the sign-in page.

### 19 Oct 2026 (health check + Wave 1)
Full health check and fix plan: Claude Docs "WellWatch health check and fix plan"; partner/Carla guide: "WellWatch onboarding guide". Sync and notify crons verified (1,008/1,008 and 168/168 runs OK over 7 days); magic link delivers to inbox in under a minute.
- Fixed: admin Partners page was empty since migration 000300 (`wells(count)` refused for authenticated) — now `wells(id)`; piped-scheme stage names; functions pinned to `syd1` via `vercel.json`.
- Data: partners SPREAWS, SRHED, KEEP added. Pilot wells loaded (no funders invited yet): IN-2026-001 Vaddipalli (SRHED), IN-2026-002 Koonavaripalli (SPREAWS), UG-2026-001 Wabwoko HCIII (Suubi, in progress), NP-2026-001 Takare (KEEP). Codes are CC-YYYY-NNN in load order. Ngoleka example anonymised ("an Australian family").
- Email: wells@bridgitwater.org does not exist (bounces). wellwatch@ accepts mail but nobody receives it — route it to info@ in Google Admin.
- Carla's admin login: see 26 Oct (carla@, not info@).
- Open (Wave 2): welcome/invite email, same-day updates marked notified without sending, hidden media still reachable via link-shared folders, unsubscribe link, admin action errors, WhatsApp filename dates.

### 6 Sep 2026

Done and live: everything above, including Phase 0 of the roadmap (sync reliability, privacy lockdown, open-redirect fix, cron migration, EXIF/timezone, editable update dates, admin sees all wells), the review's quick wins (error/loading pages, CI, contrast, copy, notification reliability, certificate naming), the showcase feature, branding, the domain move and the redesigned sign-in email. Test well UG-2026-014 has been deleted. Only Ngoleka exists in the live database.

**Still to do**
- Import the real wells and invite funders (decide which wells first). Harrington Family funder email/amount not yet entered for Ngoleka.
- From the review: CSV import stamps every past stage with today's date; admin actions give no error feedback; DriveImage ignores `sizes`; MapLibre (~800 KB) loads for a single pin; emails need an unsubscribe link/`List-Unsubscribe`; unify the country name/time-zone tables; generate Supabase TypeScript types; consider a photo proxy so Drive folders needn't be link-shared.
- Housekeeping: GitHub Actions secrets `APP_URL`/`CRON_SECRET` still hold old values (manual fallback only); revoke the old `wellwatch-claude` GitHub token and delete `wellwatch-push` when not needed; re-add Organization Administrator role in GCP; Vercel deployment protection for `*.vercel.app` URLs; clear `_to_delete/` folders on the Mac.
- Decide budget stance: US$0 vs ~US$40/mo (Vercel Pro + Resend Pro) as funders grow.
- Decide whether the public example page should name the sponsoring family (it currently shows the `sponsor_line`).
- Make sure `wellwatch@bridgitwater.org` exists as a mailbox or alias in Google Workspace (it is now the sender and the contact address in every email and page footer). As of 26 Oct a test email to it still reached nobody.

---

## 7. Working on it with Claude (practical notes)

- **Start a task with the repo attached** (pick `bridgitwater/wellwatch` in the composer). If the cloud git proxy still refuses to push ("not in this session's authorized repository set"), the fallback is: bundle commits (`git bundle create`), copy the bundle to the Mac's checkout, `git fetch` it there and push from the Mac's shell with a fine-grained GitHub token (`wellwatch-push`, Contents: read/write on bridgitwater/wellwatch) — the Mac VM can reach github.com.
- **Database changes**: paste migration SQL into the Supabase SQL editor (Claude does this through the built-in browser pane; the pane's Monaco editor accepts typed text; ⌘-Enter doesn't fire, click Run). Order matters: apply **additive** migrations (new columns/tables the code reads, e.g. 26 Oct) **before** deploying the code; apply migrations that **revoke** columns **after** the code that stops using them.
- **Supabase auth templates**: editable through the pane via `monaco.editor.getModels()[0]` + `executeEdits`, then Save; allow a couple of minutes before testing.
- **Vercel**: env vars are under Settings → Environments → Production. A variable created as "Secret" can't be revealed or edited to Config — delete and recreate. `CRON_SECRET` is Secret type.
- **Browser pane quirks**: when the pane is hidden, coordinate clicks often don't land — use `find` + `ref` clicks, `form_input`, or `javascript_tool` with `form.requestSubmit()`. The pane's cookies are per-host (the new domain needed a fresh sign-in).
- **Google Drive connector in Cowork** is `info@bridgitwater.org`, a Content manager on the Wells drive — it can copy files server-side (`copy_file`) and trash folders. Uploading bytes from Claude: write into `~/Library/CloudStorage/GoogleDrive-info@bridgitwater.org/My Drive/WellWatch uploads/` on the Mac and let Drive for desktop sync.
- **Dusty's Chrome** shows a "'ChatGPT' started debugging this browser" banner — a different extension, not Claude.
