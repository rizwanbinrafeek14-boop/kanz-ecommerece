-- 0021 Manufacturer website catalogues (additive; nothing is published or overwritten by itself).
-- * catalogue_sources can be a manufacturer WEBSITE (start URL, allowed host, crawl settings, reuse permissions) as well as a PDF.
-- * catalogue_web_pages is the crawl manifest: every discovered URL with its type, status, HTTP result, error and attempts, so a
--   crawl can be resumed, retried and audited (staff only).
-- * Imported products remember where they came from (source_url, and source_key = page URL + model) so running an import
--   again finds them instead of creating duplicates; an extracted record that matches one is shown as an UPDATE with a preview.
-- * product_documents can link to the manufacturer's original file (external_url) when copying it is not permitted.
-- * products.catalogue_only marks manufacturer catalogue items that are not stocked: "Catalogue item — request a quotation".

alter table catalogue_sources
  add column if not exists kind text not null default 'pdf',
  add column if not exists start_url text,
  add column if not exists allowed_host text,
  add column if not exists settings jsonb not null default '{}'::jsonb,   -- {path_prefix, max_pages, delay_ms, reuse_images, reuse_documents, permission_note}
  add column if not exists robots jsonb,                                    -- robots.txt rules as read at crawl start: {fetched_at, status, rules:[{allow,path}], crawl_delay}
  add column if not exists crawl_state text not null default 'idle';
do $$ begin
  alter table catalogue_sources add constraint catalogue_sources_kind_check check (kind in ('pdf', 'website'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table catalogue_sources add constraint catalogue_sources_crawl_state_check check (crawl_state in ('idle', 'running', 'paused', 'done', 'blocked'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table catalogue_sources add constraint catalogue_sources_website_check
    check (kind <> 'website' or (start_url is not null and allowed_host is not null and start_url ~ '^https?://' and allowed_host ~ '^[a-z0-9.-]+$'));
exception when duplicate_object then null; end $$;

create table if not exists catalogue_web_pages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references catalogue_sources(id) on delete cascade,
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  kind text not null default 'unknown' check (kind in ('unknown', 'listing', 'product', 'document', 'image', 'other')),
  status text not null default 'queued' check (status in ('queued', 'fetched', 'extracted', 'skipped', 'failed', 'blocked')),
  depth int not null default 0,
  discovered_from text,
  http_status int,
  content_type text,
  title text,
  text_content text,                 -- cleaned page text + tables + image / document links, input for extraction
  content_hash text,                 -- sha256 of the cleaned content (unchanged pages are not extracted again)
  products_found int not null default 0,
  skip_reason text,
  error text,
  attempts int not null default 0,
  fetched_at timestamptz,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, url)
);
create index if not exists catalogue_web_pages_status_idx on catalogue_web_pages(source_id, status);
alter table catalogue_web_pages enable row level security;
drop policy if exists "catalogue_web_pages staff only" on catalogue_web_pages;
create policy "catalogue_web_pages staff only" on catalogue_web_pages for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on catalogue_web_pages to authenticated;

alter table extracted_products
  add column if not exists source_url text,
  add column if not exists source_key text,
  add column if not exists update_of uuid references products(id) on delete set null,   -- an already imported product with the same source key
  add column if not exists changes jsonb;                                                 -- field-by-field preview of what an update would change
create index if not exists extracted_products_source_key_idx on extracted_products(source_key);

alter table products
  add column if not exists source_url text,
  add column if not exists source_key text,
  add column if not exists catalogue_only boolean not null default false;
-- one product per manufacturer per source key: re-running an import can never create a duplicate
create unique index if not exists products_brand_source_key_uq on products(brand_id, source_key) where source_key is not null;

alter table product_documents
  add column if not exists external_url text,
  add column if not exists source_url text;
alter table product_documents alter column storage_path drop not null;
do $$ begin
  alter table product_documents add constraint product_documents_file_or_link check (storage_path is not null or external_url ~ '^https://');
exception when duplicate_object then null; end $$;

/** Products of a manufacturer already imported from these source keys (for duplicate / update detection). */
create or replace function products_by_source_keys(p_brand uuid, p_keys text[])
returns table (source_key text, product_id uuid, name_en text, status text)
language sql stable security definer set search_path = public as $$
  select p.source_key, p.id, p.name_en, p.status::text from products p
  where is_staff() and p.brand_id = p_brand and p.source_key = any(p_keys)
$$;
revoke all on function products_by_source_keys(uuid, text[]) from public, anon;
grant execute on function products_by_source_keys(uuid, text[]) to authenticated;
