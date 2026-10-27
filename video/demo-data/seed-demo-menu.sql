-- =====================================================================
-- Demo menu for recording the promo videos.
--
-- 1. In the Vesphe app, sign up a vendor with the email below (e.g. "Mama Vesphe
--    Kitchen"), and a customer account for recording.
-- 2. Run this file. It approves that store and fills its menu with 8 dishes that
--    show off the details sheet, the health warnings and the meal planner.
-- 3. Add a nice photo to each dish from the web dashboard (Vendor → Menu).
-- 4. After recording, run remove-demo-menu.sql so real customers don't see it.
--
-- Safe to re-run: it replaces the demo dishes each time.
-- =====================================================================
do $$
declare
  v_email text := 'demo.vendor@vesphe.app';   -- ← the demo vendor's login email
  v_vendor uuid;
begin
  select v.id into v_vendor
    from vendors v join users u on u.id = v.owner_id
   where lower(u.email) = lower(v_email);
  if v_vendor is null then
    raise exception 'No vendor store found for %. Sign it up in the app first.', v_email;
  end if;

  update vendors
     set is_approved = true, is_suspended = false, is_open = true,
         description = coalesce(nullif(description, ''), 'Home-style Nigerian meals, cooked fresh with clear ingredients.')
   where id = v_vendor;

  delete from products where vendor_id = v_vendor and options @> '[{"demo": true}]';

  insert into products (vendor_id, name, description, price, original_price, category, preparation_time,
                        ingredients, allergens, health_tags, meal_times, is_popular, approval_status, options)
  values
  -- Healthy picks: details sheet + meal planner
  (v_vendor, 'Grilled Croaker & Vegetables', 'Whole grilled croaker fish with peppers, onions and steamed vegetables. Light, high in protein.',
   6500, null, 'Grilled & Fried', '30 min',
   array['croaker fish','bell pepper','onion','carrot','green beans','garlic','ginger','olive oil','salt'],
   array['contains_fish'], array['high_protein','low_carb','heart_healthy','grilled'], array['lunch','dinner'], true, 'approved', '[{"demo": true}]'),
  (v_vendor, 'Moi Moi with Egg', 'Steamed bean pudding with boiled egg. Rich in protein and fibre.',
   1800, null, 'Specials', '15 min',
   array['black-eyed beans','tatashe pepper','onion','boiled egg','crayfish','vegetable oil','salt'],
   array['contains_eggs','contains_shellfish'], array['high_protein','fibre_rich'], array['breakfast','lunch'], false, 'approved', '[{"demo": true}]'),
  (v_vendor, 'Oat Pap with Fruits', 'Warm oat porridge with banana, apple and a spoon of milk. A gentle start to the day.',
   1500, null, 'Specials', '10 min',
   array['oats','banana','apple','milk','cinnamon'],
   array['contains_dairy','contains_gluten'], array['fibre_rich','whole_grain','low_sodium'], array['breakfast'], false, 'approved', '[{"demo": true}]'),
  (v_vendor, 'Efo Riro with Brown Rice', 'Spinach cooked in a peppery base with assorted meat, served with brown rice.',
   4200, 4800, 'Rice Dishes', '25 min',
   array['brown rice','spinach','tatashe pepper','locust beans','assorted meat','palm oil','onion'],
   array[]::text[], array['vitamin_rich','iron_rich','fibre_rich'], array['lunch','dinner'], true, 'approved', '[{"demo": true}]'),
  (v_vendor, 'Chicken Pepper Soup', 'Light, hot pepper soup with tender chicken and scent leaves.',
   3500, null, 'Specials', '25 min',
   array['chicken','pepper soup spice','scotch bonnet pepper','scent leaf','onion','salt'],
   array[]::text[], array['high_protein','low_carb','spicy'], array['dinner'], false, 'approved', '[{"demo": true}]'),
  -- Triggers the diabetic warning ("sweet", "sugary")
  (v_vendor, 'Puff-Puff (10 pcs)', 'Sweet, sugary deep-fried dough balls. A Nigerian classic treat.',
   1200, null, 'Small Chops', '10 min',
   array['flour','sugar','yeast','vegetable oil','nutmeg'],
   array['contains_gluten'], array['high_sugar','fried'], array['snack'], true, 'approved', '[{"demo": true}]'),
  -- Triggers the nut allergy warning ("peanut")
  (v_vendor, 'Beef Suya with Peanut Spice', 'Spicy grilled beef suya coated in yaji peanut spice, with onions and tomato.',
   3000, null, 'Grilled & Fried', '20 min',
   array['beef','yaji spice','ground peanut','onion','tomato','cabbage'],
   array['contains_peanuts'], array['high_protein','spicy','grilled'], array['dinner','snack'], true, 'approved', '[{"demo": true}]'),
  (v_vendor, 'Jollof Rice & Grilled Chicken', 'Smoky party jollof rice with grilled chicken and plantain.',
   4500, null, 'Rice Dishes', '25 min',
   array['rice','tomato','tatashe pepper','onion','chicken','plantain','vegetable oil','curry powder','thyme'],
   array[]::text[], array['high_carb','spicy'], array['lunch','dinner'], true, 'approved', '[{"demo": true}]');

  raise notice 'Demo menu ready for vendor %', v_vendor;
end $$;
