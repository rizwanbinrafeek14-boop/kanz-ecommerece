-- Business logic (RPC) + Row Level Security + storage policies

-- ───────── Lock down internal functions ─────────
revoke all on function stock_apply(uuid,uuid,stock_movement_type,numeric,numeric,text,text) from public, anon, authenticated;
revoke all on function staff_stock_apply(uuid,uuid,stock_movement_type,numeric,numeric,text,text) from public, anon;
grant execute on function staff_stock_apply(uuid,uuid,stock_movement_type,numeric,numeric,text,text) to authenticated;

-- ───────── Server-side price calculation + order placement ─────────
-- p_items: [{"variant_id": "...", "quantity": 3}, ...]  Prices ALWAYS come from the database, never from the client.
create or replace function place_order(
  p_items jsonb, p_delivery delivery_method, p_payment payment_method,
  p_address jsonb default null, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prof profiles%rowtype;
  usr_email text;
  vat numeric := setting_numeric('public.vat_rate', 15);
  it jsonb; vr record; qty numeric; price numeric; wh record; sub numeric := 0;
  oid uuid; oitem uuid; onum text; cost numeric; reserved_ok boolean;
begin
  if uid is null then raise exception 'Please sign in to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'Too many line items; please submit an RFQ'; end if;
  if p_delivery = 'delivery' and (p_address is null or coalesce(p_address->>'line1','') = '' or coalesce(p_address->>'city','') = '') then
    raise exception 'Delivery address is required';
  end if;
  if p_payment in ('card','mada','apple_pay','stc_pay') then raise exception 'Online payment gateway is not enabled yet'; end if;
  -- Admin-controlled checkout options (Content & settings). Defaults: delivery + pickup + bank transfer allowed.
  if not coalesce((select (value ->> p_delivery::text)::boolean from site_settings where key = 'public.delivery_options'), true) then raise exception 'This delivery option is not available'; end if;
  if not coalesce((select (value ->> p_payment::text)::boolean from site_settings where key = 'public.payment_methods'), p_payment = 'bank_transfer') then raise exception 'This payment method is not available'; end if;

  select * into prof from profiles where id = uid and is_active;
  if not found then raise exception 'Account not active'; end if;
  select email into usr_email from auth.users where id = uid;

  insert into orders (user_id, payment_method, delivery_method, vat_rate, subtotal, vat_total, grand_total,
                      customer_name, customer_email, customer_phone, company_name, customer_vat_number, shipping_address, notes)
  values (uid, p_payment, p_delivery, vat, 0, 0, 0,
          coalesce(prof.full_name, usr_email), usr_email, prof.phone, prof.company_name, prof.vat_number, p_address, left(p_notes, 2000))
  returning id, order_number into oid, onum;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it->>'quantity')::numeric;
    if qty is null or qty <= 0 or qty > 1000000 then raise exception 'Invalid quantity'; end if;
    select v.*, p.name_en pname_en, p.name_ar pname_ar, p.base_price, p.is_quote_only, p.status pstatus, p.min_order_qty, p.id pid
      into vr from product_variants v join products p on p.id = v.product_id
     where v.id = (it->>'variant_id')::uuid;
    if not found or not vr.is_active or vr.pstatus <> 'published' then raise exception 'Item is not available'; end if;
    if vr.is_quote_only then raise exception 'Item % is quote-only; please submit an RFQ', vr.sku; end if;
    if qty < vr.min_order_qty then raise exception 'Minimum order quantity for % is %', vr.sku, vr.min_order_qty; end if;
    price := coalesce(vr.price, vr.base_price);
    if price is null then raise exception 'Item % has no price; please submit an RFQ', vr.sku; end if;

    reserved_ok := false;
    for wh in select w.id from warehouses w
              join stock_levels s on s.warehouse_id = w.id and s.variant_id = vr.id
              where w.is_active and s.on_hand - s.reserved >= qty
              order by w.is_default desc, w.code loop
      perform stock_apply(vr.id, wh.id, 'reserve', qty, null, 'Order reservation', onum);
      reserved_ok := true; exit;
    end loop;
    if not reserved_ok then raise exception 'Insufficient stock for %', vr.sku; end if;

    insert into order_items (order_id, product_id, variant_id, sku, name_en, name_ar, spec_summary, quantity, unit_price, line_total)
    values (oid, vr.pid, vr.id, vr.sku, vr.pname_en, vr.pname_ar,
            nullif(concat_ws(' / ', vr.size, vr.grade, vr.schedule, vr.pressure_class), ''), qty, price, round(price * qty, 2))
    returning id into oitem;
    select coalesce(nullif(max(avg_cost),0), (select purchase_cost from variant_costs where variant_id = vr.id)) into cost from stock_levels where variant_id = vr.id;
    if cost is not null then insert into order_item_costs values (oitem, cost); end if;
    sub := sub + round(price * qty, 2);
  end loop;

  update orders set subtotal = sub, vat_total = round(sub * vat / 100, 2), grand_total = sub + round(sub * vat / 100, 2) where id = oid;
  insert into order_status_history (order_id, status, note) values (oid, 'pending', 'Order placed');
  return oid;
end $$;
revoke all on function place_order(jsonb,delivery_method,payment_method,jsonb,text) from public, anon;
grant execute on function place_order(jsonb,delivery_method,payment_method,jsonb,text) to authenticated;

-- Staff: change order status; handles stock release on cancel and stock-out on dispatch.
create or replace function admin_set_order_status(p_order uuid, p_status order_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; r record;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;

  if p_status in ('cancelled','refunded') and not o.stock_fulfilled then
    for r in select variant_id, warehouse_id,
                    sum(case type when 'reserve' then quantity else -quantity end) net
             from stock_movements where reference = o.order_number and type in ('reserve','release')
             group by variant_id, warehouse_id having sum(case type when 'reserve' then quantity else -quantity end) > 0 loop
      perform stock_apply(r.variant_id, r.warehouse_id, 'release', r.net, null, 'Order '||p_status, o.order_number);
    end loop;
  elsif p_status in ('shipped','ready_for_pickup','delivered','completed') and not o.stock_fulfilled then
    for r in select variant_id, warehouse_id,
                    sum(case type when 'reserve' then quantity else -quantity end) net
             from stock_movements where reference = o.order_number and type in ('reserve','release')
             group by variant_id, warehouse_id having sum(case type when 'reserve' then quantity else -quantity end) > 0 loop
      perform stock_apply(r.variant_id, r.warehouse_id, 'release', r.net, null, 'Fulfilment', o.order_number);
      perform stock_apply(r.variant_id, r.warehouse_id, 'stock_out', r.net, null, 'Sold', o.order_number);
    end loop;
    update orders set stock_fulfilled = true where id = p_order;
  end if;

  update orders set status = p_status where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by) values (p_order, p_status, p_note, auth.uid());
end $$;
revoke all on function admin_set_order_status(uuid,order_status,text) from public, anon;
grant execute on function admin_set_order_status(uuid,order_status,text) to authenticated;

-- Staff: record a payment and refresh payment_status.
create or replace function admin_record_payment(p_order uuid, p_method payment_method, p_amount numeric, p_reference text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; paid numeric;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  insert into payments (order_id, method, amount, gateway_reference, note, recorded_by) values (p_order, p_method, p_amount, p_reference, p_note, auth.uid());
  select coalesce(sum(amount),0) into paid from payments where order_id = p_order and status = 'paid';
  update orders set amount_paid = paid,
    payment_status = case when paid >= grand_total then 'paid' when paid > 0 then 'partially_paid' else payment_status end
  where id = p_order;
end $$;
revoke all on function admin_record_payment(uuid,payment_method,numeric,text,text) from public, anon;
grant execute on function admin_record_payment(uuid,payment_method,numeric,text,text) to authenticated;

-- Staff: issue VAT invoice for an order (immutable once issued).
create or replace function admin_issue_invoice(p_order uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; inv uuid; seller jsonb;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into o from orders where id = p_order;
  if not found then raise exception 'Order not found'; end if;
  select id into inv from invoices where order_id = p_order limit 1;
  if inv is not null then return inv; end if;
  select coalesce(jsonb_object_agg(replace(key,'public.',''), value), '{}') into seller from site_settings where key like 'public.company_%' or key = 'public.vat_number';
  insert into invoices (order_id, seller_snapshot, buyer_snapshot, vat_rate, subtotal, vat_total, grand_total, created_by)
  values (p_order, seller,
          jsonb_build_object('name', coalesce(o.company_name, o.customer_name), 'contact', o.customer_name, 'email', o.customer_email, 'vat_number', o.customer_vat_number, 'address', o.shipping_address),
          o.vat_rate, o.subtotal, o.vat_total, o.grand_total, auth.uid())
  returning id into inv;
  return inv;
end $$;
revoke all on function admin_issue_invoice(uuid) from public, anon;
grant execute on function admin_issue_invoice(uuid) to authenticated;

-- ───────── RFQ ─────────
-- Anyone (guest or signed-in) may submit. Inputs are validated here; no direct table insert is allowed.
create or replace function submit_rfq(p_contact jsonb, p_items jsonb) returns table (rfq_number text, access_token uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r_id uuid; r_num text; r_tok uuid; it jsonb; n int := 0;
begin
  if coalesce(trim(p_contact->>'name'),'') = '' or coalesce(trim(p_contact->>'email'),'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Name and a valid email are required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'Too many line items (max 200)'; end if;
  -- Spam protection for the public form: per-email and global hourly limits.
  if (select count(*) from rfqs where lower(contact_email) = lower(p_contact->>'email') and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests from this email address. Please try again later or contact us on WhatsApp.';
  end if;
  if (select count(*) from rfqs where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'We are receiving a very high number of requests. Please try again shortly.';
  end if;

  insert into rfqs (user_id, contact_name, contact_email, contact_phone, company_name, vat_number, delivery_city, required_by, customer_notes)
  values (auth.uid(), left(p_contact->>'name',200), left(p_contact->>'email',200), left(p_contact->>'phone',50), left(p_contact->>'company',200),
          left(p_contact->>'vat_number',50), left(p_contact->>'city',100), nullif(p_contact->>'required_by','')::date, left(p_contact->>'notes',4000))
  returning id, rfqs.rfq_number, rfqs.access_token into r_id, r_num, r_tok;

  for it in select * from jsonb_array_elements(p_items) loop
    n := n + 1;
    if coalesce(trim(it->>'description'),'') = '' or coalesce((it->>'quantity')::numeric,0) <= 0 then raise exception 'Line % is incomplete', n; end if;
    insert into rfq_items (rfq_id, line_no, product_id, variant_id, description, specification, quantity, unit)
    values (r_id, n, nullif(it->>'product_id','')::uuid, nullif(it->>'variant_id','')::uuid,
            left(it->>'description',500), left(it->>'specification',500), (it->>'quantity')::numeric, coalesce(nullif(left(it->>'unit',20),''),'pcs'));
  end loop;
  insert into rfq_events (rfq_id, event, detail) values (r_id, 'submitted', n || ' line item(s)');
  insert into analytics_events (event, session_id, path) values ('rfq_submit', coalesce(p_contact->>'session_id','unknown'), '/rfq');
  return query select r_num, r_tok;
end $$;
grant execute on function submit_rfq(jsonb,jsonb) to anon, authenticated;

-- Guests view their quotation through the emailed token link.
create or replace function get_rfq_by_token(p_token uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rfq', to_jsonb(r) - 'user_id' - 'access_token',
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.line_no) from rfq_items i where i.rfq_id = r.id), '[]'))
  from rfqs r where r.access_token = p_token
$$;
grant execute on function get_rfq_by_token(uuid) to anon, authenticated;

-- Staff: save quoted prices and mark as quoted. p_lines: [{"id": "...", "unit_price": 12.5, "lead_time": "2 weeks"}]
create or replace function admin_save_quotation(
  p_rfq uuid, p_lines jsonb, p_valid_until date, p_lead_time text, p_payment_terms text, p_delivery_terms text, p_notes text, p_mark_quoted boolean default true
) returns void language plpgsql security definer set search_path = public as $$
declare l jsonb; vat numeric := setting_numeric('public.vat_rate', 15); sub numeric;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    update rfq_items set quoted_unit_price = nullif(l->>'unit_price','')::numeric, quoted_lead_time = nullif(l->>'lead_time','')
    where id = (l->>'id')::uuid and rfq_id = p_rfq;
  end loop;
  select coalesce(sum(round(quoted_unit_price * quantity, 2)),0) into sub from rfq_items where rfq_id = p_rfq and quoted_unit_price is not null;
  update rfqs set quote_valid_until = p_valid_until, lead_time = p_lead_time, payment_terms = p_payment_terms, delivery_terms = p_delivery_terms,
         quote_notes = p_notes, vat_rate = vat, quoted_subtotal = sub, quoted_vat = round(sub * vat / 100, 2), quoted_total = sub + round(sub * vat / 100, 2),
         quoted_at = case when p_mark_quoted then now() else quoted_at end, quoted_by = auth.uid(),
         status = case when p_mark_quoted and status in ('submitted','under_review') then 'quoted' else status end
  where id = p_rfq;
  insert into rfq_events (rfq_id, event, detail, actor) values (p_rfq, case when p_mark_quoted then 'quoted' else 'price_updated' end, 'Subtotal SAR ' || sub, auth.uid());
end $$;
revoke all on function admin_save_quotation(uuid,jsonb,date,text,text,text,text,boolean) from public, anon;
grant execute on function admin_save_quotation(uuid,jsonb,date,text,text,text,text,boolean) to authenticated;

-- Staff: convert an accepted quotation to an order (no automatic stock reservation: RFQ items are often made-to-order).
create or replace function admin_convert_rfq(p_rfq uuid, p_delivery delivery_method default 'delivery') returns uuid
language plpgsql security definer set search_path = public as $$
declare r rfqs%rowtype; oid uuid; it record; vat numeric;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into r from rfqs where id = p_rfq for update;
  if not found then raise exception 'RFQ not found'; end if;
  if r.status not in ('quoted','accepted') then raise exception 'Only quoted or accepted quotations can be converted'; end if;
  if exists (select 1 from rfq_items where rfq_id = p_rfq and quoted_unit_price is null) then raise exception 'All lines need a quoted price'; end if;
  vat := coalesce(r.vat_rate, setting_numeric('public.vat_rate', 15));
  insert into orders (user_id, rfq_id, vat_rate, subtotal, vat_total, grand_total, customer_name, customer_email, customer_phone, company_name, customer_vat_number, delivery_method, notes, payment_method)
  values (r.user_id, r.id, vat, r.quoted_subtotal, r.quoted_vat, r.quoted_total, r.contact_name, r.contact_email, r.contact_phone, r.company_name, r.vat_number, p_delivery, 'From quotation ' || r.rfq_number, 'bank_transfer')
  returning id into oid;
  for it in select * from rfq_items where rfq_id = p_rfq order by line_no loop
    insert into order_items (order_id, product_id, variant_id, name_en, spec_summary, quantity, unit_price, line_total)
    values (oid, it.product_id, it.variant_id, it.description, it.specification, it.quantity, it.quoted_unit_price, round(it.quoted_unit_price * it.quantity, 2));
  end loop;
  update rfqs set status = 'converted', converted_order_id = oid where id = p_rfq;
  insert into rfq_events (rfq_id, event, detail, actor) values (p_rfq, 'converted', 'Order created', auth.uid());
  insert into order_status_history (order_id, status, note, changed_by) values (oid, 'pending', 'Converted from ' || r.rfq_number, auth.uid());
  return oid;
end $$;
revoke all on function admin_convert_rfq(uuid,delivery_method) from public, anon;
grant execute on function admin_convert_rfq(uuid,delivery_method) to authenticated;

-- ───────── Analytics ─────────
create or replace function track_event(p_event text, p_session text, p_path text default null, p_product uuid default null, p_banner uuid default null, p_query text default null, p_lang text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event not in ('page_view','product_view','search','banner_impression','banner_click','add_to_cart','whatsapp_click') then return; end if;
  if p_session is null or length(p_session) > 64 then return; end if;
  insert into analytics_events (event, session_id, path, product_id, banner_id, query, lang)
  values (p_event, p_session, left(p_path, 300), p_product, p_banner, left(p_query, 200), left(p_lang, 5));
  if p_event = 'product_view' and p_product is not null then update products set view_count = view_count + 1 where id = p_product; end if;
  if p_event = 'banner_impression' and p_banner is not null then update banners set impressions = impressions + 1 where id = p_banner; end if;
  if p_event = 'banner_click' and p_banner is not null then update banners set clicks = clicks + 1 where id = p_banner; end if;
end $$;
grant execute on function track_event(text,text,text,uuid,uuid,text,text) to anon, authenticated;

-- Best sellers for the storefront (counts only; no revenue exposed)
create or replace function public_best_sellers(p_limit int default 8) returns table (product_id uuid, units numeric)
language sql stable security definer set search_path = public as $$
  select oi.product_id, sum(oi.quantity) units
  from order_items oi join orders o on o.id = oi.order_id
  where o.status not in ('cancelled','refunded') and oi.product_id is not null
  group by oi.product_id order by units desc limit p_limit
$$;
grant execute on function public_best_sellers(int) to anon, authenticated;

-- Admin dashboard: every figure comes from real rows.
create or replace function admin_dashboard() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select jsonb_build_object(
    'revenue_total',   coalesce((select sum(grand_total) from orders where status not in ('cancelled','refunded')),0),
    'sales_today',     coalesce((select sum(grand_total) from orders where status not in ('cancelled','refunded') and created_at >= date_trunc('day', now())),0),
    'sales_month',     coalesce((select sum(grand_total) from orders where status not in ('cancelled','refunded') and created_at >= date_trunc('month', now())),0),
    'products_total',  (select count(*) from products where status <> 'archived'),
    'products_published', (select count(*) from products where status = 'published'),
    'orders_total',    (select count(*) from orders),
    'orders_pending',  (select count(*) from orders where status in ('pending','confirmed','processing')),
    'rfq_pending',     (select count(*) from rfqs where status in ('submitted','under_review')),
    'low_stock',       (select count(*) from (select variant_id from stock_levels group by variant_id having sum(on_hand - reserved) <= max(reorder_level)) x),
    'visitors_30d',    (select count(distinct session_id) from analytics_events where created_at >= now() - interval '30 days'),
    'visitors_today',  (select count(distinct session_id) from analytics_events where created_at >= date_trunc('day', now())),
    'inventory_value', coalesce((select sum(on_hand * avg_cost) from stock_levels),0)
  ) into res;
  return res;
end $$;
revoke all on function admin_dashboard() from public, anon;
grant execute on function admin_dashboard() to authenticated;

create or replace function admin_sales_by_day(p_days int default 30) returns table (day date, orders bigint, revenue numeric)
language sql stable security definer set search_path = public as $$
  select d::date, count(o.id), coalesce(sum(o.grand_total),0)
  from generate_series(current_date - (least(p_days,366) - 1), current_date, interval '1 day') d
  left join orders o on o.created_at::date = d::date and o.status not in ('cancelled','refunded')
  where is_staff() group by d order by d
$$;
revoke all on function admin_sales_by_day(int) from public, anon;
grant execute on function admin_sales_by_day(int) to authenticated;

create or replace function admin_top_products(p_limit int default 10) returns table (kind text, product_id uuid, name text, value numeric)
language sql stable security definer set search_path = public as $$
  (select 'viewed', p.id, p.name_en, p.view_count::numeric from products p where is_staff() order by p.view_count desc limit p_limit)
  union all
  (select 'sold', oi.product_id, max(oi.name_en), sum(oi.quantity)
     from order_items oi join orders o on o.id = oi.order_id
    where is_staff() and o.status not in ('cancelled','refunded') and oi.product_id is not null
    group by oi.product_id order by sum(oi.quantity) desc limit p_limit)
$$;
revoke all on function admin_top_products(int) from public, anon;
grant execute on function admin_top_products(int) to authenticated;

-- ───────── Row Level Security ─────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- helper macro: public read / staff write
create or replace function _rls_public_read_staff_write(t text, public_using text default 'true') returns void language plpgsql as $$
begin
  execute format('create policy "%1$s public read" on %1$I for select using (%2$s or is_staff())', t, public_using);
  execute format('create policy "%1$s staff insert" on %1$I for insert with check (is_staff())', t);
  execute format('create policy "%1$s staff update" on %1$I for update using (is_staff()) with check (is_staff())', t);
  execute format('create policy "%1$s admin delete" on %1$I for delete using (is_admin())', t);
end $$;

select _rls_public_read_staff_write('categories', 'is_active');
select _rls_public_read_staff_write('brands', 'is_active');
select _rls_public_read_staff_write('attribute_defs');
select _rls_public_read_staff_write('products', $$status = 'published'$$);
select _rls_public_read_staff_write('product_images', $$exists (select 1 from products p where p.id = product_id and p.status = 'published')$$);
select _rls_public_read_staff_write('product_documents', $$is_public and exists (select 1 from products p where p.id = product_id and p.status = 'published')$$);
select _rls_public_read_staff_write('product_attribute_values', $$exists (select 1 from products p where p.id = product_id and p.status = 'published')$$);
select _rls_public_read_staff_write('product_variants', $$is_active and exists (select 1 from products p where p.id = product_id and p.status = 'published')$$);
select _rls_public_read_staff_write('product_relations', $$exists (select 1 from products p where p.id = product_id and p.status = 'published')$$);
select _rls_public_read_staff_write('banners', $$is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())$$);
select _rls_public_read_staff_write('homepage_sections', 'is_enabled');
select _rls_public_read_staff_write('announcements', $$is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())$$);
select _rls_public_read_staff_write('menu_links', 'is_active');
select _rls_public_read_staff_write('site_settings', $$key like 'public.%'$$);
drop function _rls_public_read_staff_write(text, text);

-- Staff may delete DRAFT products (e.g. a failed import); deleting live/archived products needs an admin.
drop policy "products admin delete" on products;
create policy "products delete" on products for delete using (is_admin() or (is_staff() and status = 'draft'));

-- Site settings (VAT rate, company details, SEO) are admin-only to change.
drop policy "site_settings staff insert" on site_settings;
drop policy "site_settings staff update" on site_settings;
create policy "site_settings admin insert" on site_settings for insert with check (is_admin());
create policy "site_settings admin update" on site_settings for update using (is_admin()) with check (is_admin());

-- staff-only tables
do $$ declare t text; begin
  foreach t in array array['product_costs','variant_costs','warehouses','stock_levels','stock_movements','order_item_costs','internal_notes','import_batches','import_items','analytics_events'] loop
    execute format('create policy "%1$s staff all" on %1$I for all using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;
-- stock_movements/analytics are append-only for staff via RPC; no client updates needed
drop policy "stock_movements staff all" on stock_movements;
create policy "stock_movements staff read" on stock_movements for select using (is_staff());
drop policy "analytics_events staff all" on analytics_events;
create policy "analytics_events staff read" on analytics_events for select using (is_staff());
-- warehouses are readable by staff only; deletes by admin
drop policy "warehouses staff all" on warehouses;
create policy "warehouses staff read" on warehouses for select using (is_staff());
create policy "warehouses admin write" on warehouses for all using (is_admin()) with check (is_admin());

create policy "audit staff read" on audit_log for select using (is_staff());
create policy "audit staff insert" on audit_log for insert with check (is_staff() and actor = auth.uid());

-- profiles
create policy "profiles own read" on profiles for select using (id = auth.uid() or is_staff());
create policy "profiles own update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin update" on profiles for update using (is_admin()) with check (is_admin());

-- addresses
create policy "addresses own all" on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "addresses staff read" on addresses for select using (is_staff());

-- orders & children: customers read their own; staff manage. Orders are created ONLY through place_order()/admin_convert_rfq().
create policy "orders own read" on orders for select using (user_id = auth.uid() or is_staff());
create policy "orders staff update" on orders for update using (is_staff()) with check (is_staff());
create policy "order_items read" on order_items for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));
create policy "order_items staff write" on order_items for all using (is_staff()) with check (is_staff());
create policy "order_history read" on order_status_history for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));
create policy "payments read" on payments for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));
create policy "shipments read" on shipments for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));
create policy "shipments staff write" on shipments for all using (is_staff()) with check (is_staff());
create policy "invoices read" on invoices for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));

-- RFQs
create policy "rfqs own read" on rfqs for select using (user_id = auth.uid() or is_staff());
create policy "rfqs staff update" on rfqs for update using (is_staff()) with check (is_staff());
create policy "rfq_items read" on rfq_items for select using (exists (select 1 from rfqs r where r.id = rfq_id and (r.user_id = auth.uid() or is_staff())));
create policy "rfq_items staff write" on rfq_items for all using (is_staff()) with check (is_staff());
create policy "rfq_events read" on rfq_events for select using (exists (select 1 from rfqs r where r.id = rfq_id and (r.user_id = auth.uid() or is_staff())));
create policy "rfq_events staff insert" on rfq_events for insert with check (is_staff());
create policy "rfq_attach read" on rfq_attachments for select using (exists (select 1 from rfqs r where r.id = rfq_id and (r.user_id = auth.uid() or is_staff())));
create policy "rfq_attach staff write" on rfq_attachments for all using (is_staff()) with check (is_staff());

-- Availability view is intentionally public (numbers only).
grant select on variant_availability to anon, authenticated;

-- ───────── Storage buckets & policies ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images','product-images',true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('banners','banners',true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('brand-logos','brand-logos',true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('category-images','category-images',true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('product-docs','product-docs',true, 26214400, array['application/pdf','image/jpeg','image/png']),
  ('product-mtc','product-mtc',false, 26214400, array['application/pdf','image/jpeg','image/png']),
  ('import-staging','import-staging',false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('rfq-attachments','rfq-attachments',false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "public buckets staff write" on storage.objects for all
  using (bucket_id in ('product-images','banners','brand-logos','category-images','product-docs','product-mtc','import-staging','rfq-attachments') and is_staff())
  with check (bucket_id in ('product-images','banners','brand-logos','category-images','product-docs','product-mtc','import-staging','rfq-attachments') and is_staff());
-- Public buckets serve files by URL; list access is not granted to anon.
create policy "import staging staff read" on storage.objects for select using (bucket_id in ('import-staging','product-mtc') and is_staff());
create policy "rfq attachments upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'rfq-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "rfq attachments read own" on storage.objects for select to authenticated
  using (bucket_id = 'rfq-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
