-- 0020 Product images: temporary images, placeholders, replacement and bulk matching (additive; no data is removed).
-- * product_images records where each image came from (source: your own upload, the manufacturer's catalogue, or a
--   manufacturer image you added) and what it is (kind: photo or drawing), plus a small thumbnail for listings,
--   the pixel size / file size, the original file name, and the previous file after a replacement (one-step undo).
-- * Images stay separate from the product: replacing a file keeps the image row (position, main flag, alt text,
--   "shown for options"), so the product, its variants, stock, brands and families are never touched.
-- * products.placeholder_kind overrides the automatic placeholder drawing shown while a product has no image.
-- * match_image_files(): staff-only matching of uploaded file names to products by SKU, variant SKU, manufacturer
--   code / reference, slug or product name.
-- * replace_product_image() / restore_product_image(): swap the file, move references (social image, family image)
--   and return only the storage files nothing refers to any more (safe to delete).

alter table product_images
  add column if not exists source text not null default 'upload',
  add column if not exists kind text not null default 'photo',
  add column if not exists thumb_path text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists bytes int,
  add column if not exists original_name text,
  add column if not exists source_note text,
  add column if not exists previous_path text,
  add column if not exists previous_thumb_path text,
  add column if not exists replaced_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table product_images add constraint product_images_source_check check (source in ('upload', 'catalogue', 'manufacturer'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table product_images add constraint product_images_kind_check check (kind in ('photo', 'drawing'));
exception when duplicate_object then null; end $$;

-- existing images: catalogue crops and catalogue drawings are manufacturer material, not KANZ photographs
update product_images set source = 'catalogue'
 where source = 'upload' and (storage_path like 'catalogue/%' or needs_hires);
update product_images set kind = 'drawing'
 where kind = 'photo' and storage_path ilike '%.svg';

alter table products add column if not exists placeholder_kind text;
do $$ begin
  alter table products add constraint products_placeholder_kind_check
    check (placeholder_kind is null or placeholder_kind in ('pipe', 'elbow', 'tee', 'flange', 'valve', 'gasket', 'fastener', 'coupling', 'generic'));
exception when duplicate_object then null; end $$;

-- comparison keys for codes and file names:
-- image_sep_key keeps word boundaries ("KZ WN_150.JPG" -> "kz-wn-150-jpg"), image_key drops them ("kz-wn-150" -> "kzwn150")
create or replace function image_key(t text) returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '', 'g')
$$;
create or replace function image_sep_key(t text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'))
$$;

-- the keys tried for a file name, best first (null = not applicable):
--  1 whole name with word boundaries  2 same without one view / sequence suffix ("ABC-123_2", "ABC-123 (3)", "abc-123-front" -> "abc-123";
--    only one, so "BC-14_2" -> "bc-14", never "bc")
--  3 whole name without separators    4 same without the suffix
-- Boundaries come first so "BTH-3000-1_2.jpg" (second photo of BTH-3000-1) is not read as the code "BTH-3000-12".
create or replace function image_name_stems(p_name text) returns text[] language sql immutable as $$
  with s as (select regexp_replace(regexp_replace(coalesce(p_name, ''), '^.*[\\/]', ''), '\.[A-Za-z0-9]{2,5}$', '') as stem),
  t as (select stem, regexp_replace(stem, '(\s*\(\d{1,3}\)|[-_ .]+(\d{1,2}|main|front|back|side|top|detail|photo\d*|img\d*|image\d*|view\d*))$', '', 'i') as base from s)
  select array[image_sep_key(stem), nullif(image_sep_key(base), image_sep_key(stem)), image_key(stem), nullif(image_key(base), image_key(stem))] from t
$$;

/** Matches uploaded file names to products (keys tried in the order of image_name_stems); several rows for one name = ambiguous. */
create or replace function match_image_files(p_names text[])
returns table (name text, product_id uuid, product_name text, product_sku text, product_status text, matched_by text, matched_value text, exact boolean, variant_id uuid, variant_options jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  return query
  with names as (
    select n.nm, s.k, s.ord from unnest(p_names[1:1000]) as n(nm), unnest(image_name_stems(n.nm)) with ordinality as s(k, ord)
    where s.k is not null and length(s.k) >= 3
  ),
  raw as (
    select p.id as pid, null::uuid as vid, null::jsonb as vopts, 'product SKU' as how, p.sku as val from products p where p.sku is not null
    union all select v.product_id, v.id, v.options, 'variant SKU', v.sku from product_variants v
    union all select v.product_id, v.id, v.options, 'manufacturer code', v.manufacturer_code from product_variants v where v.manufacturer_code is not null
    union all select p.id, null, null, 'manufacturer reference', p.manufacturer_ref from products p where p.manufacturer_ref is not null
    union all select p.id, null, null, 'slug', p.slug from products p
    union all select p.id, null, null, 'product name', p.name_en from products p
  ),
  codes as (select r.*, image_sep_key(r.val) as ks, image_key(r.val) as kl,
                   -- best match type per name: SKU > manufacturer code or reference (same rank) > slug > name
                   case r.how when 'product SKU' then 1 when 'variant SKU' then 2 when 'manufacturer code' then 3 when 'manufacturer reference' then 3 when 'slug' then 4 else 5 end as pri
            from raw r),
  hits as (
    select n.nm, n.ord, c.pid, c.vid, c.vopts, c.how, c.val, c.pri from names n join codes c on c.ks = n.k where n.ord <= 2
    union all
    select n.nm, n.ord, c.pid, c.vid, c.vopts, c.how, c.val, c.pri from names n join codes c on c.kl = n.k where n.ord > 2
  ),
  best as (   -- keep only the best stem (exact first) and the best match type for each name
    select h.*, min(h.ord) over (partition by h.nm) as best_ord, min(h.pri) over (partition by h.nm, h.ord) as best_pri from hits h
  )
  select distinct on (b.nm, b.pid) b.nm, b.pid, p.name_en, p.sku, p.status::text, b.how, b.val, b.ord in (1, 3), b.vid, b.vopts
  from best b join products p on p.id = b.pid
  where b.ord = b.best_ord and b.pri = b.best_pri
  order by b.nm, b.pid, b.vid nulls first;
end $$;
revoke all on function match_image_files(text[]) from public, anon;
grant execute on function match_image_files(text[]) to authenticated;

/** Of the given storage paths (bucket product-images), those that no product image, drawing, family or social image refers to. */
create or replace function unreferenced_image_paths(p_paths text[]) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from unnest(p_paths) as x
  where x is not null and is_staff()
    and not exists (select 1 from product_images i where x in (i.storage_path, i.thumb_path, i.previous_path, i.previous_thumb_path))
    and not exists (select 1 from dimension_tables t where t.drawing_path = x)
    and not exists (select 1 from product_families f where f.image_path = x)
    and not exists (select 1 from products p where p.og_image_path = x)
$$;
revoke all on function unreferenced_image_paths(text[]) from public, anon;
grant execute on function unreferenced_image_paths(text[]) to authenticated;

/**
 * Replace the file of one product image. The row keeps its id, position, main flag, alt text and "shown for options";
 * the previous file is kept for one-step undo. Returns storage paths that are no longer used anywhere (safe to delete).
 */
create or replace function replace_product_image(p_image uuid, p_path text, p_thumb text, p_meta jsonb default '{}')
returns text[] language plpgsql security definer set search_path = public as $$
declare r product_images; v_drop text[];
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into r from product_images where id = p_image for update;
  if not found then raise exception 'Image not found'; end if;
  if p_path is null or p_path not like r.product_id::text || '/%' or (p_thumb is not null and p_thumb not like r.product_id::text || '/%') then
    raise exception 'The new file must be uploaded to this product''s folder';
  end if;
  v_drop := array_remove(array[r.previous_path, r.previous_thumb_path], null);
  update product_images set
    previous_path = storage_path, previous_thumb_path = thumb_path,
    storage_path = p_path, thumb_path = p_thumb,
    source = coalesce(p_meta->>'source', 'upload'), kind = coalesce(p_meta->>'kind', 'photo'),
    needs_hires = coalesce((p_meta->>'needs_hires')::boolean, false),
    width = (p_meta->>'width')::int, height = (p_meta->>'height')::int, bytes = (p_meta->>'bytes')::int,
    original_name = left(p_meta->>'original_name', 200), source_note = left(p_meta->>'source_note', 300),
    replaced_at = now(), updated_at = now()
  where id = p_image;
  -- references to the old file follow the image
  update products set og_image_path = p_path where id = r.product_id and og_image_path = r.storage_path;
  update product_families set image_path = p_path where image_path = r.storage_path;
  return unreferenced_image_paths(v_drop);
end $$;
revoke all on function replace_product_image(uuid, text, text, jsonb) from public, anon;
grant execute on function replace_product_image(uuid, text, text, jsonb) to authenticated;

/** Undo the last replacement of an image (swaps the current and the previous file). */
create or replace function restore_product_image(p_image uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r product_images;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select * into r from product_images where id = p_image for update;
  if not found then raise exception 'Image not found'; end if;
  if r.previous_path is null then raise exception 'There is no previous file to restore'; end if;
  update product_images set storage_path = r.previous_path, thumb_path = r.previous_thumb_path,
    previous_path = r.storage_path, previous_thumb_path = r.thumb_path,
    -- the previous file is assumed to be a catalogue image when it lives in the catalogue folder
    source = case when r.previous_path like 'catalogue/%' then 'catalogue' else source end,
    width = null, height = null, bytes = null, replaced_at = now(), updated_at = now()
  where id = p_image;
  update products set og_image_path = r.previous_path where id = r.product_id and og_image_path = r.storage_path;
  update product_families set image_path = r.previous_path where image_path = r.storage_path;
end $$;
revoke all on function restore_product_image(uuid) from public, anon;
grant execute on function restore_product_image(uuid) to authenticated;

-- suggestions use the small listing image when there is one
create or replace function search_suggestions(p_q text, p_limit int default 6)
returns table (kind text, id uuid, slug text, name_en text, name_ar text, image_path text)
language sql stable as $$
  with hits as (
    select p.id, p.slug, p.name_en, p.name_ar, p.view_count, product_listing_family(p.id) as fam, product_query_rank(p.id, p_q) as rank,
           (select coalesce(i.thumb_path, i.storage_path) from product_images i where i.product_id = p.id and i.option_match is null order by i.is_primary desc, i.sort_order limit 1) as img
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

-- catalogue import: keep where each image came from (catalogue photo or drawing) and its thumbnail
create or replace function catalogue_import_images(p_product uuid, p jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare i jsonb;
begin
  for i in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    update product_images set
      source = coalesce(i->>'source', 'catalogue'), kind = coalesce(i->>'kind', kind), thumb_path = i->>'thumb_path',
      width = (i->>'width')::int, height = (i->>'height')::int, bytes = (i->>'bytes')::int, source_note = left(i->>'source_note', 300)
    where product_id = p_product and storage_path = i->>'storage_path';
  end loop;
end $$;
revoke all on function catalogue_import_images(uuid, jsonb) from public, anon;
grant execute on function catalogue_import_images(uuid, jsonb) to authenticated;

-- image status per product, kept by a trigger, for the admin "needs a photo" filters:
-- photo = has an uploaded or manufacturer image; temporary = only catalogue images / drawings; none = placeholder shown
alter table products add column if not exists image_status text not null default 'none';
do $$ begin
  alter table products add constraint products_image_status_check check (image_status in ('photo', 'temporary', 'none'));
exception when duplicate_object then null; end $$;
create index if not exists products_image_status_idx on products(image_status);

create or replace function product_image_status(p_product uuid) returns text language sql stable security definer set search_path = public as $$
  select case when bool_or(i.source in ('upload', 'manufacturer')) then 'photo' when count(i.id) > 0 then 'temporary' else 'none' end
  from product_images i where i.product_id = p_product
$$;
revoke all on function product_image_status(uuid) from public, anon;

create or replace function trg_product_image_status() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  for pid in select distinct x from unnest(array[case when tg_op <> 'INSERT' then old.product_id end, case when tg_op <> 'DELETE' then new.product_id end]) as x where x is not null loop
    update products set image_status = product_image_status(pid) where id = pid and image_status is distinct from product_image_status(pid);
  end loop;
  return null;
end $$;
drop trigger if exists product_image_status_sync on product_images;
create trigger product_image_status_sync after insert or update or delete on product_images for each row execute function trg_product_image_status();

update products p set image_status = product_image_status(p.id) where p.image_status is distinct from product_image_status(p.id);

-- images loaded by catalogue packages and importers into the catalogue/ folder are catalogue material, whatever the loader
-- says (admin uploads always go to the product's own folder), and SVG files are drawings
create or replace function trg_product_image_classify() returns trigger language plpgsql as $$
begin
  if new.storage_path like 'catalogue/%' and new.source = 'upload' then new.source := 'catalogue'; end if;
  if new.storage_path ilike '%.svg' then new.kind := 'drawing'; end if;
  return new;
end $$;
drop trigger if exists product_image_classify on product_images;
create trigger product_image_classify before insert or update of storage_path, source on product_images for each row execute function trg_product_image_classify();
