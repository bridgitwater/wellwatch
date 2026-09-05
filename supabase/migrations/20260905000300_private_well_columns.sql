-- Column-level lockdown for the wells that funders can see.
--
-- RLS decides WHICH wells a signed-in user may read; it cannot hide individual
-- columns. exact_lat / exact_lng / gps_text / contractor are for staff and
-- partners only, so the `authenticated` (and `anon`) roles lose table-level
-- SELECT on wells and get it back column by column, minus those four.
--
-- Consequences for application code:
--   * `select *` on wells fails for authenticated users ("permission denied for
--     table wells"). Always name columns — see WELL_COLUMNS in src/lib/types.ts.
--   * The admin well form reads the four private fields through
--     public.well_private_fields(well_id), a security-definer function that
--     checks is_admin() (or a field user of the well's partner org).
--   * INSERT/UPDATE/DELETE privileges are unchanged; RLS still governs them.
--   * New wells columns added later are NOT readable by authenticated until
--     granted: add `grant select (new_col) on public.wells to authenticated;`
--     to that migration.

-- 1. Table-level SELECT off, column-level SELECT on (all columns except the four).
revoke select on public.wells from authenticated, anon;

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'wells'
     and column_name not in ('exact_lat', 'exact_lng', 'gps_text', 'contractor');
  execute format('grant select (%s) on public.wells to authenticated', cols);
end $$;

-- 2. Admin/partner-only accessor for the private fields.
create or replace function public.well_private_fields(w uuid)
returns table (exact_lat double precision, exact_lng double precision, gps_text text, contractor text)
language sql stable security definer set search_path = public as $$
  select x.exact_lat, x.exact_lng, x.gps_text, x.contractor
    from public.wells x
   where x.id = w
     and (public.is_admin()
          or (public.current_role_of(auth.uid()) = 'field' and x.partner_org_id = public.my_org()))
$$;
revoke all on function public.well_private_fields(uuid) from public, anon;
grant execute on function public.well_private_fields(uuid) to authenticated, service_role;

-- 3. my_wells view already lists only public columns; nothing to change.
