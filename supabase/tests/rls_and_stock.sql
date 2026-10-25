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

\echo '--- T22 customer accepts a quotation by token; cannot respond twice or to an unquoted RFQ'
reset role;
insert into rfqs (contact_name, contact_email, status, quoted_at, quote_valid_until, vat_rate, quoted_subtotal, quoted_vat, quoted_total) values ('Z','z@z.com','quoted', now(), current_date + 5, 15, 100, 15, 115);
select access_token as tok from rfqs where contact_name = 'Z' \gset
set role anon; select pg_temp.as_user(null);
select respond_rfq(:'tok', true) as accepted;
select respond_rfq(:'tok', false);
reset role; select status from rfqs where contact_name = 'Z';

\echo '--- T23 reports (staff ok, customer/anon get no rows)'
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select count(*) > 0 as sales_rows from admin_sales_report(current_date - 30, current_date, 'day');
select name, units, revenue, cost, profit from admin_sales_by_product(current_date - 30, current_date);
select status, n from admin_rfq_funnel(current_date - 30, current_date) order by 1;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select count(*) as customer_sees from admin_sales_report(current_date - 30, current_date, 'day');
reset role; set role anon; select pg_temp.as_user(null);
select count(*) from admin_traffic(current_date, current_date);
reset role;

\echo '--- T24 storage policies: anon/customer cannot write; staff can; customer limited to own rfq-attachments folder'
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('product-images', 'staff/ok.jpg');
reset role; set role anon; select pg_temp.as_user(null);
insert into storage.objects (bucket_id, name) values ('product-images', 'anon/evil.jpg');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('banners', 'cust/evil.jpg');
insert into storage.objects (bucket_id, name) values ('rfq-attachments', '00000000-0000-0000-0000-0000000000c1/mine.pdf');
insert into storage.objects (bucket_id, name) values ('rfq-attachments', '00000000-0000-0000-0000-0000000000c2/theirs.pdf');
select count(*) as visible_to_cust1 from storage.objects where bucket_id = 'rfq-attachments';
reset role;

\echo '--- T25 RFQ spam throttle: 6th request from one email in an hour is refused'
set role anon; select pg_temp.as_user(null);
select count(*) from (select submit_rfq('{"name":"S","email":"spam@x.com"}','[{"description":"a","quantity":1}]') from generate_series(1,5)) x;
select submit_rfq('{"name":"S","email":"spam@x.com"}','[{"description":"a","quantity":1}]');
reset role;

\echo '--- T26 contact widget / social links / certifications access'
reset role;
insert into social_links (platform, name, url, accessible_label, is_active) values ('instagram','Insta','https://instagram.com/kanz','Instagram',true), ('facebook','FB','https://facebook.com/kanz','Facebook',false);
insert into certifications (name_en, is_active) values ('Active cert', true), ('Hidden cert', false), ('Expired cert', true);
update certifications set valid_until = current_date - 1 where name_en = 'Expired cert';
set role anon; select pg_temp.as_user(null);
select count(*) as anon_sees_active_links from social_links;
select name_en from certifications order by 1;
insert into social_links (platform, name, url, accessible_label) values ('custom','x','https://evil.example','x');
update contact_widget set whatsapp_number = '999999999';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
update contact_widget set whatsapp_number = '999999999';
insert into social_links (platform, name, url, accessible_label) values ('custom','x','https://evil.example','x');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
update contact_widget set whatsapp_number = '966507264938', position = 'left' returning whatsapp_number, position;
insert into social_links (platform, name, url, accessible_label) values ('custom','bad','http://insecure.example','x');
insert into social_links (platform, name, url, accessible_label) values ('custom','bad','javascript:alert(1)','x');
update contact_widget set whatsapp_number = '+966 50';
reset role;

\echo '--- T27 certifications: admin-only management, only live + verified approvals are public'
reset role;
insert into certifications (id, name_en, is_active, scope) values
  ('30000000-0000-0000-0000-000000000001','Live cert',true,'company'),
  ('30000000-0000-0000-0000-000000000002','Unpublished cert',false,'company'),
  ('30000000-0000-0000-0000-000000000003','Future cert',true,'company');
update certifications set valid_until = current_date - 1 where name_en = 'Expired cert';
update certifications set issued_at = current_date + 30 where name_en = 'Future cert';
insert into product_certifications (product_id, certification_id, status) values
  ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','verified'),
  ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','pending'),
  ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','verified');
set role anon; select pg_temp.as_user(null);
select name_en as anon_visible_certs from certifications where name_en in ('Live cert','Unpublished cert','Future cert','Expired cert') order by 1;
select status as anon_visible_assignments from product_certifications;
insert into product_certifications (product_id, certification_id, status) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','verified');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
insert into certifications (name_en) values ('Customer cert');
update product_certifications set status = 'verified';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
update product_certifications set status = 'verified', reference_number = 'REF-1', variant_ids = array['20000000-0000-0000-0000-000000000001']::uuid[] where certification_id = '30000000-0000-0000-0000-000000000002' returning status, reference_number;
update product_certifications set status = 'bogus' where certification_id = '30000000-0000-0000-0000-000000000002';
update product_certifications set verification_url = 'http://insecure.example' where certification_id = '30000000-0000-0000-0000-000000000002';
update certifications set scope = 'galaxy' where name_en = 'Live cert';
delete from certifications where id = '30000000-0000-0000-0000-000000000002';
select count(*) as assignments_left_after_cert_delete from product_certifications where certification_id = '30000000-0000-0000-0000-000000000002';
reset role;

\echo '--- T28 SEO: slug-change redirects, extra measurement events'
reset role;
update products set slug = 'renamed-pipe' where slug = 'test-pipe';
update products set slug = 'renamed-pipe-2' where slug = 'renamed-pipe';
select old_slug, new_slug from slug_redirects where entity = 'product' order by old_slug;
update products set slug = 'test-pipe' where slug = 'renamed-pipe-2';
select count(*) as redirects_after_returning_to_original from slug_redirects where entity = 'product' and old_slug = 'test-pipe';
set role anon; select pg_temp.as_user(null);
select count(*) as anon_can_read_redirects from slug_redirects;
insert into slug_redirects (entity, old_slug, new_slug) values ('product', 'evil', 'x');
select track_event('phone_click', 'sess-1', '/en/contact', null, null, null, 'en');
select track_event('datasheet_download', 'sess-1', '/en/product/x', null, null, null, 'en');
select track_event('made_up_event', 'sess-1');
reset role;
select event, count(*) from analytics_events where session_id = 'sess-1' group by event order by 1;

\echo '--- T29 catalogue extraction: staff-only workspace, public option/dimension data only for published products'
reset role;
insert into catalogue_sources (id, title) values ('40000000-0000-0000-0000-000000000001', 'Test catalogue');
insert into extracted_products (source_id, data) values ('40000000-0000-0000-0000-000000000001', '{"name_en":"x"}');
insert into product_options (id, product_id, key, name_en) values
  ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','size','Size'),
  ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','size','Size');
insert into dimension_tables (id, product_id, title_en, columns) values
  ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Dims','[{"key":"A","unit":"mm"}]'),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Draft dims','[{"key":"A","unit":"mm"}]');
insert into dimension_rows (table_id, match, "values") values ('60000000-0000-0000-0000-000000000001','{"size":"2in"}','{"A":"38"}'), ('60000000-0000-0000-0000-000000000002','{"size":"2in"}','{"A":"1"}');
set role anon; select pg_temp.as_user(null);
select count(*) as anon_sees_sources from catalogue_sources;
select count(*) as anon_sees_extracted from extracted_products;
select count(*) as anon_sees_options from product_options;
select count(*) as anon_sees_dimension_rows from dimension_rows;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select count(*) as customer_sees_extracted from extracted_products;
insert into catalogue_sources (title) values ('hack');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select count(*) as admin_sees_extracted from extracted_products;
insert into product_variants (product_id, sku, options) values ('10000000-0000-0000-0000-000000000001','OPT-1','{"size":"2in"}');
insert into product_variants (product_id, sku, options) values ('10000000-0000-0000-0000-000000000001','OPT-2','{"size":"2in"}');
reset role;

\echo '--- T30 catalogue_import_product: approved only, atomic, creates draft with options/variants/dimensions'
reset role;
insert into extracted_products (id, source_id, data, status) values
  ('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','{}','pending'),
  ('41000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','{}','approved');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select catalogue_import_product('41000000-0000-0000-0000-000000000002', '{}');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select catalogue_import_product('41000000-0000-0000-0000-000000000001', '{}');
select catalogue_import_product('41000000-0000-0000-0000-000000000002', $j${
  "family": {"slug":"test-elbow-90","name_en":"90° Elbow","product_type":"elbow_90"},
  "product": {"slug":"test-maker-90-elbow","name_en":"TestMaker 90° Elbow","specs":{"standards":[{"code":"ASME B16.11","scope":"product"}]},"source_ref":{"pages":[3]}},
  "options": [{"key":"connection","name_en":"Connection","values":[{"value":"sw","label_en":"Socket weld"}]},{"key":"size","name_en":"Size","values":[{"value":"1/2","label_en":"1/2\""},{"value":"3/4","label_en":"3/4\""}]}],
  "variants": [{"sku":"TM-E90-SW-12","options":{"connection":"sw","size":"1/2"},"size":"1/2\"","manufacturer_code":"E90-12"},{"sku":"TM-E90-SW-34","options":{"connection":"sw","size":"3/4"},"size":"3/4\""}],
  "dimension_tables": [{"title_en":"Socket weld 3000","columns":[{"key":"A","label_en":"Centre to bottom","unit":"mm"}],"applies":{"connection":"sw"},"rows":[{"match":{"size":"1/2"},"values":{"A":"15.5"}},{"match":{"size":"3/4"},"values":{"A":"19.5"}}],"source_page":3}]
}$j$::jsonb) is not null as imported;
select p.status, p.is_quote_only, (select count(*) from product_variants v where v.product_id = p.id) variants, (select count(*) from product_options o where o.product_id = p.id) options,
  (select count(*) from dimension_rows r join dimension_tables t on t.id = r.table_id where t.product_id = p.id) dim_rows, f.slug family
from products p left join product_families f on f.id = p.family_id where p.slug = 'test-maker-90-elbow';
select status from extracted_products where id = '41000000-0000-0000-0000-000000000002';
reset role;
-- atomicity: a bad variant (duplicate SKU) must roll back the whole product
update extracted_products set status = 'approved' where id = '41000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select catalogue_import_product('41000000-0000-0000-0000-000000000001', '{"product":{"slug":"atomic-test","name_en":"Atomic"},"variants":[{"sku":"DUP-1"},{"sku":"DUP-1"}]}');
reset role;
select count(*) as atomic_rolled_back from products where slug = 'atomic-test';

\echo '--- T31 product families: draft families hidden, slug namespace shared with products, suggestions staff-only, rename keeps old address'
reset role;
insert into product_families (id, slug, name_en, status) values
  ('51000000-0000-0000-0000-000000000001','fam-published','Published family','published'),
  ('51000000-0000-0000-0000-000000000002','fam-draft','Draft family','draft');
set role anon; select pg_temp.as_user(null);
select string_agg(slug, ',' order by slug) as anon_sees_families from product_families where slug like 'fam-%';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
select count(*) as staff_sees_families from product_families where slug like 'fam-%';
insert into products (slug, name_en, status) values ('fam-published', 'Clash', 'draft');
reset role;
insert into product_families (slug, name_en) values ('test-maker-90-elbow', 'Clash with product');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set role authenticated;
select count(*) as customer_sees_suggestions from family_link_suggestions;
insert into family_link_suggestions (product_id, family_id, confidence) select id, '51000000-0000-0000-0000-000000000001', 'exact' from products limit 1;
reset role;
select family_link as default_family_link from products where slug = 'test-maker-90-elbow';
update product_families set slug = 'fam-published-renamed' where id = '51000000-0000-0000-0000-000000000001';
select new_slug as family_redirect from slug_redirects where entity = 'product' and old_slug = 'fam-published';

\echo '--- T32 listings: confirmed offerings of a published family count once; draft family or unconfirmed offering = separate entries'
reset role;
insert into product_families (id, slug, name_en, status) values ('52000000-0000-0000-0000-000000000001','fam-list','Listing family','published');
insert into products (id, slug, name_en, status, published_at, family_id, family_link) values
  ('52000000-0000-0000-0000-0000000000a1','fam-list-a','ZZList A','published',now(),'52000000-0000-0000-0000-000000000001','confirmed'),
  ('52000000-0000-0000-0000-0000000000a2','fam-list-b','ZZList B','published',now(),'52000000-0000-0000-0000-000000000001','confirmed'),
  ('52000000-0000-0000-0000-0000000000a3','fam-list-c','ZZList C','published',now(),'52000000-0000-0000-0000-000000000001','suggested');
set role anon; select pg_temp.as_user(null);
select count(*) as entries, max(total) as total, count(family_id) as family_rows from search_products('ZZList');
reset role;
update product_families set status = 'draft' where id = '52000000-0000-0000-0000-000000000001';
set role anon; select pg_temp.as_user(null);
select count(*) as entries_when_family_draft from search_products('ZZList');
reset role;
