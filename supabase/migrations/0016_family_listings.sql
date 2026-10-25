-- 0016: listings show ONE entry per product family.
-- A published product is listed as its family when it is a confirmed offering of a PUBLISHED family; otherwise it is listed on its own.
-- Search, filters, facet counts, suggestions and category counts all count these listing entries, so totals and pagination
-- count families, not manufacturer records. No product data is changed.

-- The family a product is listed under (null = listed on its own). SECURITY DEFINER only to read the family status cheaply; returns ids only.
create or replace function product_listing_family(p_product uuid) returns uuid language sql stable security definer set search_path = public as $$
  select f.id from products p join product_families f on f.id = p.family_id
  where p.id = p_product and p.family_link = 'confirmed' and p.status = 'published' and f.status = 'published'
$$;
grant execute on function product_listing_family(uuid) to anon, authenticated;

drop function if exists search_products(text, uuid, jsonb, text, text, text, int, int);
create function search_products(
  p_q text default null,
  p_category uuid default null,
  p_filters jsonb default '{}'::jsonb,
  p_availability text default null,
  p_flag text default null,
  p_sort text default 'newest',
  p_limit int default 24,
  p_offset int default 0
) returns table (id uuid, total bigint, family_id uuid)
language plpgsql stable as $$
declare q text := nullif(trim(p_q), '');
begin
  return query
  with filtered as (
    select p.id, p.name_en, p.published_at, p.view_count, product_display_price(p.id) as dprice, p.family_sort,
           product_listing_family(p.id) as fam
    from products p
    where p.status = 'published'
      and (p_category is null or p.category_id in (select category_descendants(p_category)))
      and (q is null or p.name_en ilike '%'||q||'%' or p.name_ar ilike '%'||q||'%' or p.sku ilike '%'||q||'%'
           or p.short_desc_en ilike '%'||q||'%' or p.description_en ilike '%'||q||'%'
           or exists (select 1 from product_variants v where v.product_id = p.id and (v.sku ilike '%'||q||'%' or v.manufacturer_code ilike '%'||q||'%'))
           or exists (select 1 from product_attribute_values a where a.product_id = p.id and (a.value_en ilike '%'||q||'%' or a.value_ar ilike '%'||q||'%'))
           or exists (select 1 from brands b where b.id = p.brand_id and b.name ilike '%'||q||'%')
           or exists (select 1 from product_families f where f.id = p.family_id and f.status = 'published' and (f.name_en ilike '%'||q||'%' or f.name_ar ilike '%'||q||'%')))
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
  ),
  -- one row per listing entry: the family's first offering (by admin order) represents it; sort keys use the family's best values
  grouped as (
    select distinct on (coalesce(f.fam, f.id)) f.id, f.fam,
           min(f.name_en) over w as name_en, max(f.published_at) over w as published_at, sum(f.view_count) over w as view_count, min(f.dprice) over w as dprice
    from filtered f
    window w as (partition by coalesce(f.fam, f.id))
    order by coalesce(f.fam, f.id), f.family_sort, f.name_en
  )
  select g.id, count(*) over () as total, g.fam from grouped g
  order by
    case when p_sort = 'name_asc' then g.name_en end asc,
    case when p_sort = 'price_low' then g.dprice end asc nulls last,
    case when p_sort = 'price_high' then g.dprice end desc nulls last,
    case when p_sort = 'popular' then g.view_count end desc,
    g.published_at desc nulls last, g.name_en
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
end $$;
grant execute on function search_products(text,uuid,jsonb,text,text,text,int,int) to anon, authenticated;

-- facet counts = number of listing entries (a family counts once even if three brands carry the value)
create or replace function product_facets(p_q text default null, p_category uuid default null)
returns table (attr_key text, attr_name_en text, attr_name_ar text, value_en text, value_ar text, n bigint)
language sql stable as $$
  select d.key, d.name_en, d.name_ar, a.value_en, max(a.value_ar), count(distinct coalesce(product_listing_family(p.id), p.id))
  from product_attribute_values a
  join attribute_defs d on d.id = a.attribute_id and d.is_filterable
  join products p on p.id = a.product_id and p.status = 'published'
  where (p_category is null or p.category_id in (select category_descendants(p_category)))
    and (nullif(trim(p_q),'') is null or p.name_en ilike '%'||trim(p_q)||'%' or p.name_ar ilike '%'||trim(p_q)||'%' or p.sku ilike '%'||trim(p_q)||'%')
  group by d.key, d.name_en, d.name_ar, d.sort_order, a.value_en
  order by d.sort_order, d.key, a.value_en
$$;
grant execute on function product_facets(text,uuid) to anon, authenticated;

-- type-ahead: families first (one suggestion per family), then standalone products, then categories
drop function if exists search_suggestions(text, int);
create function search_suggestions(p_q text, p_limit int default 6)
returns table (kind text, id uuid, slug text, name_en text, name_ar text, image_path text)
language sql stable as $$
  with hits as (
    select p.id, p.slug, p.name_en, p.name_ar, p.view_count, product_listing_family(p.id) as fam,
           (select i.storage_path from product_images i where i.product_id = p.id order by i.is_primary desc, i.sort_order limit 1) as img
    from products p
    where p.status = 'published' and length(trim(p_q)) >= 2
      and (p.name_en ilike '%'||trim(p_q)||'%' or p.name_ar ilike '%'||trim(p_q)||'%' or p.sku ilike trim(p_q)||'%'
           or exists (select 1 from product_families f where f.id = p.family_id and (f.name_en ilike '%'||trim(p_q)||'%' or f.name_ar ilike '%'||trim(p_q)||'%')))
  ),
  entries as (
    select distinct on (coalesce(h.fam, h.id))
           case when h.fam is null then 'product' else 'family' end as kind, coalesce(h.fam, h.id) as id,
           coalesce(f.slug, h.slug) as slug, coalesce(f.name_en, h.name_en) as name_en, coalesce(f.name_ar, h.name_ar) as name_ar,
           coalesce(f.image_path, h.img) as image_path, h.view_count
    from hits h left join product_families f on f.id = h.fam
    order by coalesce(h.fam, h.id), h.view_count desc
  )
  (select e.kind, e.id, e.slug, e.name_en, e.name_ar, e.image_path from entries e
   order by (e.name_en ilike trim(p_q)||'%') desc, e.view_count desc limit p_limit)
  union all
  (select 'category'::text, c.id, c.slug, c.name_en, c.name_ar, c.image_path
   from categories c
   where c.is_active and length(trim(p_q)) >= 2 and (c.name_en ilike '%'||trim(p_q)||'%' or c.name_ar ilike '%'||trim(p_q)||'%')
   limit 3)
$$;
grant execute on function search_suggestions(text,int) to anon, authenticated;

-- listing entries per active category, including its sub-categories (a family counts once per category)
create or replace function category_listing_counts() returns table (category_id uuid, n bigint)
language sql stable as $$
  with recursive tree as (
    select c.id as root, c.id from categories c where c.is_active
    union all
    select t.root, c.id from categories c join tree t on c.parent_id = t.id
  )
  select t.root, count(distinct coalesce(product_listing_family(p.id), p.id))
  from tree t join products p on p.category_id = t.id and p.status = 'published'
  group by t.root
$$;
grant execute on function category_listing_counts() to anon, authenticated;

-- number of listing entries in the whole shop (homepage counter)
create or replace function listing_count() returns bigint language sql stable as $$
  select count(distinct coalesce(product_listing_family(p.id), p.id)) from products p where p.status = 'published'
$$;
grant execute on function listing_count() to anon, authenticated;
