-- 0019: search that understands how buyers type, plus zero-result logging.
-- * Every word of the query must match (in any order) a normalised search text of the product: names (EN/AR), family, brand,
--   option values and labels (sizes, classes, connections, styles…), SKUs and manufacturer codes, standards, shown materials and grades,
--   attributes and the short description.
-- * Normalisation: ½ ¼ ¾ and 1½ -> 1/2 1/4 3/4 1-1/2 · inch / in / ″ / " dropped · 90° -> 90 · BX-155 -> bx155 · SCH 40 -> sch40 · 300# / 300 lb -> 300.
-- * Synonyms: SW = socket weld, NPT / THD = threaded, WN = weld neck, SO = slip-on, RTJ = ring type joint, kammprofile = camprofile, …
-- * Results are ranked (matches in the name first) when there is a query.
-- * The search text is cached in product_search and kept current by triggers; nothing in the products themselves changes.
-- * analytics_events.results stores the number of results of a search, so searches with no result can be listed for the admin.

create or replace function search_norm(t text) returns text language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(lower(coalesce(t, '')), '(\d)\s+(\d/\d)', '\1-\2', 'g'),        -- 1 1/2 -> 1-1/2
      '(\d)\s*½', '\1-1/2', 'g'), '(\d)\s*¼', '\1-1/4', 'g'), '(\d)\s*¾', '\1-3/4', 'g'),
      '½', '1/2', 'g'), '¼', '1/4', 'g'), '¾', '3/4', 'g'),
      '(\d)\s*(["”″]|inch(es)?\M|in\M|#|lbs?\M)', '\1', 'g'),                 -- 4", 4 inch, 300#, 300 lb -> 4, 300
      '°', '', 'g'),
      '\m(sch|r|rx|bx|f|wp|wpb|tp|lf|wpl|a|b|jd|dn|pn|nps|gr|uns|s|n|c|g)[-\s]+(\d)', '\1\2', 'g'),   -- BX-155, SCH 40, R 24, A 105 -> bx155, sch40, r24, a105
    '\s+', ' ', 'g'))
$$;

-- query words -> alternatives (a word matches when any alternative is found)
create or replace function search_alternatives(w text) returns text[] language sql immutable as $$
  select case w
    when 'sw' then array['sw', 'socket weld', 'socket_weld', 'socket-weld']
    when 'socketweld' then array['socket weld', 'socket_weld', 'sw']
    when 'npt' then array['npt', 'threaded'] when 'thd' then array['threaded', 'npt'] when 'thread' then array['thread'] when 'screwed' then array['threaded', 'npt']
    when 'bw' then array['bw', 'butt-weld', 'butt weld', 'buttweld'] when 'buttweld' then array['butt-weld', 'butt weld', 'buttweld']
    when 'wn' then array['wn', 'weld neck', 'weld-neck', 'weldneck'] when 'weldneck' then array['weld neck', 'weld-neck', 'weldneck']
    when 'so' then array['slip-on', 'slip on'] when 'rf' then array['rf', 'raised face', 'raised-face'] when 'ff' then array['full face', 'full-face', 'flat face', 'flat-face']
    when 'rtj' then array['rtj', 'ring type joint', 'ring-type-joint', 'ring joint']
    when 'kammprofile' then array['kammprofile', 'camprofile'] when 'camprofile' then array['camprofile', 'kammprofile'] when 'kamprofile' then array['kammprofile', 'camprofile']
    when 'spirotallic' then array['spiral wound'] when 'swg' then array['spiral wound']
    when 'gasket' then array['gasket', 'جوان'] when 'gaskets' then array['gasket', 'جوان']
    when 'elbows' then array['elbow'] when 'tees' then array['tee']
    when 'ss' then array['ss', 'stainless'] when 'cs' then array['cs', 'carbon steel'] when 'ptfe' then array['ptfe', 'teflon'] when 'teflon' then array['ptfe']
    when 'pipes' then array['pipe'] when 'flanges' then array['flange'] when 'valves' then array['valve'] when 'fittings' then array['fitting']
    else array[w] end
$$;

create table if not exists product_search (product_id uuid primary key references products(id) on delete cascade, doc text not null, name_doc text not null, updated_at timestamptz not null default now());
alter table product_search enable row level security;
-- read only through the security-definer functions below
revoke all on product_search from anon, authenticated;

create or replace function refresh_product_search(p_product uuid) returns void language plpgsql security definer set search_path = public as $$
declare d text; n text;
begin
  if p_product is null then return; end if;
  select search_norm(concat_ws(' ', p.name_en, p.name_ar, f.name_en, f.name_ar)),
         search_norm(concat_ws(' ', p.name_en, p.name_ar, p.sku, p.short_desc_en, p.short_desc_ar, p.description_en, p.manufacturer_ref, b.name, b.name_ar, f.name_en, f.name_ar,
           (select string_agg(concat_ws(' ', x->>'type', (select string_agg(g, ' ') from jsonb_array_elements_text(case when jsonb_typeof(x->'grades') = 'array' then x->'grades' else '[]'::jsonb end) g)), ' ')
              from jsonb_array_elements(case when jsonb_typeof(p.specs->'materials') = 'array' then p.specs->'materials' else '[]'::jsonb end) x),
           (select string_agg(concat_ws(' ', x.value, x.label_en, x.label_ar), ' ') from product_options o join product_option_values x on x.option_id = o.id where o.product_id = p.id),
           (select string_agg(concat_ws(' ', v.sku, v.manufacturer_code, v.size, v.pressure_class, v.grade, v.label_en,
                (select string_agg(o.value, ' ') from jsonb_each_text(coalesce(v.options, '{}'::jsonb)) o where o.value <> 'na')), ' ') from product_variants v where v.product_id = p.id and v.is_active),
           (select string_agg(concat_ws(' ', a.value_en, a.value_ar), ' ') from product_attribute_values a where a.product_id = p.id),
           (select string_agg(concat_ws(' ', pm.material_code, mt.name_en, mt.name_ar, array_to_string(pm.grades, ' ')), ' ')
              from product_materials pm join material_types mt on mt.code = pm.material_code where pm.product_id = p.id and pm.status in ('auto', 'verified')),
           (select string_agg(x->>'code', ' ') from jsonb_array_elements(case when jsonb_typeof(p.specs->'standards') = 'array' then p.specs->'standards' else '[]'::jsonb end) x)))
    into n, d
  from products p left join brands b on b.id = p.brand_id left join product_families f on f.id = p.family_id
  where p.id = p_product;
  if d is null then delete from product_search where product_id = p_product; return; end if;
  insert into product_search (product_id, doc, name_doc, updated_at) values (p_product, d, n, now())
  on conflict (product_id) do update set doc = excluded.doc, name_doc = excluded.name_doc, updated_at = now();
end $$;

create or replace function search_words(q text) returns text[] language sql immutable as $$
  select coalesce(array_agg(w) filter (where w <> '' and w not in ('for', 'and', 'the', 'with', 'of', 'to', 'a', 'in', 'x', '-', 'mm')), '{}')
  from regexp_split_to_table(search_norm(q), '[\s,;()]+') w
$$;
-- one word against a text: short words and sizes must stand alone (so "sw" does not match "swing", "1/2" not "1-1/2", "4" not "400")
create or replace function search_word_hit(doc text, w text) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(search_alternatives(w)) alt
    where case when alt ~ '^[0-9][0-9./-]*$' then doc ~ ('(^|[^0-9./-])' || regexp_replace(alt, '([./])', '\\\1', 'g') || '($|[^0-9/])')
               when length(alt) <= 3 then doc ~ ('(^|[^a-z0-9])' || regexp_replace(alt, '([./+])', '\\\1', 'g') || '($|[^a-z0-9])')
               else strpos(doc, alt) > 0 end)
$$;
create or replace function product_matches_query(p_product uuid, q text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select bool_and(search_word_hit(s.doc, w)) from product_search s, unnest(search_words(q)) w where s.product_id = p_product), false)
     and cardinality(search_words(q)) > 0
$$;
create or replace function product_query_rank(p_product uuid, q text) returns int language sql stable security definer set search_path = public as $$
  select coalesce((select sum(case when search_word_hit(s.name_doc, w) then 3 else 1 end)::int + case when strpos(s.name_doc, search_norm(q)) > 0 then 5 else 0 end
                   from product_search s, unnest(search_words(q)) w where s.product_id = p_product group by s.name_doc), 0)
$$;
grant execute on function product_matches_query(uuid, text), product_query_rank(uuid, text), search_norm(text), search_words(text) to anon, authenticated;

-- keep the cache current
create or replace function trg_product_search() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'products' then perform refresh_product_search(coalesce(new.id, old.id));
  elsif tg_table_name = 'product_option_values' then perform refresh_product_search((select product_id from product_options where id = coalesce(new.option_id, old.option_id)));
  elsif tg_table_name in ('brands', 'product_families') then
    perform refresh_product_search(p.id) from products p where (tg_table_name = 'brands' and p.brand_id = coalesce(new.id, old.id)) or (tg_table_name = 'product_families' and p.family_id = coalesce(new.id, old.id));
  else perform refresh_product_search(coalesce(new.product_id, old.product_id)); end if;
  return null;
end $$;
drop trigger if exists product_search_sync on products;
create trigger product_search_sync after insert or update on products for each row execute function trg_product_search();
drop trigger if exists product_search_sync on product_variants;
create trigger product_search_sync after insert or update or delete on product_variants for each row execute function trg_product_search();
drop trigger if exists product_search_sync on product_option_values;
create trigger product_search_sync after insert or update or delete on product_option_values for each row execute function trg_product_search();
drop trigger if exists product_search_sync on product_attribute_values;
create trigger product_search_sync after insert or update or delete on product_attribute_values for each row execute function trg_product_search();
drop trigger if exists product_search_sync on product_materials;
create trigger product_search_sync after insert or update or delete on product_materials for each row execute function trg_product_search();
drop trigger if exists product_search_sync on brands;
create trigger product_search_sync after update of name, name_ar on brands for each row execute function trg_product_search();
drop trigger if exists product_search_sync on product_families;
create trigger product_search_sync after update of name_en, name_ar on product_families for each row execute function trg_product_search();
select refresh_product_search(id) from products;

create or replace function search_products(
  p_q text default null, p_category uuid default null, p_filters jsonb default '{}'::jsonb, p_availability text default null,
  p_flag text default null, p_sort text default 'newest', p_limit int default 24, p_offset int default 0
) returns table (id uuid, total bigint, family_id uuid)
language plpgsql stable as $$
declare q text := nullif(trim(p_q), '');
  qn text := search_norm(p_q);
begin
  return query
  with filtered as (
    select p.id, p.name_en, p.published_at, p.view_count, product_display_price(p.id) as dprice, p.family_sort, product_listing_family(p.id) as fam,
           case when q is null then 0 else product_query_rank(p.id, q) end as rank
    from products p
    where p.status = 'published'
      and (p_category is null or p.category_id in (select category_descendants(p_category)))
      and (q is null or product_matches_query(p.id, q))
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
           min(f.name_en) over w as name_en, max(f.published_at) over w as published_at, sum(f.view_count) over w as view_count, min(f.dprice) over w as dprice, max(f.rank) over w as rank
    from filtered f
    window w as (partition by coalesce(f.fam, f.id))
    order by coalesce(f.fam, f.id), f.family_sort, f.name_en
  )
  select g.id, count(*) over () as total, g.fam from grouped g
  order by
    case when q is not null and coalesce(p_sort, 'newest') in ('newest', 'relevance') then g.rank end desc nulls last,
    case when p_sort = 'name_asc' then g.name_en end asc,
    case when p_sort = 'price_low' then g.dprice end asc nulls last,
    case when p_sort = 'price_high' then g.dprice end desc nulls last,
    case when p_sort = 'popular' then g.view_count end desc,
    g.published_at desc nulls last, g.name_en
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
end $$;
grant execute on function search_products(text,uuid,jsonb,text,text,text,int,int) to anon, authenticated;

-- type-ahead uses the same word matching
create or replace function search_suggestions(p_q text, p_limit int default 6)
returns table (kind text, id uuid, slug text, name_en text, name_ar text, image_path text)
language sql stable as $$
  with hits as (
    select p.id, p.slug, p.name_en, p.name_ar, p.view_count, product_listing_family(p.id) as fam, product_query_rank(p.id, p_q) as rank,
           (select i.storage_path from product_images i where i.product_id = p.id order by i.is_primary desc, i.sort_order limit 1) as img
    from products p
    where p.status = 'published' and length(trim(p_q)) >= 2 and product_matches_query(p.id, p_q)
  ),
  entries as (
    select distinct on (coalesce(h.fam, h.id))
           case when h.fam is null then 'product' else 'family' end as kind, coalesce(h.fam, h.id) as id,
           coalesce(f.slug, h.slug) as slug, coalesce(f.name_en, h.name_en) as name_en, coalesce(f.name_ar, h.name_ar) as name_ar,
           coalesce(f.image_path, h.img) as image_path, h.view_count, h.rank
    from hits h left join product_families f on f.id = h.fam
    order by coalesce(h.fam, h.id), h.rank desc, h.view_count desc
  )
  (select e.kind, e.id, e.slug, e.name_en, e.name_ar, e.image_path from entries e order by e.rank desc, e.view_count desc limit p_limit)
  union all
  (select 'category'::text, c.id, c.slug, c.name_en, c.name_ar, c.image_path
   from categories c
   where c.is_active and length(trim(p_q)) >= 2 and (c.name_en ilike '%'||trim(p_q)||'%' or c.name_ar ilike '%'||trim(p_q)||'%')
   limit 3)
$$;
grant execute on function search_suggestions(text,int) to anon, authenticated;

-- searches: remember how many results they had (null for events recorded before this change)
alter table analytics_events add column if not exists results int;
drop function if exists track_event(text, text, text, uuid, uuid, text, text);
create or replace function track_event(p_event text, p_session text, p_path text default null, p_product uuid default null, p_banner uuid default null, p_query text default null, p_lang text default null, p_results int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event not in ('page_view','product_view','search','banner_impression','banner_click','add_to_cart','whatsapp_click','phone_click','datasheet_download') then return; end if;   -- rfq_submit is recorded by submit_rfq itself
  if p_session is null or length(p_session) > 64 then return; end if;
  insert into analytics_events (event, session_id, path, product_id, banner_id, query, lang, results)
  values (p_event, p_session, left(p_path, 300), p_product, p_banner, left(p_query, 200), left(p_lang, 5), case when p_event = 'search' then greatest(0, least(p_results, 100000)) end);
  if p_event = 'product_view' and p_product is not null then update products set view_count = view_count + 1 where id = p_product; end if;
  if p_event = 'banner_impression' and p_banner is not null then update banners set impressions = impressions + 1 where id = p_banner; end if;
  if p_event = 'banner_click' and p_banner is not null then update banners set clicks = clicks + 1 where id = p_banner; end if;
end $$;
grant execute on function track_event(text,text,text,uuid,uuid,text,text,int) to anon, authenticated;

-- admin: what customers search for, and what finds nothing
create or replace function admin_search_terms(p_days int default 30, p_zero_only boolean default false, p_limit int default 30)
returns table (query text, searches bigint, last_results int, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select lower(trim(e.query)), count(*), (array_agg(e.results order by e.created_at desc))[1], max(e.created_at)
  from analytics_events e
  where is_staff() and e.event = 'search' and e.query is not null and trim(e.query) <> '' and e.created_at > now() - make_interval(days => p_days)
    and (not p_zero_only or e.results = 0)
  group by lower(trim(e.query)) order by count(*) desc, max(e.created_at) desc limit p_limit
$$;
grant execute on function admin_search_terms(int, boolean, int) to authenticated;
