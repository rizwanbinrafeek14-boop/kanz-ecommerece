-- Reporting functions (staff only). Revenue excludes cancelled/refunded orders. All figures come from real rows.

create or replace function admin_sales_report(p_from date, p_to date, p_group text default 'day')
returns table (period date, orders bigint, subtotal numeric, vat numeric, total numeric, paid numeric)
language sql stable security definer set search_path = public as $$
  select date_trunc(case when p_group = 'month' then 'month' else 'day' end, o.created_at at time zone 'Asia/Riyadh')::date as period,
         count(*), coalesce(sum(o.subtotal),0), coalesce(sum(o.vat_total),0), coalesce(sum(o.grand_total),0), coalesce(sum(o.amount_paid),0)
  from orders o
  where is_staff() and o.status not in ('cancelled','refunded')
    and (o.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  group by 1 order by 1
$$;

create or replace function admin_sales_by_product(p_from date, p_to date, p_limit int default 50)
returns table (product_id uuid, name text, sku text, units numeric, revenue numeric, cost numeric, profit numeric)
language sql stable security definer set search_path = public as $$
  -- cost/profit are computed ONLY on lines whose purchase cost was known when the order was placed
  select oi.product_id, max(oi.name_en), max(oi.sku), sum(oi.quantity), sum(oi.line_total),
         coalesce(sum(c.unit_cost * oi.quantity), 0), coalesce(sum(oi.line_total - c.unit_cost * oi.quantity) filter (where c.unit_cost is not null), 0)
  from order_items oi join orders o on o.id = oi.order_id left join order_item_costs c on c.order_item_id = oi.id
  where is_staff() and o.status not in ('cancelled','refunded') and (o.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  group by oi.product_id order by sum(oi.line_total) desc limit least(p_limit, 500)
$$;

create or replace function admin_sales_by_category(p_from date, p_to date)
returns table (category text, units numeric, revenue numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(cat.name_en, 'Uncategorised'), sum(oi.quantity), sum(oi.line_total)
  from order_items oi join orders o on o.id = oi.order_id
  left join products p on p.id = oi.product_id left join categories cat on cat.id = p.category_id
  where is_staff() and o.status not in ('cancelled','refunded') and (o.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  group by 1 order by 3 desc
$$;

create or replace function admin_traffic(p_from date, p_to date)
returns table (day date, visitors bigint, page_views bigint, product_views bigint, searches bigint, whatsapp_clicks bigint, rfq_submits bigint)
language sql stable security definer set search_path = public as $$
  select d::date,
    count(distinct e.session_id) filter (where e.event is not null), count(*) filter (where e.event = 'page_view'), count(*) filter (where e.event = 'product_view'),
    count(*) filter (where e.event = 'search'), count(*) filter (where e.event = 'whatsapp_click'), count(*) filter (where e.event = 'rfq_submit')
  from generate_series(p_from, p_to, interval '1 day') d
  left join analytics_events e on (e.created_at at time zone 'Asia/Riyadh')::date = d::date
  where is_staff() group by d order by d
$$;

create or replace function admin_top_searches(p_from date, p_to date, p_limit int default 20)
returns table (query text, n bigint) language sql stable security definer set search_path = public as $$
  select lower(trim(e.query)), count(*) from analytics_events e
  where is_staff() and e.event = 'search' and e.query is not null and trim(e.query) <> '' and (e.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  group by 1 order by 2 desc limit least(p_limit, 100)
$$;

create or replace function admin_rfq_funnel(p_from date, p_to date)
returns table (status text, n bigint, quoted_value numeric) language sql stable security definer set search_path = public as $$
  select r.status::text, count(*), coalesce(sum(r.quoted_total),0) from rfqs r
  where is_staff() and (r.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to group by 1 order by 2 desc
$$;

do $$ declare f text; begin
  foreach f in array array['admin_sales_report(date,date,text)','admin_sales_by_product(date,date,int)','admin_sales_by_category(date,date)','admin_traffic(date,date)','admin_top_searches(date,date,int)','admin_rfq_funnel(date,date)'] loop
    execute format('revoke all on function %s from public, anon', f); execute format('grant execute on function %s to authenticated', f);
  end loop; end $$;
