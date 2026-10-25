# Step 2: build paste-ready SQL (products + drawings) and drawing crops from the payloads.
# usage: python3 make_sql.py <payloads.json> <brand-slug> "<Brand Name>" <page-images-dir with p-N.png at 300 dpi> <out-dir>
# Never commit the output: it contains manufacturer catalogue data.
import json, os, sys
from PIL import Image
P = json.load(open(sys.argv[1])); BS, BN, IMG, OUT = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
os.makedirs(OUT, exist_ok=True)
def dq(obj):
    s = json.dumps(obj, ensure_ascii=False); assert "$kz$" not in s; return "$kz$" + s + "$kz$::jsonb"
def lit(s):
    return "null" if s is None else "'" + s.replace("'", "''") + "'"
n_var = sum(len(p["variants"]) for p in P)
head = f"""-- KANZ: {BN} catalogue products, generated from the reviewed extraction file.
-- Run ONCE in Supabase -> SQL Editor (paste everything, press Run). Requires migration 0014.
-- Creates {len(P)} DRAFT, quote-only products ({n_var} variants). Nothing goes public until you press Publish in Admin -> Products.
-- Never overwrites: an existing product is skipped, except a reference-only draft with no sizes yet, which is filled in. One transaction: if anything fails, nothing is saved.
begin;
do $$ begin
  if to_regclass('public.dimension_tables') is null then raise exception 'Run supabase/migrations/0014_catalogue_extraction.sql first.'; end if;
end $$;
insert into brands (slug, name, is_active) values ({lit(BS)}, {lit(BN)}, false) on conflict (slug) do nothing;

create or replace function pg_temp.kanz_load(p jsonb) returns text language plpgsql as $f$
declare v_product uuid; v_family uuid; v_opt uuid; v_cat uuid; v_brand uuid; o jsonb; t jsonb; v_table uuid; n int; dup text; filled boolean := false;
begin
  select id into v_product from products where slug = p->'product'->>'slug';
  if v_product is not null then
    -- only a reference-only draft (created from a reference sheet, no options/variants yet) may be filled in; anything else is left untouched
    if coalesce((select source_ref->>'reference_only' from products where id = v_product), '') <> 'true'
       or exists (select 1 from product_variants where product_id = v_product) or exists (select 1 from product_options where product_id = v_product)
       or jsonb_array_length(p->'variants') = 0 then
      return 'skipped (already exists): ' || (p->'product'->>'slug');
    end if;
  end if;
  select string_agg(sku, ', ') into dup from product_variants where lower(sku) in (select lower(x->>'sku') from jsonb_array_elements(p->'variants') x);
  if dup is not null then raise exception 'SKU already used by another product: % (nothing was saved)', left(dup, 200); end if;
  select id into v_cat from categories where slug = p->'product'->>'category_slug';
  select id into v_brand from brands where slug = {lit(BS)};
  insert into product_families (slug, name_en, name_ar, product_type, category_id)
  values (p->'family'->>'slug', p->'family'->>'name_en', p->'family'->>'name_ar', p->'family'->>'product_type', v_cat)
  on conflict (slug) do update set name_en = product_families.name_en returning id into v_family;
  if v_product is not null then
    update products set short_desc_en = p->'product'->>'short_desc_en', short_desc_ar = p->'product'->>'short_desc_ar', description_en = p->'product'->>'description_en',
           description_ar = p->'product'->>'description_ar', specs = p->'product'->'specs', source_ref = p->'product'->'source_ref', updated_at = now()
     where id = v_product and status = 'draft';
    if not found then return 'skipped (not a draft): ' || (p->'product'->>'slug'); end if;
    filled := true;
  else
  insert into products (slug, name_en, name_ar, short_desc_en, short_desc_ar, description_en, description_ar, category_id, brand_id, status, is_quote_only,
                        unit, family_id, manufacturer_ref, country_of_origin, applications_en, specs, source_ref)
  values (p->'product'->>'slug', p->'product'->>'name_en', p->'product'->>'name_ar', p->'product'->>'short_desc_en', p->'product'->>'short_desc_ar',
          p->'product'->>'description_en', p->'product'->>'description_ar', v_cat, v_brand, 'draft', true, 'pcs', v_family,
          p->'product'->>'manufacturer_ref', p->'product'->>'country_of_origin', p->'product'->>'applications_en', p->'product'->'specs', p->'product'->'source_ref')
  returning id into v_product;
  end if;
  n := 0;
  for o in select * from jsonb_array_elements(p->'options') loop
    insert into product_options (product_id, key, name_en, name_ar, sort_order) values (v_product, o->>'key', o->>'name_en', o->>'name_ar', n) returning id into v_opt;
    insert into product_option_values (option_id, value, label_en, label_ar, sort_order)
      select v_opt, x->>'value', x->>'label_en', x->>'label_ar', ord - 1 from jsonb_array_elements(o->'values') with ordinality as e(x, ord);
    n := n + 1;
  end loop;
  insert into product_variants (product_id, sku, label_en, label_ar, size, grade, schedule, pressure_class, material, price, is_active, sort_order, options, manufacturer_code, weight_kg, source_page)
    select v_product, x->>'sku', x->>'label_en', x->>'label_ar', x->>'size', x->>'grade', x->>'schedule', x->>'pressure_class', x->>'material', null, true, ord - 1,
           x->'options', x->>'manufacturer_code', nullif(x->>'weight_kg','')::numeric, nullif(x->>'source_page','')::int
    from jsonb_array_elements(p->'variants') with ordinality as e(x, ord);
  n := 0;
  for t in select * from jsonb_array_elements(p->'dimension_tables') loop
    insert into dimension_tables (product_id, title_en, title_ar, columns, applies, drawing_path, notes, source_page, sort_order)
    values (v_product, t->>'title_en', t->>'title_ar', t->'columns', coalesce(t->'applies','{{}}'::jsonb), null, coalesce(t->'notes','[]'::jsonb), nullif(t->>'source_page','')::int, n)
    returning id into v_table;
    insert into dimension_rows (table_id, match, "values", sort_order)
      select v_table, x->'match', x->'values', ord - 1 from jsonb_array_elements(t->'rows') with ordinality as e(x, ord);
    n := n + 1;
  end loop;
  return (case when filled then 'filled in: ' else 'created: ' end) || (p->'product'->>'slug') || ' (' || jsonb_array_length(p->'variants') || ' variants)';
end $f$;

"""
body = []
for p in P:
    q = json.loads(json.dumps(p)); q.pop("images", None)
    for t in q["dimension_tables"]: t.pop("crop", None); t.pop("drawing_path", None)
    body.append(f"select pg_temp.kanz_load({dq(q)});")
open(f"{OUT}/1-{BS}-products.sql", "w").write(head + "\n".join(body) + "\n\ncommit;\n")

pages, done = {}, {}
def crop(c, path):
    if path in done: return done[path]
    pg = c["page"]; im = pages.setdefault(pg, Image.open(f"{IMG}/p-{pg}.png").convert("RGB")); W, H = im.size; b = c["bbox"]
    os.makedirs(os.path.dirname(f"{OUT}/{path}"), exist_ok=True)
    c2 = im.crop((int(b[0]*W), int(b[1]*H), int(b[2]*W), int(b[3]*H))); c2.save(f"{OUT}/{path}", "WEBP", quality=90)
    done[path] = min(c2.size) < 500; return done[path]
lines = [f"-- KANZ: {BN} dimension drawings. Run AFTER uploading the 'catalogue' folder into Storage -> product-images.", "-- Safe to run more than once.", "begin;"]
for p in P:
    slug = p["product"]["slug"]
    for n, t in enumerate(p["dimension_tables"]):
        if not t.get("crop"): continue
        crop(t["crop"], t["drawing_path"])
        lines.append(f"update dimension_tables set drawing_path = {lit(t['drawing_path'])} where sort_order = {n} and product_id = (select id from products where slug = {lit(slug)});")
    for im in p["images"]:
        small = crop(im["crop"], im["storage_path"])
        lines.append(f"insert into product_images (product_id, storage_path, alt_en, alt_ar, sort_order, is_primary, needs_hires) select id, {lit(im['storage_path'])}, {lit(im['alt_en'])}, {lit(im['alt_ar'])}, {im['sort_order']}, {str(im['is_primary']).lower()}, {str(small).lower()} from products where slug = {lit(slug)} and not exists (select 1 from product_images i where i.product_id = products.id and i.storage_path = {lit(im['storage_path'])});")
lines.append("commit;")
open(f"{OUT}/2-{BS}-drawings.sql", "w").write("\n".join(lines) + "\n")
print("files:", len(done), "images")
