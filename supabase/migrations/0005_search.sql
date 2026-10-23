-- Storefront search, filters and facets. SECURITY INVOKER: RLS limits results to published products for visitors.

create or replace function category_descendants(p_category uuid) returns setof uuid language sql stable as $$
  with recursive t as (
    select id from categories where id = p_category
    union all
    select c.id from categories c join t on c.parent_id = t.id
  ) select id from t
$$;

-- Lowest sellable price for a product (family price or cheapest active variant); null = quote only.
create or replace function product_display_price(p_product uuid) returns numeric language sql stable as $$
  select coalesce(
    (select base_price from products where id = p_product and not is_quote_only),
    (select min(v.price) from product_variants v join products p on p.id = v.product_id
      where v.product_id = p_product and v.is_active and v.price is not null and not p.is_quote_only))
$$;

-- p_filters example: {"size":["2\""],"grade":["304","316"]}  (OR within one attribute, AND across attributes)
create or replace function search_products(
  p_q text default null,
  p_category uuid default null,
  p_filters jsonb default '{}'::jsonb,
  p_availability text default null,       -- 'in_stock' | 'quote_only' | 'priced'
  p_flag text default null,               -- 'featured' | 'new' | 'offer'
  p_sort text default 'newest',           -- newest | name_asc | price_low | price_high | popular
  p_limit int default 24,
  p_offset int default 0
) returns table (id uuid, total bigint)
language plpgsql stable as $$
declare k text; vals text[]; q text := nullif(trim(p_q), '');
begin
  return query
  with filtered as (
    select p.id, p.name_en, p.published_at, p.view_count, product_display_price(p.id) as dprice
    from products p
    where p.status = 'published'
      and (p_category is null or p.category_id in (select category_descendants(p_category)))
      and (q is null or p.name_en ilike '%'||q||'%' or p.name_ar ilike '%'||q||'%' or p.sku ilike '%'||q||'%'
           or p.short_desc_en ilike '%'||q||'%' or p.description_en ilike '%'||q||'%'
           or exists (select 1 from product_variants v where v.product_id = p.id and v.sku ilike '%'||q||'%')
           or exists (select 1 from product_attribute_values a where a.product_id = p.id and (a.value_en ilike '%'||q||'%' or a.value_ar ilike '%'||q||'%'))
           or exists (select 1 from brands b where b.id = p.brand_id and b.name ilike '%'||q||'%'))
      and (p_flag is null or (p_flag = 'featured' and p.is_featured) or (p_flag = 'new' and p.is_new_arrival) or (p_flag = 'offer' and p.is_special_offer))
      and (p_availability is null
           or (p_availability = 'quote_only' and p.is_quote_only)
           or (p_availability = 'priced' and not p.is_quote_only)
           or (p_availability = 'in_stock' and exists (select 1 from variant_availability va where va.product_id = p.id and va.available > 0)))
      and not exists (
        select 1 from jsonb_each(coalesce(p_filters, '{}'::jsonb)) f
        where jsonb_typeof(f.value) = 'array' and jsonb_array_length(f.value) > 0
          and not exists (
            select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id
            where a.product_id = p.id and d.key = f.key and a.value_en in (select jsonb_array_elements_text(f.value))))
  )
  select f.id, count(*) over () as total from filtered f
  order by
    case when p_sort = 'name_asc' then f.name_en end asc,
    case when p_sort = 'price_low' then f.dprice end asc nulls last,
    case when p_sort = 'price_high' then f.dprice end desc nulls last,
    case when p_sort = 'popular' then f.view_count end desc,
    f.published_at desc nulls last, f.name_en
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
end $$;
grant execute on function search_products(text,uuid,jsonb,text,text,text,int,int) to anon, authenticated;

-- Facet counts for the filter sidebar (within category + search scope, ignoring other facet selections for simplicity).
create or replace function product_facets(p_q text default null, p_category uuid default null)
returns table (attr_key text, attr_name_en text, attr_name_ar text, value_en text, value_ar text, n bigint)
language sql stable as $$
  select d.key, d.name_en, d.name_ar, a.value_en, max(a.value_ar), count(distinct a.product_id)
  from product_attribute_values a
  join attribute_defs d on d.id = a.attribute_id and d.is_filterable
  join products p on p.id = a.product_id and p.status = 'published'
  where (p_category is null or p.category_id in (select category_descendants(p_category)))
    and (nullif(trim(p_q),'') is null or p.name_en ilike '%'||trim(p_q)||'%' or p.name_ar ilike '%'||trim(p_q)||'%' or p.sku ilike '%'||trim(p_q)||'%')
  group by d.key, d.name_en, d.name_ar, d.sort_order, a.value_en
  order by d.sort_order, d.key, a.value_en
$$;
grant execute on function product_facets(text,uuid) to anon, authenticated;

-- Type-ahead suggestions: products (prefix matches first) and categories.
create or replace function search_suggestions(p_q text, p_limit int default 6)
returns table (kind text, id uuid, slug text, name_en text, name_ar text, image_path text)
language sql stable as $$
  (select 'product'::text, p.id, p.slug, p.name_en, p.name_ar,
          (select i.storage_path from product_images i where i.product_id = p.id order by i.is_primary desc, i.sort_order limit 1)
   from products p
   where p.status = 'published' and length(trim(p_q)) >= 2
     and (p.name_en ilike '%'||trim(p_q)||'%' or p.name_ar ilike '%'||trim(p_q)||'%' or p.sku ilike trim(p_q)||'%')
   order by (p.name_en ilike trim(p_q)||'%') desc, p.view_count desc limit p_limit)
  union all
  (select 'category'::text, c.id, c.slug, c.name_en, c.name_ar, c.image_path
   from categories c
   where c.is_active and length(trim(p_q)) >= 2 and (c.name_en ilike '%'||trim(p_q)||'%' or c.name_ar ilike '%'||trim(p_q)||'%')
   limit 3)
$$;
grant execute on function search_suggestions(text,int) to anon, authenticated;
