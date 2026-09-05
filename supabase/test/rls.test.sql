-- RLS behaviour tests. Run after shim + migration + seed:
--   psql -v ON_ERROR_STOP=1 -d wellwatch_test -f supabase/test/rls.test.sql
-- Every assertion raises if it fails; a clean run prints "RLS OK".

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

begin;

-- Funder one (Margaret): funds Kyabirwa (co-funded) and Mtenje -----------------
select pg_temp.as_user('10000000-0000-0000-0000-000000000011');
select pg_temp.assert((select count(*) from wells) = 2, 'funder one sees exactly her 2 wells');
select pg_temp.assert((select count(*) from wells where code = 'MW-2026-031') = 0, 'funder one cannot see Chipoka');
select pg_temp.assert((select count(*) from well_funders) = 2, 'funder one sees only her own funding rows');
select pg_temp.assert((select count(*) from well_funders where profile_id <> auth.uid()) = 0, 'no co-funder rows leak');
select pg_temp.assert(cofunder_count('20000000-0000-0000-0000-000000000001') = 2, 'but cofunder_count says 2 funded Kyabirwa');
select pg_temp.assert((select count(*) from updates) = 4, 'funder one sees Kyabirwa''s 4 published updates (Mtenje has none)');
select pg_temp.assert((select count(*) from media) = 7, 'and their 7 media');
select pg_temp.assert((select count(*) from costs) = 6, 'and Kyabirwa cost lines');
select pg_temp.assert((select count(*) from water_tests) = 1, 'and the water test');
select pg_temp.assert((select count(*) from profiles) = 1, 'funder sees only own profile');
select pg_temp.assert((select count(*) from testimonials) = 2, 'funder one sees testimonials for her 2 wells only');
select pg_temp.assert((select count(*) from organizations where type = 'partner') >= 1, 'funder can read the partner org behind her well');
select pg_temp.assert((select count(*) from organizations o where not exists (select 1 from wells w where w.partner_org_id = o.id)) = 0, 'but no unrelated organizations');
select pg_temp.assert((select count(*) from my_wells) = 2, 'my_wells view returns 2');
select pg_temp.assert((select count(*) from my_wells where amount is null) = 0, 'each my_wells row carries her own funding');
select pg_temp.assert((select cover_file_id from my_wells where code = 'UG-2026-014') = 'seed-kyabirwa-hand-2', 'cover is latest photo');
-- Private columns: funders have no SELECT privilege on them at all -----------------
do $$ begin
  perform exact_lat from wells where code = 'UG-2026-014';
  raise exception 'ASSERT FAILED: funder could select wells.exact_lat';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform exact_lng, gps_text, contractor from wells where code = 'UG-2026-014';
  raise exception 'ASSERT FAILED: funder could select wells.exact_lng/gps_text/contractor';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform * from wells where code = 'UG-2026-014';
  raise exception 'ASSERT FAILED: funder could select * from wells';
exception when insufficient_privilege then null; end $$;
select pg_temp.assert((select count(*) from wells where code = 'UG-2026-014') = 1, 'but public columns of the well are still readable');
select pg_temp.assert((select count(*) from well_private_fields('20000000-0000-0000-0000-000000000001')) = 0, 'well_private_fields returns nothing to a funder');

-- Funder cannot write ----------------------------------------------------------
do $$ begin
  insert into updates (well_id, body) values ('20000000-0000-0000-0000-000000000001', 'hi');
  raise exception 'ASSERT FAILED: funder inserted an update';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update wells set name = 'x' where code = 'UG-2026-014';
  perform pg_temp.assert(not exists (select 1 from wells where name = 'x'), 'funder update to wells had no effect');
end $$;

-- Hidden update is invisible to funders ------------------------------------------
reset role; select set_config('request.jwt.claim.sub', '', true);
update updates set status = 'hidden' where id = '30000000-0000-0000-0000-000000000002';
select pg_temp.as_user('10000000-0000-0000-0000-000000000011');
select pg_temp.assert((select count(*) from updates) = 3, 'hidden update disappears');
select pg_temp.assert((select count(*) from media) = 4, 'and so do its 3 media');

-- Funder three (parish): Kyabirwa + Buwenge ----------------------------------------
select pg_temp.as_user('10000000-0000-0000-0000-000000000013');
select pg_temp.assert((select count(*) from wells) = 2, 'funder three sees 2 wells');
select pg_temp.assert((select amount from well_funders where well_id = '20000000-0000-0000-0000-000000000001') = 3800, 'sees own amount only');

-- Field user (Grace, Busoga Trust): all 3 UG wells incl. hidden updates, no MW ----
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*) from wells) = 3, 'field user sees her org''s 3 wells');
select pg_temp.assert((select count(*) from wells where country = 'MW') = 0, 'and none in Malawi');
select pg_temp.assert((select count(*) from updates where status = 'hidden') = 1, 'field user sees hidden updates');
select pg_temp.assert((select count(*) from well_funders) = 0, 'field user sees no funder rows');
insert into updates (well_id, author_id, source, body) values
  ('20000000-0000-0000-0000-000000000003', auth.uid(), 'admin', 'field post ok');
do $$ begin
  insert into updates (well_id, author_id, body) values ('20000000-0000-0000-0000-000000000004', auth.uid(), 'nope');
  raise exception 'ASSERT FAILED: field user posted to another org''s well';
exception when insufficient_privilege then null; end $$;

-- Admin sees everything -------------------------------------------------------------
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.assert((select count(*) from wells) = 6, 'admin sees all 6 wells');
select pg_temp.assert((select count(*) from my_wells) = 6, 'my_wells lists all 6 for the admin');
select pg_temp.assert((select count(*) from well_funders) = 5, 'admin sees all funding');
select pg_temp.assert((select count(*) from profiles) = 5, 'admin sees all profiles');
update wells set people_served = 650 where code = 'UG-2026-014';
select pg_temp.assert((select people_served from wells where code = 'UG-2026-014') = 650, 'admin can update wells');
update wells set exact_lat = 0.7301, exact_lng = 32.9658, gps_text = 'N 0.7301, E 32.9658', contractor = 'Test Drillers' where code = 'UG-2026-014';
select pg_temp.assert((select gps_text from well_private_fields('20000000-0000-0000-0000-000000000001')) = 'N 0.7301, E 32.9658', 'admin reads private fields via well_private_fields()');
select pg_temp.assert((select contractor from well_private_fields('20000000-0000-0000-0000-000000000001')) = 'Test Drillers', 'incl. contractor');

-- Field user of the partner org reads private fields; another org's field user does not
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*) from well_private_fields('20000000-0000-0000-0000-000000000001')) = 1, 'partner field user reads private fields of own well');

-- Anonymous sees nothing -------------------------------------------------------------
reset role; select set_config('request.jwt.claim.sub', '', true); set local role anon;
do $$ begin
  perform count(*) from wells;
  raise exception 'ASSERT FAILED: anon could select from wells';
exception when insufficient_privilege then null; end $$;  -- anon has no SELECT on wells at all
select pg_temp.assert((select count(*) from updates) = 0, 'anon sees no updates');

rollback;
\echo RLS OK
