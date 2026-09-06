-- Funders may edit their own display_name and notify_email, nothing else.
-- email must stay in sync with auth.users, and role / organization_id decide
-- what a user can see. profiles_update_self already forbids role/org changes in
-- its WITH CHECK, but column-level UPDATE privileges make that explicit and
-- also close off email.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, notify_email) on public.profiles to authenticated;
