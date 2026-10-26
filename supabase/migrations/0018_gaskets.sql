-- 0018: gaskets & sealing products.
-- * Composite products (spiral wound, camprofile, jacketed …) are made of several materials. product_materials.components records which part
--   uses the material (winding, filler, inner ring, outer ring, facing, core …) and the grades for that part, so a gasket with stainless windings
--   and a carbon-steel outer ring is listed under BOTH materials.
-- * product_materials.origin: 'detection' rows are maintained by the automatic detection; 'import' (written by a catalogue import) and 'admin'
--   rows are never changed or removed by it.
-- * product_images.option_match: a drawing that belongs to particular options (e.g. {"style":"SW-IR/CR"}) is shown for those selections.
-- * Flange standard / series ("standard" variant option) becomes a filter, matched on the same variant as size and class.
-- * Values "na" in variant options mean "not applicable" (e.g. ring-number-only RX rings have no flange class) and are never listed as filters.

alter table product_materials add column if not exists components jsonb not null default '[]'::jsonb;
alter table product_materials add column if not exists origin text not null default 'detection';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'product_materials_origin_check') then
    alter table product_materials add constraint product_materials_origin_check check (origin in ('detection', 'import', 'admin'));
  end if;
end $$;
update product_materials set origin = 'admin' where edited_by_admin and origin = 'detection';

alter table product_images add column if not exists option_match jsonb;
-- technical drawings are uploaded as SVG (staff-only upload; brand-logos already accepts SVG)
update storage.buckets set allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
 where id = 'product-images' and allowed_mime_types is not null and not ('image/svg+xml' = any(allowed_mime_types));

insert into material_types (code, name_en, name_ar, sort_order) values
  ('TI', 'Titanium', 'تيتانيوم', 57), ('IRON', 'Soft Iron', 'حديد طري', 66),
  ('GRAPHITE', 'Flexible Graphite', 'جرافيت مرن', 100), ('PTFE', 'PTFE', 'PTFE (تفلون)', 102), ('CNAF', 'Compressed Non-Asbestos Fibre', 'ألياف مضغوطة خالية من الأسبستوس', 104),
  ('MINFIBRE', 'Inorganic (Mineral) Fibre', 'ألياف معدنية غير عضوية', 106), ('RUBBER', 'Elastomer / Rubber', 'مطاط / إيلاستومر', 108), ('MICA', 'Mica', 'ميكا', 110),
  ('CERAMIC', 'Ceramic', 'سيراميك', 112), ('GRE', 'Glass-Reinforced Epoxy (G-10 / G-11)', 'إيبوكسي مقوى بالزجاج (G-10 / G-11)', 114), ('PHENOLIC', 'Phenolic', 'فينوليك', 116),
  ('PE', 'Polyethylene', 'بولي إيثيلين', 118), ('CELLULOSE', 'Cellulose Fibre', 'ألياف السليلوز', 120), ('CORK', 'Cork-Nitrile', 'فلين - نتريل', 122)
on conflict (code) do nothing;

insert into attribute_defs (key, name_en, name_ar, is_filterable, show_in_specs, sort_order) values
  ('gasket_family', 'Gasket family', 'عائلة الحشوات', true, true, 5),
  ('gasket_standard', 'Gasket standard', 'مواصفة الحشوة', true, true, 46)
on conflict (key) do nothing;
insert into attribute_defs (key, name_en, name_ar, is_filterable, show_in_specs, sort_order) values ('standard', 'Standard', 'المواصفة القياسية', true, true, 40)
on conflict (key) do nothing;

create or replace function variant_size_key(o jsonb, legacy text) returns text language sql immutable as $$
  select nullif(norm_size(coalesce(nullif(o->>'size', 'na'), o->>'run', o->>'large', legacy)), 'na')
$$;
create or replace function variant_class_key(o jsonb, legacy text) returns text language sql immutable as $$
  select nullif(norm_class(coalesce(nullif(o->>'class', 'na'), o->>'pressure_class', o->>'rating', o->>'schedule', legacy)), 'NA')
$$;

create or replace function product_matches_filters(p_product uuid, p_filters jsonb) returns boolean language plpgsql stable as $$
declare
  m text[] := filter_vals(p_filters, 'material'); s text[] := filter_vals(p_filters, 'size'); c text[] := filter_vals(p_filters, 'connection');
  k text[] := filter_vals(p_filters, 'pressure_class'); b text[] := filter_vals(p_filters, 'brand'); sd text[] := filter_vals(p_filters, 'standard');
  pub text[];
begin
  if b is not null and not exists (select 1 from products p join brands br on br.id = p.brand_id where p.id = p_product and br.name = any(b)) then return false; end if;
  if m is null and s is null and c is null and k is null and sd is null then return true; end if;
  -- accept codes ("SS") and names ("Stainless Steel", older links used the name)
  if m is not null then m := array(select coalesce((select t.code from material_types t where t.code = upper(x) or lower(t.name_en) = lower(x) limit 1), upper(x)) from unnest(m) x); end if;
  s := array(select norm_size(x) from unnest(s) x); k := array(select norm_class(x) from unnest(k) x);
  if s = '{}' then s := null; end if; if k = '{}' then k := null; end if;
  select array_agg(material_code) into pub from product_materials where product_id = p_product and status in ('auto', 'verified');
  if exists (select 1 from product_variants v where v.product_id = p_product and v.is_active) then
    return exists (
      select 1 from product_variants v where v.product_id = p_product and v.is_active
        and (m is null or v.material_code = any(m) or (v.material_code is null and pub && m))
        and (s is null or variant_size_key(v.options, v.size) = any(s))
        and (c is null or v.options->>'connection' = any(c))
        and (k is null or variant_class_key(v.options, v.pressure_class) = any(k))
        -- flange standard / series is a variant option where the catalogue gives one (gasket tables per standard); otherwise the product's standard attribute
        and (sd is null or v.options->>'standard' = any(sd)
             or (coalesce(v.options->>'standard', 'na') = 'na' and exists (select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id where a.product_id = p_product and d.key = 'standard' and a.value_en = any(sd)))));
  end if;
  -- products without variants (families sold by quotation): product-level data
  return (m is null or pub && m)
    and (s is null or exists (select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id where a.product_id = p_product and d.key = 'size' and norm_size(a.value_en) = any(s)))
    and (k is null or exists (select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id where a.product_id = p_product and d.key = 'pressure_class' and norm_class(a.value_en) = any(k)))
    and (sd is null or exists (select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id where a.product_id = p_product and d.key = 'standard' and a.value_en = any(sd)))
    and c is null;
end $$;

create or replace function search_products(
  p_q text default null, p_category uuid default null, p_filters jsonb default '{}'::jsonb, p_availability text default null,
  p_flag text default null, p_sort text default 'newest', p_limit int default 24, p_offset int default 0
) returns table (id uuid, total bigint, family_id uuid)
language plpgsql stable as $$
declare q text := nullif(trim(p_q), '');
begin
  return query
  with filtered as (
    select p.id, p.name_en, p.published_at, p.view_count, product_display_price(p.id) as dprice, p.family_sort, product_listing_family(p.id) as fam
    from products p
    where p.status = 'published'
      and (p_category is null or p.category_id in (select category_descendants(p_category)))
      and (q is null or p.name_en ilike '%'||q||'%' or p.name_ar ilike '%'||q||'%' or p.sku ilike '%'||q||'%'
           or p.short_desc_en ilike '%'||q||'%' or p.description_en ilike '%'||q||'%'
           or exists (select 1 from product_variants v where v.product_id = p.id and (v.sku ilike '%'||q||'%' or v.manufacturer_code ilike '%'||q||'%'))
           or exists (select 1 from product_attribute_values a where a.product_id = p.id and (a.value_en ilike '%'||q||'%' or a.value_ar ilike '%'||q||'%'))
           or exists (select 1 from brands b where b.id = p.brand_id and b.name ilike '%'||q||'%')
           or exists (select 1 from product_families f where f.id = p.family_id and f.status = 'published' and (f.name_en ilike '%'||q||'%' or f.name_ar ilike '%'||q||'%'))
           or exists (select 1 from product_materials pm join material_types mt on mt.code = pm.material_code where pm.product_id = p.id and pm.status in ('auto','verified')
                      and (mt.name_en ilike '%'||q||'%' or mt.code = upper(q) or exists (select 1 from unnest(pm.grades) g where g ilike '%'||q||'%'))))
      and (p_flag is null or (p_flag = 'featured' and p.is_featured) or (p_flag = 'new' and p.is_new_arrival) or (p_flag = 'offer' and p.is_special_offer))
      and (p_availability is null
           or (p_availability = 'quote_only' and p.is_quote_only)
           or (p_availability = 'priced' and not p.is_quote_only)
           or (p_availability = 'in_stock' and exists (select 1 from variant_availability va where va.product_id = p.id and va.available > 0)))
      and product_matches_filters(p.id, coalesce(p_filters, '{}'::jsonb))
      and not exists (
        select 1 from jsonb_each(coalesce(p_filters, '{}'::jsonb)) f
        where f.key not in ('material', 'size', 'connection', 'pressure_class', 'brand', 'standard')
          and jsonb_typeof(f.value) = 'array' and jsonb_array_length(f.value) > 0
          and not exists (
            select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id
            where a.product_id = p.id and d.key = f.key and a.value_en in (select jsonb_array_elements_text(f.value))))
  ),
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

create or replace function product_facets(p_q text default null, p_category uuid default null, p_brand uuid default null)
returns table (attr_key text, attr_name_en text, attr_name_ar text, value_en text, value_ar text, n bigint, label_en text, sort_key text)
language sql stable as $$
  with scope as (
    select p.id, coalesce(product_listing_family(p.id), p.id) as entry, p.brand_id from products p
    where p.status = 'published'
      and (p_category is null or p.category_id in (select category_descendants(p_category)))
      and (p_brand is null or p.brand_id = p_brand)
      and (nullif(trim(p_q),'') is null or p.name_en ilike '%'||trim(p_q)||'%' or p.name_ar ilike '%'||trim(p_q)||'%' or p.sku ilike '%'||trim(p_q)||'%')
  ),
  raw as (
    select 'material' k, mt.code v, mt.name_en le, coalesce(mt.name_ar, mt.name_en) la, lpad(mt.sort_order::text, 5, '0') sk, s.entry
      from scope s join product_materials pm on pm.product_id = s.id and pm.status in ('auto','verified') join material_types mt on mt.code = pm.material_code
    union all
    select 'material', mt.code, mt.name_en, coalesce(mt.name_ar, mt.name_en), lpad(mt.sort_order::text, 5, '0'), s.entry
      from scope s join product_variants v on v.product_id = s.id and v.is_active join material_types mt on mt.code = v.material_code
    union all
    select 'brand', b.name, b.name, coalesce(b.name_ar, b.name), lower(b.name), s.entry from scope s join brands b on b.id = s.brand_id
    union all
    select 'size', variant_size_key(v.options, v.size), variant_size_key(v.options, v.size) || '"', variant_size_key(v.options, v.size) || '"', '', s.entry
      from scope s join product_variants v on v.product_id = s.id and v.is_active where variant_size_key(v.options, v.size) is not null
    union all
    select 'size', norm_size(a.value_en), norm_size(a.value_en) || '"', norm_size(a.value_en) || '"', '', s.entry
      from scope s join product_attribute_values a on a.product_id = s.id join attribute_defs d on d.id = a.attribute_id and d.key = 'size'
      where not exists (select 1 from product_variants v where v.product_id = s.id and v.is_active) and norm_size(a.value_en) is not null
    union all
    select 'connection', v.options->>'connection', coalesce(ov.label_en, v.options->>'connection'), coalesce(ov.label_ar, ov.label_en, v.options->>'connection'), v.options->>'connection', s.entry
      from scope s join product_variants v on v.product_id = s.id and v.is_active
      left join lateral (select x.label_en, x.label_ar from product_options o join product_option_values x on x.option_id = o.id
                         where o.product_id = s.id and o.key = 'connection' and x.value = v.options->>'connection' limit 1) ov on true
      where v.options ? 'connection'
    union all
    select 'pressure_class', variant_class_key(v.options, v.pressure_class),
           case when variant_class_key(v.options, v.pressure_class) ~ '^\d+$' then 'Class ' || variant_class_key(v.options, v.pressure_class) else variant_class_key(v.options, v.pressure_class) end,
           case when variant_class_key(v.options, v.pressure_class) ~ '^\d+$' then 'فئة ' || variant_class_key(v.options, v.pressure_class) else variant_class_key(v.options, v.pressure_class) end,
           '', s.entry
      from scope s join product_variants v on v.product_id = s.id and v.is_active where variant_class_key(v.options, v.pressure_class) is not null
    union all
    select 'standard', v.options->>'standard', coalesce(ov.label_en, v.options->>'standard'), coalesce(ov.label_ar, ov.label_en, v.options->>'standard'), v.options->>'standard', s.entry
      from scope s join product_variants v on v.product_id = s.id and v.is_active
      left join lateral (select x.label_en, x.label_ar from product_options o join product_option_values x on x.option_id = o.id
                         where o.product_id = s.id and o.key = 'standard' and x.value = v.options->>'standard' limit 1) ov on true
      where coalesce(v.options->>'standard', 'na') <> 'na'
    union all
    select d.key, a.value_en, a.value_en, coalesce(a.value_ar, a.value_en), lpad(d.sort_order::text, 5, '0'), s.entry
      from scope s join product_attribute_values a on a.product_id = s.id join attribute_defs d on d.id = a.attribute_id and d.is_filterable
      where d.key not in ('material', 'size', 'pressure_class', 'brand')
  )
  select r.k, coalesce(d.name_en, initcap(replace(r.k, '_', ' '))), d.name_ar, r.v, max(r.la), count(distinct r.entry), max(r.le), max(r.sk)
  from raw r left join attribute_defs d on d.key = r.k
  where r.v is not null
  group by r.k, d.name_en, d.name_ar, r.v
  order by case r.k when 'gasket_family' then 0 when 'material' then 1 when 'brand' then 2 when 'size' then 3 when 'connection' then 4 when 'pressure_class' then 5 when 'standard' then 6 when 'gasket_standard' then 7 else 9 end, r.k, max(r.sk), r.v
$$;
grant execute on function product_facets(text,uuid,uuid) to anon, authenticated;
