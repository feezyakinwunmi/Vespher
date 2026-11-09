-- =====================================================================
-- DEMO FLEET: 10 motorcycles, 15 delivery bags and some fuel/maintenance
-- entries, so you can try assigning bikes and bags to riders.
--
-- Run the whole file in Supabase → SQL Editor (after the fleet migrations
-- 20261105, 20261106 and 20261107).
-- Every demo row has notes = 'Demo data' so it can be removed later
-- (see the cleanup at the bottom). Safe to run twice: existing plates and
-- bag codes are skipped.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Bikes (all available except one in repair)
-- ---------------------------------------------------------------------
insert into public.company_bikes (plate_number, make, model, year, color, engine_number, chassis_number, status, notes)
values
  ('LSR 101 VS', 'Bajaj',   'Boxer BM150', 2024, 'Red',    'ENG-BJ-24001', 'CHS-BJ-24001', 'available',   'Demo data'),
  ('LSR 102 VS', 'Bajaj',   'Boxer BM150', 2024, 'Red',    'ENG-BJ-24002', 'CHS-BJ-24002', 'available',   'Demo data'),
  ('LSR 103 VS', 'Bajaj',   'Boxer BM150', 2024, 'Black',  'ENG-BJ-24003', 'CHS-BJ-24003', 'available',   'Demo data'),
  ('LSR 104 VS', 'TVS',     'HLX 125',     2023, 'Blue',   'ENG-TV-23004', 'CHS-TV-23004', 'available',   'Demo data'),
  ('LSR 105 VS', 'TVS',     'HLX 125',     2023, 'Blue',   'ENG-TV-23005', 'CHS-TV-23005', 'available',   'Demo data'),
  ('LSR 106 VS', 'Honda',   'Ace 125',     2024, 'Black',  'ENG-HN-24006', 'CHS-HN-24006', 'available',   'Demo data'),
  ('LSR 107 VS', 'Honda',   'Ace 125',     2024, 'Orange', 'ENG-HN-24007', 'CHS-HN-24007', 'available',   'Demo data'),
  ('LSR 108 VS', 'Haojue',  'HJ125-7',     2023, 'Red',    'ENG-HJ-23008', 'CHS-HJ-23008', 'available',   'Demo data'),
  ('LSR 109 VS', 'Haojue',  'HJ125-7',     2023, 'White',  'ENG-HJ-23009', 'CHS-HJ-23009', 'available',   'Demo data'),
  ('LSR 110 VS', 'Bajaj',   'Boxer BM150', 2022, 'Red',    'ENG-BJ-22010', 'CHS-BJ-22010', 'maintenance', 'Demo data')
on conflict (plate_number) do nothing;

-- ---------------------------------------------------------------------
-- Delivery bags (all available except one damaged)
-- ---------------------------------------------------------------------
insert into public.delivery_bags (bag_code, size, color, status, notes)
select 'BAG-' || lpad(n::text, 3, '0'),
       case when n % 3 = 0 then 'Medium' else 'Large' end,
       'Orange',
       case when n = 15 then 'damaged' else 'available' end,
       'Demo data'
  from generate_series(1, 15) as n
on conflict (bag_code) do nothing;

-- ---------------------------------------------------------------------
-- Fuel & maintenance over the last 60 days for the demo bikes
-- ---------------------------------------------------------------------
insert into public.bike_expenses (bike_id, kind, amount, litres, odometer_km, note, spent_at)
select b.id,
       'fuel',
       (4 + floor(random() * 4)) * 1000,                       -- ₦4,000 – ₦7,000
       round((3 + random() * 4)::numeric, 1),                  -- 3–7 litres
       1000 + d * 35 + floor(random() * 20)::int,
       'Demo data',
       current_date - d
  from public.company_bikes b
  cross join generate_series(0, 56, 4) as d
 where b.notes = 'Demo data' and b.status <> 'maintenance'
   and not exists (select 1 from public.bike_expenses e where e.bike_id = b.id and e.note = 'Demo data');

insert into public.bike_expenses (bike_id, kind, amount, odometer_km, note, spent_at)
select b.id, x.kind, x.amount, 2500, 'Demo data', current_date - x.days_ago
  from public.company_bikes b
  cross join (values
    ('service', 12000, 30),
    ('parts',    8500, 18),
    ('repair',  25000, 6)
  ) as x(kind, amount, days_ago)
 where b.notes = 'Demo data' and b.plate_number in ('LSR 101 VS', 'LSR 104 VS', 'LSR 110 VS')
   and not exists (select 1 from public.bike_expenses e where e.bike_id = b.id and e.note = 'Demo data' and e.kind <> 'fuel');

commit;

-- Check (optional):
-- select status, count(*) from company_bikes where notes = 'Demo data' group by status;
-- select status, count(*) from delivery_bags where notes = 'Demo data' group by status;
-- select count(*), sum(amount) from bike_expenses where note = 'Demo data';

-- =====================================================================
-- CLEANUP: remove all demo fleet data (run on its own when you're done).
-- Take demo bikes/bags back from riders first, or this also removes those
-- assignments.
-- =====================================================================
-- delete from public.bike_expenses where note = 'Demo data';
-- delete from public.company_bikes where notes = 'Demo data';
-- delete from public.delivery_bags where notes = 'Demo data';
