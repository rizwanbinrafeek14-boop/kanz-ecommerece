-- 0022 Filter counts that respect the other active filters (additive replacement of product_facets).
-- * Each filter group is counted with every OTHER active filter applied, but not its own: choosing "Class 3000" still shows
--   how many results "Class 6000" would give, while the Size, Material, Brand … counts shrink to what is actually available.
-- * Search text uses the same word matching as the results (product_matches_query, migration 0019), not a phrase match.
-- * Availability (in stock / priced / quote only) and the featured / new / offer flags are applied like in search_products.
-- The old 3-argument version is replaced; calls with only the first 3 arguments keep working through the defaults.

drop function if exists product_facets(text, uuid, uuid);
create or replace function product_facets(p_q text default null, p_category uuid default null, p_brand uuid default null,
  p_filters jsonb default '{}'::jsonb, p_availability text default null, p_flag text default null)
returns table (attr_key text, attr_name_en text, attr_name_ar text, value_en text, value_ar text, n bigint, label_en text, sort_key text)
language sql stable as $$
  with ctx as (   -- '*' = all filters; one more context per active filter group, without that group
    select '*'::text as c, coalesce(p_filters, '{}'::jsonb) as f
    union all
    select k, coalesce(p_filters, '{}'::jsonb) - k from jsonb_object_keys(coalesce(p_filters, '{}'::jsonb)) k
    where jsonb_typeof(p_filters->k) = 'array' and jsonb_array_length(p_filters->k) > 0
  ),
  base as (
    select p.id, coalesce(product_listing_family(p.id), p.id) as entry, p.brand_id from products p
    where p.status = 'published'
      and (p_category is null or p.category_id in (select category_descendants(p_category)))
      and (p_brand is null or p.brand_id = p_brand)
      and (nullif(trim(p_q), '') is null or product_matches_query(p.id, trim(p_q)))
      and (p_flag is null or (p_flag = 'featured' and p.is_featured) or (p_flag = 'new' and p.is_new_arrival) or (p_flag = 'offer' and p.is_special_offer))
      and (p_availability is null
           or (p_availability = 'quote_only' and p.is_quote_only)
           or (p_availability = 'priced' and not p.is_quote_only)
           or (p_availability = 'in_stock' and exists (select 1 from variant_availability va where va.product_id = p.id and va.available > 0)))
  ),
  scope as (   -- the products of each context (same filter rules as search_products)
    select x.c, b.id, b.entry, b.brand_id from ctx x cross join base b
    where product_matches_filters(b.id, x.f)
      and not exists (
        select 1 from jsonb_each(x.f) f
        where f.key not in ('material', 'size', 'connection', 'pressure_class', 'brand', 'standard')
          and jsonb_typeof(f.value) = 'array' and jsonb_array_length(f.value) > 0
          and not exists (
            select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id
            where a.product_id = b.id and d.key = f.key and a.value_en in (select jsonb_array_elements_text(f.value))))
  ),
  raw as (
    select 'material' k, mt.code v, mt.name_en le, coalesce(mt.name_ar, mt.name_en) la, lpad(mt.sort_order::text, 5, '0') sk, s.entry, s.c
      from scope s join product_materials pm on pm.product_id = s.id and pm.status in ('auto','verified') join material_types mt on mt.code = pm.material_code
    union all
    select 'material', mt.code, mt.name_en, coalesce(mt.name_ar, mt.name_en), lpad(mt.sort_order::text, 5, '0'), s.entry, s.c
      from scope s join product_variants v on v.product_id = s.id and v.is_active join material_types mt on mt.code = v.material_code
    union all
    select 'brand', b.name, b.name, coalesce(b.name_ar, b.name), lower(b.name), s.entry, s.c from scope s join brands b on b.id = s.brand_id
    union all
    select 'size', variant_size_key(v.options, v.size), variant_size_key(v.options, v.size) || '"', variant_size_key(v.options, v.size) || '"', '', s.entry, s.c
      from scope s join product_variants v on v.product_id = s.id and v.is_active where variant_size_key(v.options, v.size) is not null
    union all
    select 'size', norm_size(a.value_en), norm_size(a.value_en) || '"', norm_size(a.value_en) || '"', '', s.entry, s.c
      from scope s join product_attribute_values a on a.product_id = s.id join attribute_defs d on d.id = a.attribute_id and d.key = 'size'
      where not exists (select 1 from product_variants v where v.product_id = s.id and v.is_active) and norm_size(a.value_en) is not null
    union all
    select 'connection', v.options->>'connection', coalesce(ov.label_en, v.options->>'connection'), coalesce(ov.label_ar, ov.label_en, v.options->>'connection'), v.options->>'connection', s.entry, s.c
      from scope s join product_variants v on v.product_id = s.id and v.is_active
      left join lateral (select x.label_en, x.label_ar from product_options o join product_option_values x on x.option_id = o.id
                         where o.product_id = s.id and o.key = 'connection' and x.value = v.options->>'connection' limit 1) ov on true
      where v.options ? 'connection'
    union all
    select 'pressure_class', variant_class_key(v.options, v.pressure_class),
           case when variant_class_key(v.options, v.pressure_class) ~ '^\d+$' then 'Class ' || variant_class_key(v.options, v.pressure_class) else variant_class_key(v.options, v.pressure_class) end,
           case when variant_class_key(v.options, v.pressure_class) ~ '^\d+$' then 'فئة ' || variant_class_key(v.options, v.pressure_class) else variant_class_key(v.options, v.pressure_class) end,
           '', s.entry, s.c
      from scope s join product_variants v on v.product_id = s.id and v.is_active where variant_class_key(v.options, v.pressure_class) is not null
    union all
    select 'standard', v.options->>'standard', coalesce(ov.label_en, v.options->>'standard'), coalesce(ov.label_ar, ov.label_en, v.options->>'standard'), v.options->>'standard', s.entry, s.c
      from scope s join product_variants v on v.product_id = s.id and v.is_active
      left join lateral (select x.label_en, x.label_ar from product_options o join product_option_values x on x.option_id = o.id
                         where o.product_id = s.id and o.key = 'standard' and x.value = v.options->>'standard' limit 1) ov on true
      where coalesce(v.options->>'standard', 'na') <> 'na'
    union all
    select d.key, a.value_en, a.value_en, coalesce(a.value_ar, a.value_en), lpad(d.sort_order::text, 5, '0'), s.entry, s.c
      from scope s join product_attribute_values a on a.product_id = s.id join attribute_defs d on d.id = a.attribute_id and d.is_filterable
      where d.key not in ('material', 'size', 'pressure_class', 'brand')
  )
  select r.k, coalesce(d.name_en, initcap(replace(r.k, '_', ' '))), d.name_ar, r.v, max(r.la), count(distinct r.entry), max(r.le), max(r.sk)
  from raw r left join attribute_defs d on d.key = r.k
  -- a group is counted in its own context (all other filters applied); groups without an active filter use the full filter set
  where r.v is not null and (r.c = r.k or (r.c = '*' and r.k not in (select c from ctx where c <> '*')))
  group by r.k, d.name_en, d.name_ar, r.v
  order by case r.k when 'gasket_family' then 0 when 'material' then 1 when 'brand' then 2 when 'size' then 3 when 'connection' then 4 when 'pressure_class' then 5 when 'standard' then 6 when 'gasket_standard' then 7 else 9 end, r.k, max(r.sk), r.v
$$;
grant execute on function product_facets(text,uuid,uuid,jsonb,text,text) to anon, authenticated;
