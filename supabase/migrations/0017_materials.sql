-- 0017: material classification and material / brand / size / connection / class filters.
-- Materials are stored per manufacturer offering (product_materials, with grades, status and source) and optionally per variant
-- (product_variants.material_code). A variant without its own material code carries all of its offering's public materials.
-- Public = status 'verified' (admin) or 'auto' (high-confidence rule: an ASTM grade or an explicit material in the product's own data).
-- 'unverified' (e.g. only a general catalogue list or a description keyword) stays hidden until an admin approves it.

create table if not exists material_types (
  code text primary key check (code ~ '^[A-Z0-9_]{1,12}$'),
  name_en text not null, name_ar text, sort_order int not null default 100, is_custom boolean not null default false,
  created_at timestamptz not null default now()
);
insert into material_types (code, name_en, name_ar, sort_order) values
  ('CS', 'Carbon Steel', 'صلب كربوني', 10), ('SS', 'Stainless Steel', 'ستانلس ستيل', 20), ('AS', 'Alloy Steel', 'صلب سبائكي', 30),
  ('DSS', 'Duplex Stainless Steel', 'ستانلس ستيل دوبلكس', 40), ('SDSS', 'Super Duplex Stainless Steel', 'ستانلس ستيل سوبر دوبلكس', 50),
  ('NI', 'Nickel Alloy', 'سبائك النيكل', 55), ('GI', 'Galvanized Iron / Steel', 'حديد / صلب مجلفن', 60), ('CI', 'Cast / Ductile Iron', 'حديد زهر / مرن', 65),
  ('BRASS', 'Brass', 'نحاس أصفر', 70), ('BRONZE', 'Bronze', 'برونز', 75), ('CU', 'Copper', 'نحاس', 80), ('AL', 'Aluminium', 'ألومنيوم', 85),
  ('HDPE', 'HDPE', 'HDPE', 90), ('PVC', 'PVC / uPVC', 'PVC', 92), ('CPVC', 'CPVC', 'CPVC', 94), ('PPR', 'PPR', 'PPR', 96), ('OTHER', 'Other', 'أخرى', 999)
on conflict (code) do nothing;

create table if not exists product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  material_code text not null references material_types(code) on update cascade,
  grades text[] not null default '{}',
  status text not null default 'unverified' check (status in ('auto', 'unverified', 'verified', 'rejected')),
  source text,                                   -- where it was found, e.g. "grade ASTM A182 F316L (catalogue p.65)" or "set by admin"
  note text,                                     -- e.g. "galvanized coating on carbon steel"
  edited_by_admin boolean not null default false,   -- automatic detection never changes a row an admin touched
  updated_by uuid references profiles(id), updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique (product_id, material_code)
);
create index if not exists product_materials_code_idx on product_materials(material_code) where status in ('auto', 'verified');

alter table product_variants add column if not exists material_code text references material_types(code) on update cascade;

alter table material_types enable row level security;
alter table product_materials enable row level security;
drop policy if exists "material types public read" on material_types;
create policy "material types public read" on material_types for select using (true);
drop policy if exists "material types staff write" on material_types;
create policy "material types staff write" on material_types for all using (is_staff()) with check (is_staff());
drop policy if exists "product materials public read" on product_materials;
create policy "product materials public read" on product_materials for select using ((status in ('auto', 'verified') and product_is_public(product_id)) or is_staff());
drop policy if exists "product materials staff write" on product_materials;
create policy "product materials staff write" on product_materials for all using (is_staff()) with check (is_staff());
grant select on material_types, product_materials to anon, authenticated;
grant insert, update, delete on material_types, product_materials to authenticated;

-- ───────── normalisation shared by filters and facets ─────────
create or replace function norm_size(t text) returns text language sql immutable as $$
  select nullif(lower(regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''), '(\d)\s+(\d+/\d+)', '\1-\2', 'g'), '["”″]|inch(es)?|\s', '', 'gi'), '^nps', '')), '')
$$;
create or replace function norm_class(t text) returns text language sql immutable as $$
  select nullif(upper(regexp_replace(coalesce(t, ''), '(?i)class|lbs?\.?|#|\s', '', 'g')), '')
$$;
-- the main size of a variant: size, else the run / large end of a reducing item, else the legacy size column
create or replace function variant_size_key(o jsonb, legacy text) returns text language sql immutable as $$
  select norm_size(coalesce(o->>'size', o->>'run', o->>'large', legacy))
$$;
create or replace function variant_class_key(o jsonb, legacy text) returns text language sql immutable as $$
  select norm_class(coalesce(o->>'class', o->>'pressure_class', o->>'rating', o->>'schedule', legacy))
$$;

-- keys handled at variant level (one real variant must satisfy all of them together) and at product level (brand)
create or replace function filter_vals(p_filters jsonb, k text) returns text[] language sql immutable as $$
  select case when jsonb_typeof(p_filters->k) = 'array' and jsonb_array_length(p_filters->k) > 0 then array(select jsonb_array_elements_text(p_filters->k)) end
$$;

create or replace function product_matches_filters(p_product uuid, p_filters jsonb) returns boolean language plpgsql stable as $$
declare
  m text[] := filter_vals(p_filters, 'material'); s text[] := filter_vals(p_filters, 'size'); c text[] := filter_vals(p_filters, 'connection');
  k text[] := filter_vals(p_filters, 'pressure_class'); b text[] := filter_vals(p_filters, 'brand');
  pub text[];
begin
  if b is not null and not exists (select 1 from products p join brands br on br.id = p.brand_id where p.id = p_product and br.name = any(b)) then return false; end if;
  if m is null and s is null and c is null and k is null then return true; end if;
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
        and (k is null or variant_class_key(v.options, v.pressure_class) = any(k)));
  end if;
  -- products without variants (families sold by quotation): product-level data
  return (m is null or pub && m)
    and (s is null or exists (select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id where a.product_id = p_product and d.key = 'size' and norm_size(a.value_en) = any(s)))
    and (k is null or exists (select 1 from product_attribute_values a join attribute_defs d on d.id = a.attribute_id where a.product_id = p_product and d.key = 'pressure_class' and norm_class(a.value_en) = any(k)))
    and c is null;
end $$;

-- search: same as 0016, with the variant-level filters above; other attribute filters keep their product-level meaning
drop function if exists search_products(text, uuid, jsonb, text, text, text, int, int);
create function search_products(
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
        where f.key not in ('material', 'size', 'connection', 'pressure_class', 'brand')
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

-- facets: material, brand, size, connection, pressure class (from real variants and public materials) + other filterable attributes.
-- n = listing entries (a family counts once). value_en = filter value, label_en / value_ar = display labels.
drop function if exists product_facets(text, uuid);
drop function if exists product_facets(text, uuid, uuid);
create function product_facets(p_q text default null, p_category uuid default null, p_brand uuid default null)
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
    select d.key, a.value_en, a.value_en, coalesce(a.value_ar, a.value_en), lpad(d.sort_order::text, 5, '0'), s.entry
      from scope s join product_attribute_values a on a.product_id = s.id join attribute_defs d on d.id = a.attribute_id and d.is_filterable
      where d.key not in ('material', 'size', 'pressure_class', 'brand')
  )
  select r.k, coalesce(d.name_en, initcap(replace(r.k, '_', ' '))), d.name_ar, r.v, max(r.la), count(distinct r.entry), max(r.le), max(r.sk)
  from raw r left join attribute_defs d on d.key = r.k
  where r.v is not null
  group by r.k, d.name_en, d.name_ar, r.v
  order by case r.k when 'material' then 1 when 'brand' then 2 when 'size' then 3 when 'connection' then 4 when 'pressure_class' then 5 else 9 end, r.k, max(r.sk), r.v
$$;
grant execute on function product_facets(text,uuid,uuid) to anon, authenticated;

insert into attribute_defs (key, name_en, name_ar, is_filterable, sort_order) values ('connection', 'Connection', 'نوع التوصيل', true, 45)
on conflict (key) do nothing;

-- carry over the materials already written in the 'material' attribute (older imports), so the new filter works straight away.
-- Explicit material names only; anything else waits for the admin's automatic detection / review.
insert into product_materials (product_id, material_code, status, source, note)
select distinct on (a.product_id, x.code) a.product_id, x.code, 'auto', 'material attribute "' || a.value_en || '"',
       case when x.code = 'GI' then 'Galvanized coating' end
from product_attribute_values a join attribute_defs d on d.id = a.attribute_id and d.key = 'material'
cross join lateral (select case
  when a.value_en ~* 'super[ -]*duplex' then 'SDSS' when a.value_en ~* 'duplex' then 'DSS' when a.value_en ~* 'galvani[sz]' then 'GI'
  when a.value_en ~* 'stainless' then 'SS' when a.value_en ~* 'alloy[ -]+steel' then 'AS' when a.value_en ~* 'carbon[ -]+steel' then 'CS'
  when a.value_en ~* '\mbrass\M' then 'BRASS' when a.value_en ~* '\mbronze\M' then 'BRONZE' when a.value_en ~* '\mcopper\M' then 'CU'
  when a.value_en ~* 'alumin' then 'AL' when a.value_en ~* '\mhdpe\M' then 'HDPE' when a.value_en ~* '\mcpvc\M' then 'CPVC'
  when a.value_en ~* '\mu?pvc\M' then 'PVC' when a.value_en ~* '\mpp-?r\M' then 'PPR' when a.value_en ~* '(ductile|cast|malleable)[ -]+iron' then 'CI' end as code) x
where x.code is not null
on conflict (product_id, material_code) do nothing;
