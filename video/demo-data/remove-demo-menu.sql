-- Hides the demo store after recording. Dishes are deleted; the store is
-- unapproved so real customers can't see or order from it. The vendor and
-- customer accounts themselves are kept (delete them in the app if you want).
do $$
declare
  v_email text := 'demo.vendor@vesphe.app';   -- ← same email as in seed-demo-menu.sql
  v_vendor uuid;
begin
  select v.id into v_vendor
    from vendors v join users u on u.id = v.owner_id
   where lower(u.email) = lower(v_email);
  if v_vendor is null then
    raise notice 'No demo vendor found for %', v_email;
    return;
  end if;
  delete from products where vendor_id = v_vendor and options @> '[{"demo": true}]';
  update vendors set is_approved = false, is_open = false where id = v_vendor;
  raise notice 'Demo store hidden';
end $$;
