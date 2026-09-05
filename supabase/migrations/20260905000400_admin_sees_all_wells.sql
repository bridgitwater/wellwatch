-- Admins see every well on /wells (the funder list), not only wells they fund.
-- my_wells stays security_invoker; the funding columns are the admin's own row
-- when they happen to fund the well, otherwise null.

drop view public.my_wells;
create view public.my_wells with (security_invoker = true) as
select w.id, w.code, w.name, w.country, w.region, w.status, w.well_type, w.people_served, w.households,
       w.approx_lat, w.approx_lng, w.updated_at,
       wf.amount, wf.currency as funded_currency, wf.funded_at, wf.is_primary,
       (select max(u.happened_at) from public.updates u
         where u.well_id = w.id and u.status = 'published') as last_update_at,
       (select m.drive_file_id from public.media m
         join public.updates u on u.id = m.update_id
        where m.well_id = w.id and m.kind = 'photo' and m.hidden = false and u.status = 'published'
        order by m.taken_at desc nulls last, m.created_at desc limit 1) as cover_file_id
  from public.wells w
  left join public.well_funders wf on wf.well_id = w.id and wf.profile_id = auth.uid()
 where wf.id is not null or public.is_admin();
