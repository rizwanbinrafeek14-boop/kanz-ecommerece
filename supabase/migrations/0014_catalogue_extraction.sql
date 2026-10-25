-- Reusable manufacturer-catalogue extraction & import.
-- Nothing here publishes data by itself: extracted records wait in a staff-only review area until approved and imported.

-- ───────── Manufacturers (the existing brands table) ─────────
alter table brands add column if not exists country text, add column if not exists notes text;

-- ───────── Shared product families across manufacturers (never merges manufacturer records) ─────────
create table if not exists product_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name_en text not null, name_ar text,
  product_type text,                           -- e.g. elbow_90, tee, weldolet
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table products
  add column if not exists family_id uuid references product_families(id) on delete set null,
  add column if not exists manufacturer_ref text,            -- manufacturer's own reference, kept separate from our SKU
  add column if not exists country_of_origin text,           -- only when the catalogue states it
  add column if not exists applications_en text, add column if not exists applications_ar text,
  add column if not exists specs jsonb not null default '{}'::jsonb,   -- {standards:[{code,scope}], materials:[{type,grades}], notes:[...]} with source refs
  add column if not exists source_ref jsonb;                  -- {source_id, title, pages:[...]}
create index if not exists products_family_idx on products(family_id);

-- ───────── Selectable options (dependent: only combinations that exist as variants can be chosen) ─────────
create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  name_en text not null, name_ar text,
  sort_order int not null default 0,
  unique (product_id, key)
);
create table if not exists product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references product_options(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 80),
  label_en text not null, label_ar text,
  sort_order int not null default 0,
  unique (option_id, value)
);
alter table product_variants
  add column if not exists options jsonb not null default '{}'::jsonb,   -- {"connection":"socket_weld","class":"3000","size":"1/2"}
  add column if not exists manufacturer_code text,
  add column if not exists weight_kg numeric(12,4) check (weight_kg is null or weight_kg >= 0),
  add column if not exists source_page int;
create unique index if not exists variants_product_options_uq on product_variants (product_id, (options::text)) where options <> '{}'::jsonb;

-- ───────── Engineering dimension tables (symbols are per table: "A" on one drawing is not "A" on another) ─────────
create table if not exists dimension_tables (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title_en text not null, title_ar text,
  columns jsonb not null,                       -- [{key, symbol, label_en, label_ar, unit}]
  applies jsonb not null default '{}'::jsonb,   -- options this table applies to, e.g. {"connection":"socket_weld"}
  drawing_path text,                            -- bucket product-images
  notes jsonb not null default '[]'::jsonb,     -- footnotes / restrictions, verbatim
  source_page int,
  sort_order int not null default 0,
  check (jsonb_typeof(columns) = 'array' and jsonb_array_length(columns) between 1 and 40)
);
create table if not exists dimension_rows (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references dimension_tables(id) on delete cascade,
  match jsonb not null,                         -- which variants the row describes, e.g. {"size":"1/2","class":"3000"}
  "values" jsonb not null,                      -- {"A":"15.9","B":"..."} exactly as printed
  sort_order int not null default 0
);
create index if not exists dimension_tables_product_idx on dimension_tables(product_id);
create index if not exists dimension_rows_table_idx on dimension_rows(table_id);

-- ───────── Extraction workspace (staff only) ─────────
create table if not exists catalogue_sources (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete set null,
  title text not null,
  file_path text,                               -- bucket catalogue-sources (private)
  file_size bigint, page_count int check (page_count is null or page_count between 1 and 2000),
  status text not null default 'uploaded' check (status in ('uploaded','processing','reviewing','done')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists catalogue_pages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references catalogue_sources(id) on delete cascade,
  page_no int not null check (page_no >= 1),
  status text not null default 'pending' check (status in ('pending','rendered','extracted','needs_review','skipped','failed')),
  image_path text,                              -- bucket import-staging
  text_content text,
  method text check (method in ('text','vision','manual')),
  skip_reason text, error text,
  products_found int not null default 0,
  updated_at timestamptz not null default now(),
  unique (source_id, page_no)
);
create table if not exists extracted_products (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references catalogue_sources(id) on delete cascade,
  data jsonb not null,                          -- proposed product incl. options, variants, dimension tables, images, refs (validated in the app)
  pages int[] not null default '{}',
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending','approved','rejected','imported')),
  duplicate_of uuid references products(id) on delete set null,
  duplicate_info jsonb,
  imported_product_id uuid references products(id) on delete set null,
  reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists extracted_products_source_idx on extracted_products(source_id, status);
create table if not exists extraction_warnings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references catalogue_sources(id) on delete cascade,
  extracted_product_id uuid references extracted_products(id) on delete cascade,
  page_no int,
  severity text not null default 'warning' check (severity in ('info','warning','error')),
  code text not null, message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists extraction_warnings_source_idx on extraction_warnings(source_id);
create table if not exists catalogue_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references catalogue_sources(id) on delete set null,
  created_by uuid references profiles(id),
  summary jsonb not null,                       -- {imported, skipped, errors, product_ids}
  created_at timestamptz not null default now()
);

-- ───────── Access ─────────
alter table product_families enable row level security;
alter table product_options enable row level security;
alter table product_option_values enable row level security;
alter table dimension_tables enable row level security;
alter table dimension_rows enable row level security;
alter table catalogue_sources enable row level security;
alter table catalogue_pages enable row level security;
alter table extracted_products enable row level security;
alter table extraction_warnings enable row level security;
alter table catalogue_import_runs enable row level security;

create or replace function product_is_public(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from products where id = p and status = 'published')
$$;

drop policy if exists "families public read" on product_families;
create policy "families public read" on product_families for select using (true);
drop policy if exists "families staff write" on product_families;
create policy "families staff write" on product_families for all using (is_staff()) with check (is_staff());

drop policy if exists "options public read" on product_options;
create policy "options public read" on product_options for select using (product_is_public(product_id) or is_staff());
drop policy if exists "options staff write" on product_options;
create policy "options staff write" on product_options for all using (is_staff()) with check (is_staff());
drop policy if exists "option values public read" on product_option_values;
create policy "option values public read" on product_option_values for select
  using (exists (select 1 from product_options o where o.id = option_id and (product_is_public(o.product_id) or is_staff())));
drop policy if exists "option values staff write" on product_option_values;
create policy "option values staff write" on product_option_values for all using (is_staff()) with check (is_staff());

drop policy if exists "dimension tables public read" on dimension_tables;
create policy "dimension tables public read" on dimension_tables for select using (product_is_public(product_id) or is_staff());
drop policy if exists "dimension tables staff write" on dimension_tables;
create policy "dimension tables staff write" on dimension_tables for all using (is_staff()) with check (is_staff());
drop policy if exists "dimension rows public read" on dimension_rows;
create policy "dimension rows public read" on dimension_rows for select
  using (exists (select 1 from dimension_tables t where t.id = table_id and (product_is_public(t.product_id) or is_staff())));
drop policy if exists "dimension rows staff write" on dimension_rows;
create policy "dimension rows staff write" on dimension_rows for all using (is_staff()) with check (is_staff());

do $$ declare t text; begin
  foreach t in array array['catalogue_sources','catalogue_pages','extracted_products','extraction_warnings','catalogue_import_runs'] loop
    execute format('drop policy if exists "%1$s staff only" on %1$I', t);
    execute format('create policy "%1$s staff only" on %1$I for all using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

grant select on product_families, product_options, product_option_values, dimension_tables, dimension_rows to anon;
grant select, insert, update, delete on product_families, product_options, product_option_values, dimension_tables, dimension_rows,
  catalogue_sources, catalogue_pages, extracted_products, extraction_warnings, catalogue_import_runs to authenticated;

-- Private bucket for uploaded catalogue PDFs (manufacturer documents: never public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogue-sources', 'catalogue-sources', false, 52428800, array['application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
drop policy if exists "catalogue sources staff" on storage.objects;
create policy "catalogue sources staff" on storage.objects for all
  using (bucket_id = 'catalogue-sources' and is_staff()) with check (bucket_id = 'catalogue-sources' and is_staff());

-- ───────── Import one approved extracted product atomically (all or nothing) ─────────
-- p is prepared and validated by the application; the product is created as an unpublished, quote-only DRAFT.
create or replace function catalogue_import_product(p_extracted uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_product uuid; v_family uuid; v_opt uuid; o jsonb; v jsonb; t jsonb; r jsonb; i jsonb; v_table uuid; n int;
  v_status text;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select status into v_status from extracted_products where id = p_extracted for update;
  if v_status is null then raise exception 'Extracted record not found'; end if;
  if v_status <> 'approved' then raise exception 'Only approved records can be imported (status: %)', v_status; end if;

  if p ? 'family' and p->'family' is not null then
    insert into product_families (slug, name_en, name_ar, product_type, category_id)
    values (p->'family'->>'slug', p->'family'->>'name_en', p->'family'->>'name_ar', p->'family'->>'product_type', nullif(p->'family'->>'category_id','')::uuid)
    on conflict (slug) do update set name_en = product_families.name_en   -- keep the existing family as it is
    returning id into v_family;
  end if;

  insert into products (slug, name_en, name_ar, short_desc_en, short_desc_ar, description_en, description_ar, category_id, brand_id, status, is_quote_only,
                        unit, family_id, manufacturer_ref, country_of_origin, applications_en, applications_ar, specs, source_ref, seo_title_en, seo_title_ar, seo_desc_en, seo_desc_ar)
  values (p->'product'->>'slug', p->'product'->>'name_en', p->'product'->>'name_ar', p->'product'->>'short_desc_en', p->'product'->>'short_desc_ar',
          p->'product'->>'description_en', p->'product'->>'description_ar', nullif(p->'product'->>'category_id','')::uuid, nullif(p->'product'->>'brand_id','')::uuid,
          'draft', true, coalesce(p->'product'->>'unit','pcs'), v_family, p->'product'->>'manufacturer_ref', p->'product'->>'country_of_origin',
          p->'product'->>'applications_en', p->'product'->>'applications_ar', coalesce(p->'product'->'specs','{}'::jsonb), p->'product'->'source_ref',
          p->'product'->>'seo_title_en', p->'product'->>'seo_title_ar', p->'product'->>'seo_desc_en', p->'product'->>'seo_desc_ar')
  returning id into v_product;

  n := 0;
  for o in select * from jsonb_array_elements(coalesce(p->'options','[]'::jsonb)) loop
    insert into product_options (product_id, key, name_en, name_ar, sort_order) values (v_product, o->>'key', o->>'name_en', o->>'name_ar', n) returning id into v_opt;
    insert into product_option_values (option_id, value, label_en, label_ar, sort_order)
      select v_opt, x->>'value', x->>'label_en', x->>'label_ar', ord - 1 from jsonb_array_elements(o->'values') with ordinality as e(x, ord);
    n := n + 1;
  end loop;

  n := 0;
  for v in select * from jsonb_array_elements(coalesce(p->'variants','[]'::jsonb)) loop
    insert into product_variants (product_id, sku, label_en, label_ar, size, grade, schedule, pressure_class, material, price, is_active, sort_order, options, manufacturer_code, weight_kg, source_page)
    values (v_product, v->>'sku', v->>'label_en', v->>'label_ar', v->>'size', v->>'grade', v->>'schedule', v->>'pressure_class', v->>'material', null, true, n,
            coalesce(v->'options','{}'::jsonb), v->>'manufacturer_code', nullif(v->>'weight_kg','')::numeric, nullif(v->>'source_page','')::int);
    n := n + 1;
  end loop;

  n := 0;
  for t in select * from jsonb_array_elements(coalesce(p->'dimension_tables','[]'::jsonb)) loop
    insert into dimension_tables (product_id, title_en, title_ar, columns, applies, drawing_path, notes, source_page, sort_order)
    values (v_product, t->>'title_en', t->>'title_ar', t->'columns', coalesce(t->'applies','{}'::jsonb), t->>'drawing_path', coalesce(t->'notes','[]'::jsonb), nullif(t->>'source_page','')::int, n)
    returning id into v_table;
    insert into dimension_rows (table_id, match, "values", sort_order)
      select v_table, x->'match', x->'values', ord - 1 from jsonb_array_elements(coalesce(t->'rows','[]'::jsonb)) with ordinality as e(x, ord);
    n := n + 1;
  end loop;

  for i in select * from jsonb_array_elements(coalesce(p->'images','[]'::jsonb)) loop
    insert into product_images (product_id, storage_path, alt_en, alt_ar, sort_order, is_primary, needs_hires)
    values (v_product, i->>'storage_path', i->>'alt_en', i->>'alt_ar', coalesce((i->>'sort_order')::int, 0), coalesce((i->>'is_primary')::boolean, false), coalesce((i->>'needs_hires')::boolean, false));
  end loop;

  update extracted_products set status = 'imported', imported_product_id = v_product, updated_at = now() where id = p_extracted;
  return v_product;
end $$;
revoke all on function catalogue_import_product(uuid, jsonb) from public, anon;
grant execute on function catalogue_import_product(uuid, jsonb) to authenticated;
