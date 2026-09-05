-- Sample data for local development and the Phase 1 walkthrough.
-- Safe to re-run: wipes public tables first. Do NOT run against production.

truncate public.notifications, public.media, public.updates, public.water_tests, public.costs,
         public.stages, public.well_funders, public.wells, public.profiles, public.organizations
  restart identity cascade;
delete from auth.users;

-- Organizations -------------------------------------------------------------
insert into public.organizations (id, name, country, type) values
  ('00000000-0000-0000-0000-000000000001', 'BridgIT Water Foundation', 'AU', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'Busoga Trust Drilling', 'UG', 'partner'),
  ('00000000-0000-0000-0000-000000000003', 'Salima Community Water Works', 'MW', 'partner');

-- Users (auth.users insert fires the profile trigger) ------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'dusty@bridgitwater.org',
     '{"display_name":"Dusty","role":"admin","organization_id":"00000000-0000-0000-0000-000000000001"}'),
  ('10000000-0000-0000-0000-000000000002', 'grace@busogatrust.example',
     '{"display_name":"Grace Namukose","role":"field","organization_id":"00000000-0000-0000-0000-000000000002"}'),
  ('10000000-0000-0000-0000-000000000011', 'funder.one@example.com',   '{"display_name":"Margaret Chen"}'),
  ('10000000-0000-0000-0000-000000000012', 'funder.two@example.com',   '{"display_name":"The Hendersons"}'),
  ('10000000-0000-0000-0000-000000000013', 'funder.three@example.com', '{"display_name":"St Luke''s Parish, Geelong"}');

-- Wells ---------------------------------------------------------------------
insert into public.wells (id, code, name, country, region, village, approx_lat, approx_lng, people_served,
                          depth_m, yield_lph, source_type, dedication, summary, partner_org_id, target_cost, currency) values
  ('20000000-0000-0000-0000-000000000001', 'UG-2026-014', 'Kyabirwa', 'UG', 'Jinja District', 'Kyabirwa',
     0.4855, 33.1912, 640, 48.0, 1200, 'Borehole with India Mark II hand pump',
     'In memory of Robert Chen', 'A farming village on the east bank of the Nile. Until now women walked 2.5 km to an unprotected spring.',
     '00000000-0000-0000-0000-000000000002', 9800, 'AUD'),
  ('20000000-0000-0000-0000-000000000002', 'UG-2026-015', 'Buwenge Central', 'UG', 'Jinja District', 'Buwenge',
     0.6440, 33.1780, 1100, null, null, 'Borehole with hand pump',
     null, 'Trading-centre community with a primary school of 420 pupils.',
     '00000000-0000-0000-0000-000000000002', 10400, 'AUD'),
  ('20000000-0000-0000-0000-000000000003', 'UG-2026-016', 'Namulesa', 'UG', 'Jinja District', 'Namulesa',
     0.5070, 33.2260, 520, null, null, 'Borehole with hand pump',
     null, 'Roadside village; the nearest safe water is a rehabilitated well 3 km away.',
     '00000000-0000-0000-0000-000000000002', 9800, 'AUD'),
  ('20000000-0000-0000-0000-000000000004', 'MW-2026-031', 'Chipoka', 'MW', 'Salima District', 'Chipoka',
     -13.9880, 34.5120, 880, 36.5, 900, 'Borehole with Afridev pump',
     'Given by the Henderson family', 'Lakeshore fishing community. Dry-season shallow wells go brackish.',
     '00000000-0000-0000-0000-000000000003', 8900, 'AUD'),
  ('20000000-0000-0000-0000-000000000005', 'MW-2026-032', 'Mtenje', 'MW', 'Salima District', 'Mtenje',
     -13.7810, 34.4550, 610, null, null, 'Borehole with Afridev pump',
     null, 'Inland farming village, 45 minutes from the tarmac.',
     '00000000-0000-0000-0000-000000000003', 8900, 'AUD'),
  ('20000000-0000-0000-0000-000000000006', 'MW-2026-033', 'Kambwiri', 'MW', 'Salima District', 'Kambwiri',
     -13.8600, 34.4100, 730, null, null, 'Borehole with Afridev pump',
     null, 'Two neighbouring hamlets sharing one site next to the health post.',
     '00000000-0000-0000-0000-000000000003', 8900, 'AUD');

-- Funders -> wells (Kyabirwa is co-funded) -----------------------------------
insert into public.well_funders (well_id, profile_id, amount, currency, funded_at, is_primary) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 6000, 'AUD', '2026-06-02', true),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013', 3800, 'AUD', '2026-06-15', false),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000012', 8900, 'AUD', '2026-07-10', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000013', 10400, 'AUD', '2026-07-22', true),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000011', 8900, 'AUD', '2026-08-18', true);

-- Stage history ---------------------------------------------------------------
-- Kyabirwa: complete
insert into public.stages (well_id, stage, reached_at, expected_at, note) values
  ('20000000-0000-0000-0000-000000000001', 'funded',        '2026-06-15', null, null),
  ('20000000-0000-0000-0000-000000000001', 'survey',        '2026-06-24', null, 'Hydrogeological survey; site chosen beside the school'),
  ('20000000-0000-0000-0000-000000000001', 'drilling',      '2026-07-06', null, 'Water struck at 42 m, drilled to 48 m'),
  ('20000000-0000-0000-0000-000000000001', 'pump_apron',    '2026-07-11', null, null),
  ('20000000-0000-0000-0000-000000000001', 'water_flowing', '2026-07-12', null, 'Yield test 1,200 L/h'),
  ('20000000-0000-0000-0000-000000000001', 'handover',      '2026-07-19', null, 'Water committee of 7 trained; 4 women');
-- Chipoka: pump installed, awaiting handover
insert into public.stages (well_id, stage, reached_at, expected_at) values
  ('20000000-0000-0000-0000-000000000004', 'funded',        '2026-07-10', null),
  ('20000000-0000-0000-0000-000000000004', 'survey',        '2026-07-21', null),
  ('20000000-0000-0000-0000-000000000004', 'drilling',      '2026-08-04', null),
  ('20000000-0000-0000-0000-000000000004', 'pump_apron',    '2026-08-12', null),
  ('20000000-0000-0000-0000-000000000004', 'water_flowing', '2026-08-13', null),
  ('20000000-0000-0000-0000-000000000004', 'handover',      null, '2026-09-12');
-- Buwenge: drilling now
insert into public.stages (well_id, stage, reached_at, expected_at) values
  ('20000000-0000-0000-0000-000000000002', 'funded',   '2026-07-22', null),
  ('20000000-0000-0000-0000-000000000002', 'survey',   '2026-08-05', null),
  ('20000000-0000-0000-0000-000000000002', 'drilling', '2026-09-01', null),
  ('20000000-0000-0000-0000-000000000002', 'pump_apron', null, '2026-09-10');
-- Mtenje: just funded
insert into public.stages (well_id, stage, reached_at, expected_at) values
  ('20000000-0000-0000-0000-000000000005', 'funded', '2026-08-18', null),
  ('20000000-0000-0000-0000-000000000005', 'survey', null, '2026-09-15');
-- Namulesa, Kambwiri: not yet funded (no stages) -> status defaults to 'funded' but no funders.

-- Costs (Kyabirwa) --------------------------------------------------------------
insert into public.costs (well_id, category, amount, currency) values
  ('20000000-0000-0000-0000-000000000001', 'drilling',       5200, 'AUD'),
  ('20000000-0000-0000-0000-000000000001', 'pump',           1650, 'AUD'),
  ('20000000-0000-0000-0000-000000000001', 'apron_platform',  900, 'AUD'),
  ('20000000-0000-0000-0000-000000000001', 'training',        650, 'AUD'),
  ('20000000-0000-0000-0000-000000000001', 'transport',       800, 'AUD'),
  ('20000000-0000-0000-0000-000000000001', 'monitoring',      600, 'AUD');

-- Water test (Kyabirwa) -----------------------------------------------------------
insert into public.water_tests (well_id, tested_at, ph, turbidity_ntu, e_coli_cfu, fluoride_mgl, arsenic_ugl, passed, lab) values
  ('20000000-0000-0000-0000-000000000001', '2026-07-14', 6.9, 1.2, 0, 0.4, 1.0, true, 'NWSC Jinja laboratory');

-- Updates + media (Drive file IDs are placeholders until the sync runs) --------------
insert into public.updates (id, well_id, author_id, source, stage, body, happened_at, notify_after, notified_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', 'survey',
     'Survey team walked the site with the village committee today. The borehole will go beside the primary school so the children can drink before class.', '2026-06-24 10:00+03', '2026-06-24 12:00+03', '2026-06-24 12:00+03'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'drive', 'drilling',
     'Rig arrived at 7am. Hit water at 42 metres — big cheer from everyone watching.', '2026-07-06 15:30+03', '2026-07-06 17:30+03', '2026-07-06 17:30+03'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'drive', 'water_flowing',
     'First clean water. Yield test came back at 1,200 litres an hour, more than enough for the whole village.', '2026-07-12 11:00+03', '2026-07-12 13:00+03', '2026-07-12 13:00+03'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'drive', 'handover',
     'Handover ceremony. The water committee (four women, three men) has been trained on pump maintenance and will collect a small monthly fee for repairs.', '2026-07-19 14:00+03', '2026-07-19 16:00+03', '2026-07-19 16:00+03'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'drive', 'drilling',
     'Drilling day two at Chipoka. Sandy layers down to 20 m, then hard rock.', '2026-08-04 16:00+02', '2026-08-04 18:00+02', '2026-08-04 18:00+02'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'drive', 'drilling',
     null, '2026-09-01 12:00+03', '2026-09-01 14:00+03', null);

insert into public.media (update_id, well_id, drive_file_id, kind, mime, name, width, height, taken_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-survey-1', 'photo', 'image/jpeg', 'IMG_4021.jpg', 1600, 1200, '2026-06-24 09:40+03'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-drill-1',  'photo', 'image/jpeg', 'IMG_4102.jpg', 1600, 1200, '2026-07-06 08:10+03'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-drill-2',  'photo', 'image/jpeg', 'IMG_4117.jpg', 1200, 1600, '2026-07-06 14:55+03'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-drill-v1', 'video', 'video/mp4',  'VID_4118.mp4', 1280, 720,  '2026-07-06 15:02+03'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-water-1',  'photo', 'image/jpeg', 'IMG_4160.jpg', 1600, 1200, '2026-07-12 10:30+03'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-hand-1',   'photo', 'image/jpeg', 'IMG_4210.jpg', 1600, 1200, '2026-07-19 13:20+03'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'seed-kyabirwa-hand-2',   'photo', 'image/jpeg', 'IMG_4215.jpg', 1600, 1200, '2026-07-19 13:45+03'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'seed-chipoka-drill-1',   'photo', 'image/jpeg', 'IMG_0087.jpg', 1600, 1200, '2026-08-04 15:10+02'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'seed-buwenge-drill-1',   'photo', 'image/jpeg', 'IMG_5001.jpg', 1600, 1200, '2026-09-01 11:30+03');
