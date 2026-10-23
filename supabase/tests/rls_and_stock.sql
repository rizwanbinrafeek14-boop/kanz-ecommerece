-- Behavioural tests. Run against a scratch database after migrations + seed.
-- Requires roles anon/authenticated and auth.uid() (Supabase provides these).
\set ON_ERROR_STOP off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); end $$;

reset role;
insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-0000000000a1','admin@test'),
  ('00000000-0000-0000-0000-0000000000c1','cust1@test'),
  ('00000000-0000-0000-0000-0000000000c2','cust2@test');
update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a1';

insert into products (id,slug,name_en,status,is_quote_only,base_price,category_id) values
  ('10000000-0000-0000-0000-000000000001','test-pipe','Test pipe','published',false,100,null),
  ('10000000-0000-0000-0000-000000000002','draft-pipe','Draft pipe','draft',true,null,null);
insert into product_variants (id,product_id,sku,size) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','T-1','2in');
insert into product_costs values ('10000000-0000-0000-0000-000000000001', 60);

-- stock in 10 via staff function
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select staff_stock_apply('20000000-0000-0000-0000-000000000001',(select id from warehouses where code='MAIN'),'stock_in',10,60,'test','PO-1');
reset role;

\echo '--- T1 anon sees only published products (expect 1)'
set role anon; select pg_temp.as_user(null);
select count(*) from products;
\echo '--- T2 anon cannot read costs (expect 0 rows)'
select count(*) from product_costs;
\echo '--- T3 anon cannot call stock_apply (expect permission denied)'
select stock_apply('20000000-0000-0000-0000-000000000001',(select id from warehouses where code='MAIN'),'stock_in',999);
\echo '--- T4 anon cannot place order (expect permission denied)'
select place_order('[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":1}]','pickup','bank_transfer');
reset role;

\echo '--- T5 customer cannot self-promote to admin (expect error)'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000c1';
select role from profiles where id='00000000-0000-0000-0000-0000000000c1';
\echo '--- T6 customer cannot read other profiles (expect 1)'
select count(*) from profiles;
\echo '--- T7 customer cannot read stock_levels/movements (expect 0,0)'
select (select count(*) from stock_levels), (select count(*) from stock_movements);

\echo '--- T8 place order qty 4 -> ok, price from DB, VAT 15%'
select place_order('[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":4}]','pickup','bank_transfer') as order_id \gset
select subtotal, vat_total, grand_total from orders where id = :'order_id';
\echo '--- T9 overselling blocked: qty 7 > available 6 (expect Insufficient stock)'
select place_order('[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":7}]','pickup','bank_transfer');
\echo '--- T10 cannot read cost snapshot (expect 0)'
select count(*) from order_item_costs;
\echo '--- T11 customer cannot insert order directly (expect RLS error)'
insert into orders (vat_rate,subtotal,vat_total,grand_total,customer_name,customer_email) values (15,1,1,1,'x','x');
reset role;

\echo '--- T12 other customer cannot see the order (expect 0)'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2'); set role authenticated;
select count(*) from orders;
reset role;

\echo '--- T13 reserved=4, on_hand=10'
select on_hand, reserved from stock_levels;
\echo '--- T14 admin ships -> stock_out, reserved=0, on_hand=6'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select admin_set_order_status(:'order_id','shipped','dispatched');
reset role;
select on_hand, reserved from stock_levels;
\echo '--- T15 cancel second order releases stock'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select place_order('[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":2}]','pickup','bank_transfer') as o2 \gset
reset role;
select on_hand, reserved from stock_levels;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select admin_set_order_status(:'o2','cancelled');
reset role;
select on_hand, reserved from stock_levels;
\echo '--- T16 invoice issued, then immutable'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select admin_issue_invoice(:'order_id') as inv \gset
update invoices set grand_total = 1 where id = :'inv';
reset role;
\echo '--- T17 guest RFQ submit + staff quote + convert'
set role anon; select pg_temp.as_user(null);
select * from submit_rfq('{"name":"Ali","email":"ali@x.com","company":"ACME"}','[{"description":"2in SCH40 pipe","quantity":50}]');
select count(*) from rfqs;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select id as rfq from rfqs limit 1 \gset
select id as li from rfq_items limit 1 \gset
select admin_save_quotation(:'rfq', jsonb_build_array(jsonb_build_object('id', :'li', 'unit_price', 20)), current_date+14, '2 weeks', '30 days', 'Ex-works', 'ok');
select status, quoted_subtotal, quoted_vat, quoted_total from rfqs;
select admin_convert_rfq(:'rfq') is not null as converted;
select status from rfqs;
reset role;
\echo '--- T18 invalid RFQ email rejected'
set role anon; select submit_rfq('{"name":"x","email":"bad"}','[{"description":"a","quantity":1}]');
reset role;
\echo '--- T19 tracking increments view count & banner counters'
set role anon; select track_event('product_view','sess1','/p/test-pipe','10000000-0000-0000-0000-000000000001');
reset role; select view_count from products where id='10000000-0000-0000-0000-000000000001';
\echo '--- T20 dashboard'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select admin_dashboard();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select admin_dashboard();

\echo '--- T21 search/filter/facets (anon)'
reset role;
insert into attribute_defs (key,name_en) values ('size_t','Size T') on conflict do nothing;
insert into product_attribute_values (product_id, attribute_id, value_en) select '10000000-0000-0000-0000-000000000001', id, '2in' from attribute_defs where key='size_t';
set role anon; select pg_temp.as_user(null);
select count(*) as found_by_name from search_products('test');
select count(*) as filter_match from search_products(null,null,'{"size_t":["2in"]}');
select count(*) as filter_nomatch from search_products(null,null,'{"size_t":["9in"]}');
select count(*) as draft_hidden from search_products('draft');
select * from product_facets();
select kind, name_en from search_suggestions('te');
select product_display_price('10000000-0000-0000-0000-000000000001') as price;
reset role;
